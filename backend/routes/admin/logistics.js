/*
 * doliGAS - Solidarity purchasing group (GAS) management platform
 * Copyright (C) 2026 Luigi Grillo (doliFarm)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * doliGAS - Logistics and distribution module
 * -----------------------------------------------------------------------------
 * FILE: backend/routes/admin/logistics.js
 * STATUS: Stable.
 * DESC: handles G6 (check-in/weighing) and G7 (distribution/delivery).
 * FEATURES: proportional split, surplus handling, wallet audit ledger.
 */

const express = require('express');
const router = express.Router();

/**
 * Helper returning the singleton connection pool.
 */
const getDb = () => global.pool || require('../../config/db');
const { allocateProportionally } = require('../../utils/allocation');

// =============================================================================
// SECTION G6: RECEIVING AND WEIGHING (CHECK-IN)
// =============================================================================

/**
 * GET /api/admin/logistics/checkin/:cycleId
 * Summary of ordered products for the weighing phase.
 */
router.get('/checkin/:cycleId', async (req, res) => {
    const pool = getDb();
    const { cycleId } = req.params;
    const gasId = req.user.verifiedGasId;

    try {
        const [rows] = await pool.execute(`
            SELECT 
                p.id as product_id, p.name as product_name, 
                pr.business_name as producer_name,
                pu.symbol as unit, pu.is_discrete,
                SUM(oi.quantity) as qty_ordered,
                SUM(COALESCE(oi.qty_received, 0)) as qty_received_total,
                COUNT(DISTINCT oi.order_id) as total_members_involved
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN producers pr ON p.producer_id = pr.id
            JOIN product_units pu ON p.unit_id = pu.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.cycle_id = ? AND o.gas_id = ? AND o.status IN ('confirmed', 'processing')
            GROUP BY p.id
            ORDER BY pr.business_name ASC, p.name ASC
        `, [cycleId, gasId]);

        res.json(rows);
    } catch (e) {
        console.error("[LOGISTICS] Check-in Fetch Error:", e.message);
        res.status(500).json({ error: "Errore nel recupero dati pesatura." });
    }
});

/**
 * POST /api/admin/logistics/checkin/bulk-update
 * Proportional split of the total weight received among all ordering members.
 * Uses a transaction to keep weights and wallets consistent.
 */
router.post('/checkin/bulk-update', async (req, res) => {
    const pool = getDb();
    const conn = await pool.getConnection();
    const { cycleId, items } = req.body;
    const gasId = req.user.verifiedGasId; // SECURITY: never the gasId from the body
    const adminId = req.user.id;

    try {
        await conn.beginTransaction();

        for (const update of items) {
            const { productId, totalReceived } = update;

            const received = Number(totalReceived);
            if (!Number.isFinite(received) || received < 0) {
                throw new Error(`QUANTITA_NON_VALIDA: peso ricevuto non valido per il prodotto ID ${productId}`);
            }

            // Load all items for that product in that cycle, plus the unit of measure
            const [itemsToUpdate] = await conn.execute(`
                SELECT oi.id, oi.quantity, oi.price_at_order, o.user_id, pu.is_discrete
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                JOIN products p ON oi.product_id = p.id
                JOIN product_units pu ON p.unit_id = pu.id
                WHERE o.cycle_id = ? AND oi.product_id = ? AND o.gas_id = ?
                  AND o.status IN ('confirmed', 'processing')
                ORDER BY oi.id ASC
            `, [cycleId, productId, gasId]);

            if (itemsToUpdate.length === 0) continue;

            /**
             * Proportional split with the largest remainder method: the shares add up
             * exactly to the received total, with no fractions lost to rounding.
             * Discrete units (pieces, bottles) are split into whole numbers.
             */
            const step = itemsToUpdate[0].is_discrete ? 1 : 0.01;
            const assignments = allocateProportionally(
                received,
                itemsToUpdate.map(i => parseFloat(i.quantity)),
                step
            );

            for (let i = 0; i < itemsToUpdate.length; i++) {
                await conn.execute(
                    "UPDATE order_items SET qty_received = ?, updated_at = NOW(), updated_by = ? WHERE id = ?",
                    [assignments[i], adminId, itemsToUpdate[i].id]
                );
            }
        }

        await conn.commit();
        res.json({ success: true });
    } catch (e) {
        await conn.rollback();
        console.error("[LOGISTICS] Bulk Update Error:", e.message);
        const isBusiness = e.message.startsWith('QUANTITA_NON_VALIDA');
        res.status(isBusiness ? 400 : 500).json({ error: isBusiness ? e.message : "Errore durante il ricalcolo pesi: " + e.message });
    } finally {
        conn.release();
    }
});

// =============================================================================
// SECTION G7: DELIVERY AND CLOSING (CHECK-OUT)
// =============================================================================

/**
 * GET /api/admin/logistics/checkout-list/:cycleId
 * Members with orders ready for pickup.
 */
router.get('/checkout-list/:cycleId', async (req, res) => {
    const pool = getDb();
    const { cycleId } = req.params;
    const gasId = req.user.verifiedGasId;

    try {
        const [rows] = await pool.execute(`
            SELECT 
                o.id as order_id, u.first_name, u.last_name, o.status,
                (SELECT SUM(COALESCE(qty_received, quantity) * price_at_order) 
                 FROM order_items WHERE order_id = o.id) as real_total
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.cycle_id = ? AND o.gas_id = ? AND o.status IN ('confirmed', 'processing', 'delivered')
            ORDER BY u.last_name ASC
        `, [cycleId, gasId]);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: "Errore caricamento lista checkout." });
    }
});

/**
 * GET /api/admin/logistics/receipt/:orderId
 * Order details for the delivery receipt.
 */
router.get('/receipt/:orderId', async (req, res) => {
    const pool = getDb();
    const { orderId } = req.params;
    const gasId = req.user.verifiedGasId;

    try {
        const [order] = await pool.execute(`
            SELECT o.*, u.first_name, u.last_name 
            FROM orders o 
            JOIN users u ON o.user_id = u.id 
            WHERE o.id = ? AND o.gas_id = ?
        `, [orderId, gasId]);

        const [items] = await pool.execute(`
            SELECT oi.*, p.name as product_name, pr.business_name as producer_name, pu.symbol as unit, pu.is_discrete
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN producers pr ON p.producer_id = pr.id
            JOIN product_units pu ON p.unit_id = pu.id
            WHERE oi.order_id = ?
        `, [orderId]);

        res.json({ order: order[0], items });
    } catch (e) {
        res.status(500).json({ error: "Errore recupero ricevuta." });
    }
});

/**
 * POST /api/admin/logistics/checkout/deliver
 * Finalizes the order with the ADJUSTMENT on the real weight and moves its status to 'delivered'.
 * Wallet model: the ordered amount was already charged when the order was placed
 * (routes/members.js). Here only the difference between real total and ordered total is settled:
 *   - difference > 0 -> additional charge (SPESA)
 *   - difference < 0 -> refund to the member (REFUND)
 */
router.post('/checkout/deliver', async (req, res) => {
    const pool = getDb();
    const conn = await pool.getConnection();
    const { orderId } = req.body;
    const gasId = req.user.verifiedGasId; // SECURITY: never the gasId from the body
    const adminId = req.user.id;

    try {
        await conn.beginTransaction();

        // 1. Load order and items for the final recalculation
        const [orderRows] = await conn.execute("SELECT user_id, status, total_amount FROM orders WHERE id = ? AND gas_id = ? FOR UPDATE", [orderId, gasId]);
        if (orderRows.length === 0) throw new Error("Ordine non trovato.");
        if (orderRows[0].status === 'delivered') throw new Error("Ordine già consegnato.");
        if (!['confirmed', 'processing'].includes(orderRows[0].status)) throw new Error("Ordine non consegnabile nello stato attuale.");

        const [items] = await conn.execute("SELECT qty_received, quantity, price_at_order FROM order_items WHERE order_id = ?", [orderId]);

        // Compute in cents to avoid rounding errors
        const toCents = (v) => Math.round(parseFloat(v) * 100);
        const realTotalCents = items.reduce((sum, it) => {
            const qty = parseFloat(it.qty_received ?? it.quantity);
            return sum + Math.round(qty * parseFloat(it.price_at_order) * 100);
        }, 0);
        const realTotal = realTotalCents / 100;
        const chargedTotal = toCents(orderRows[0].total_amount) / 100;
        const adjustment = (realTotalCents - toCents(orderRows[0].total_amount)) / 100;

        // 2. Member wallet adjustment (only the difference, recorded in the transaction log)
        if (adjustment !== 0) {
            await conn.execute(
                "UPDATE gas_memberships SET balance = balance - ?, updated_at = NOW(), updated_by = ? WHERE user_id = ? AND gas_id = ?",
                [adjustment, adminId, orderRows[0].user_id, gasId]
            );

            const txType = adjustment > 0 ? 'SPESA' : 'REFUND';
            const description = adjustment > 0
                ? `Conguaglio consegna Ordine #${orderId}: peso reale superiore all'ordinato`
                : `Conguaglio consegna Ordine #${orderId}: restituzione per peso reale inferiore`;

            await conn.execute(`
                INSERT INTO wallet_transactions (gas_id, user_id, amount, type, status, description, created_at, created_by)
                VALUES (?, ?, ?, ?, 'completed', ?, NOW(), ?)
            `, [gasId, orderRows[0].user_id, -adjustment, txType, description, adminId]);
        }

        // 3. Update the order status
        await conn.execute("UPDATE orders SET status = 'delivered', total_amount = ?, updated_at = NOW(), updated_by = ? WHERE id = ?", [realTotal, adminId, orderId]);

        await conn.commit();
        res.json({ success: true, finalAmount: realTotal, chargedAtOrder: chargedTotal, adjustment });
    } catch (e) {
        await conn.rollback();
        console.error("[LOGISTICS] Delivery Error:", e.message);
        const isBusiness = /^Ordine /.test(e.message);
        res.status(isBusiness ? 400 : 500).json({ error: e.message });
    } finally {
        conn.release();
    }
});

// =============================================================================
// UTILITY AND SURPLUS SECTION
// =============================================================================

/**
 * POST /api/admin/logistics/handle-surplus
 * Records goods received in excess (not ordered by anyone).
 */
router.post('/handle-surplus', async (req, res) => {
    const pool = getDb();
    const { cycleId, productId, surplusWeight, pricePerUnit } = req.body;
    const gasId = req.user.verifiedGasId;

    try {
        await pool.execute(`
            INSERT INTO notifications (gas_id, user_id, title, message, type)
            SELECT ?, user_id, 'Gestione Eccedenza', ?, 'warning'
            FROM gas_memberships WHERE gas_id = ? AND role_id = 1
        `, [gasId, `Rilevato surplus di ${surplusWeight} per prodotto ID ${productId}`, gasId]);
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;