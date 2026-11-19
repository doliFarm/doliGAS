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
 * @file backend/routes/products.js
 * @version v1.1.2
 * @author Luigi GRILLO @ doliFarm.com
 * @description Producer Area API. Fix: removed the nonexistent deleted_at column that caused error 500.
 * @status Stable
 * @date 2026-02-24
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');
const getDb = () => global.pool || require('../config/db');

router.use(authenticateToken);

// --- CONTEXT HELPER ---
const getContext = async (userId, producerId = null) => {
    const pool = getDb();
    try {
        let query = "SELECT id as producer_id, gas_id, business_name FROM producers WHERE user_id = ?";
        let params = [userId];
        
        if (producerId && producerId !== 'undefined' && producerId !== 'null') {
            query += " AND id = ?";
            params.push(producerId);
        }
        query += " LIMIT 1";

        const [rows] = await pool.execute(query, params);
        return rows.length > 0 ? rows[0] : null;
    } catch (e) {
        console.error("[PRODUCTS] getContext Error:", e.message);
        throw e;
    }
};

/**
 * SECURITY: the price list is locked between the G2 deadline (producers_deadline)
 * and the delivery of the active cycle. Outside a cycle the producer can edit it.
 */
const isListLocked = async (gasId) => {
    const pool = getDb();
    const [cycles] = await pool.execute(`
        SELECT id FROM cycles
        WHERE gas_id = ? AND is_active = 1
          AND producers_deadline <= NOW() AND delivery_at > NOW()
        LIMIT 1`, [gasId]);
    return cycles.length > 0;
};

/**
 * Returns the producer context only if the user can edit the price list,
 * otherwise sends the error response and returns null.
 */
const getWritableContext = async (req, res, producerId) => {
    const context = await getContext(req.user.id, producerId);
    if (!context) {
        res.status(403).json({ error: "Contesto produttore non valido" });
        return null;
    }
    if (await isListLocked(context.gas_id)) {
        res.status(423).json({ error: "LISTINO_BLOCCATO: la scadenza per modificare il listino di questo ciclo è passata." });
        return null;
    }
    return context;
};

const isListOpen = async (gasId) => {
    const pool = getDb();
    const [cycles] = await pool.execute(`
        SELECT producers_deadline FROM cycles 
        WHERE gas_id = ? AND is_active = 1 AND delivery_at > NOW() 
        LIMIT 1`, [gasId]);
    if (cycles.length === 0) return false;
    return new Date() < new Date(cycles[0].producers_deadline);
};

// ==================================================================================
// 1. READ DATA (DASHBOARD & PRICE LIST)
// ==================================================================================
router.get('/dashboard-status', async (req, res) => {
    try {
        const pool = getDb();
        const context = await getContext(req.user.id, req.query.producerId);
        if (!context) return res.status(403).json({ error: "Produttore non trovato." });

        const [cycles] = await pool.execute(`
            SELECT id, name, start_at, producers_deadline, market_open_at, market_close_at, delivery_at 
            FROM cycles 
            WHERE gas_id = ? AND is_active = 1 AND delivery_at > NOW() 
            ORDER BY delivery_at ASC LIMIT 1`, [context.gas_id]);

        let notifications = [];
        try {
            // Added 'id' and a filter for unread messages (is_read = 0 or NULL)
            const [msgs] = await pool.execute(`
                SELECT id, title, message, created_at, target_profile 
                FROM notifications 
                WHERE user_id = ? 
                  AND target_profile = 'producer' 
                  AND (is_read = 0 OR is_read IS NULL)
                ORDER BY created_at DESC LIMIT 5
            `, [req.user.id]);
            notifications = msgs;
        } catch (e) {
            console.error("[PROD_DASH] Notifications fetch failed:", e.message);
        }

        if (cycles.length === 0) {
            return res.json({ 
                state: 'NO_CYCLE', 
                message: 'Nessun ciclo attivo.', 
                messages: notifications 
            });
        }

        const c = cycles[0];
        const now = new Date();
        
        // --- STATUS LOGIC ---
        let state = 'WAITING';
        if (now >= new Date(c.start_at) && now < new Date(c.producers_deadline)) state = 'LIST_OPEN';
        else if (now >= new Date(c.producers_deadline) && now < new Date(c.market_close_at)) state = 'WAITING';
        else if (now >= new Date(c.market_close_at)) state = 'ORDERS_RECEIVED';

        // --- NEW LOGIC: PRICE LIST VALIDATION CHECK ---
        let isValidated = false;
        let validatedAt = null;
        try {
            const [val] = await pool.execute(
                "SELECT is_validated, validated_at FROM producer_cycle_validations WHERE producer_id = ? AND cycle_id = ?",
                [context.producer_id, c.id]
            );
            if (val.length > 0) {
                isValidated = val[0].is_validated === 1;
                validatedAt = val[0].validated_at;
            }
        } catch (vErr) {
            console.error("[PROD_DASH] Validation fetch error:", vErr.message);
        }

        // --- COMBINED RESPONSE ---
        res.json({ 
            state, 
            message: state, 
            cycleId: c.id,          
            cycleName: c.name, 
            deadline: c.producers_deadline,
            marketCloseAt: c.market_close_at, 
            deliveryAt: c.delivery_at,        
            producerName: context.business_name, 
            messages: notifications,
            isValidated,            
            validatedAt             
        });
        
    } catch (err) { 
        console.error("[PROD_DASH] Global Error:", err.message);
        res.status(500).json({ error: "Errore sistema dashboard" }); 
    }
});

router.get('/', async (req, res) => {
    try {
        const pool = getDb();
        const context = await getContext(req.user.id, req.query.producerId);
        if (!context) return res.status(403).json({ error: "Accesso negato" });

        // 1. LOAD CYCLE INFO AND VALIDATION (new workflow logic)
        const [cycles] = await pool.execute(`
            SELECT id, producers_deadline FROM cycles 
            WHERE gas_id = ? AND is_active = 1 AND delivery_at > NOW() 
            ORDER BY delivery_at ASC LIMIT 1`, [context.gas_id]);

        let cycleId = null;
        let isValidated = false;
        let validatedAt = null;
        let isListLocked = true;

        if (cycles.length > 0) {
            cycleId = cycles[0].id;
            // Check whether we are past the G2 deadline
            isListLocked = new Date() > new Date(cycles[0].producers_deadline);

            // Check whether the producer has already validated for this cycle
            const [val] = await pool.execute(
                "SELECT is_validated, validated_at FROM producer_cycle_validations WHERE producer_id = ? AND cycle_id = ?",
                [context.producer_id, cycleId]
            );
            
            if (val.length > 0) {
                isValidated = val[0].is_validated === 1;
                validatedAt = val[0].validated_at;
            }
        }

        /**
         * 2. LOAD PRODUCTS with the quantity ordered by members in the current cycle.
         * ordered_qty feeds the producer's "Orders" page (picking list):
         * it sums confirmed orders, excluding cancelled orders and drafts.
         */
        const [products] = await pool.execute(`
            SELECT p.*, u.symbol as unit, c.name as category_name,
                COALESCE((
                    SELECT SUM(oi.quantity)
                    FROM order_items oi
                    JOIN orders o ON o.id = oi.order_id
                    WHERE oi.product_id = p.id
                      AND o.cycle_id = ?
                      AND o.status IN ('confirmed', 'processing', 'delivered')
                ), 0) AS ordered_qty,
                s.confirmed_qty
            FROM products p
            JOIN product_units u ON p.unit_id = u.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            LEFT JOIN producer_cycle_supply s ON s.product_id = p.id AND s.cycle_id = ?
            WHERE p.producer_id = ? ORDER BY p.name ASC`, [cycleId || 0, cycleId || 0, context.producer_id]);

        const [units] = await pool.execute("SELECT id, name, symbol FROM product_units ORDER BY name");
        const [categories] = await pool.execute("SELECT id, name FROM product_categories WHERE gas_id = ?", [context.gas_id]);

        // 3. FULL RESPONSE
        res.json({ 
            products, 
            units, 
            categories, 
            isListLocked, // For backward compatibility with isListOpen
            isLocked: isListLocked, // Name used by the producer's Orders page
            cycleId,      // Needed by the Validate button
            isValidated,  // Needed for the button state
            validatedAt   // Optional, UI info
        });

    } catch (err) { 
        console.error("[PROD_LIST] Error Details:", err.message);
        res.status(500).json({ error: "Errore caricamento listino" }); 
    }
});

/**
 * PATCH /api/products/messages/:id/read
 * Marks a notification as read so it no longer shows up on the dashboard
 */
router.patch('/messages/:id/read', async (req, res) => {
    const pool = getDb();
    try {
        await pool.execute(
            "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("[PROD_MSG] Error marking message as read:", err.message);
        res.status(500).json({ error: "Errore durante l'aggiornamento del messaggio" });
    }
});

// ==================================================================================
// 2. WRITE DATA (CRUD & BULK)
// ==================================================================================

router.post('/', async (req, res) => {
    const pool = getDb();
    const { name, category_id, unit_id, price, stock, min_order_qty, is_active, producerId } = req.body;
    try {
        const context = await getWritableContext(req, res, producerId);
        if (!context) return;

        // 1. Capture the INSERT result
        const [result] = await pool.execute(`
            INSERT INTO products (producer_id, category_id, unit_id, name, price, stock, min_order_qty, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [context.producer_id, category_id || null, unit_id || 1, name, price, stock || null, min_order_qty || 1, is_active ? 1 : 0, req.user.id]
        );
        
        // 2. Revoke the validation
        await pool.execute(`
            DELETE v FROM producer_cycle_validations v
            JOIN cycles c ON v.cycle_id = c.id
            WHERE v.producer_id = ? AND c.is_active = 1 AND c.producers_deadline > NOW()
        `, [context.producer_id]);
        
        // 3. Respond including the newly generated ID
        res.json({ success: true, id: result.insertId });
        
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

router.put('/bulk', async (req, res) => {
    const pool = getDb();
    const { items, producerId } = req.body;
    const conn = await pool.getConnection();
    try {
        const context = await getWritableContext(req, res, producerId);
        if (!context) return;
        if (!Array.isArray(items)) return res.status(400).json({ error: "Formato dati non valido" });
        await conn.beginTransaction();
        
        // 1. Run the bulk updates
        for (const item of items) {
            await conn.execute(`
                UPDATE products 
                SET price = ?, stock = ?, min_order_qty = ?, is_active = ?, updated_at = NOW(), updated_by = ?
                WHERE id = ? AND producer_id = ?`,
                [item.price, item.stock, item.min_order_qty, item.is_active ? 1 : 0, req.user.id, item.id, context.producer_id]
            );
        }
        
        // 2. Revoke the validation INSIDE the transaction, for safety
        await conn.execute(`
            DELETE v FROM producer_cycle_validations v
            JOIN cycles c ON v.cycle_id = c.id
            WHERE v.producer_id = ? 
            AND c.is_active = 1 
            AND c.producers_deadline > NOW()
        `, [context.producer_id]);

        // 3. Commit and respond
        await conn.commit();
        res.json({ success: true }); // RESPONSE SENT ONLY AT THE END

    } catch (e) { 
        await conn.rollback(); 
        res.status(500).json({ error: e.message }); 
    } finally { 
        conn.release(); 
    }
});

router.put('/:id', async (req, res) => {
    const pool = getDb();
    const { name, category_id, unit_id, price, stock, min_order_qty, is_active, producerId } = req.body;
    try {
        const context = await getWritableContext(req, res, producerId);
        if (!context) return;
        
        // 1. Update
        await pool.execute(`
            UPDATE products SET 
                name = ?, category_id = ?, unit_id = ?, price = ?, stock = ?, 
                min_order_qty = ?, is_active = ?, updated_at = NOW(), updated_by = ?
            WHERE id = ? AND producer_id = ?`,
            [name, category_id || null, unit_id || 1, price, stock || null, min_order_qty, is_active ? 1 : 0, req.user.id, req.params.id, context.producer_id]
        );
        
        // 2. Revoke
        await pool.execute(`
            DELETE v FROM producer_cycle_validations v
            JOIN cycles c ON v.cycle_id = c.id
            WHERE v.producer_id = ? AND c.is_active = 1 AND c.producers_deadline > NOW()
        `, [context.producer_id]);

        // 3. Respond
        res.json({ success: true });

    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

router.delete('/:id', async (req, res) => {
    const pool = getDb();
    try {
        const context = await getWritableContext(req, res, req.query.producerId);
        if (!context) return;
        
        // 1. Delete
        await pool.execute("DELETE FROM products WHERE id = ? AND producer_id = ?", [req.params.id, context.producer_id]);
        
        // 2. Revoke
        await pool.execute(`
            DELETE v FROM producer_cycle_validations v
            JOIN cycles c ON v.cycle_id = c.id
            WHERE v.producer_id = ? AND c.is_active = 1 AND c.producers_deadline > NOW()
        `, [context.producer_id]);

        // 3. Respond
        res.json({ success: true });

    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

router.get('/profile', async (req, res) => {
    try {
        const pool = getDb();
        const context = await getContext(req.user.id, req.query.producerId);
        if (!context) return res.status(404).json({ error: "Profilo non trovato" });
        const [rows] = await pool.execute("SELECT p.*, g.name as gas_name, u.email as user_email FROM producers p JOIN gas g ON p.gas_id = g.id JOIN users u ON p.user_id = u.id WHERE p.id = ?", [context.producer_id]);
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: "Errore profilo" }); }
});


/**
 * POST /api/products/confirm-supply
 * The producer confirms how much of each product will actually be delivered, after the
 * market closes (G4) and before delivery (G7).
 *
 * It is deliberately separate from PUT /bulk: that one edits the PRICE LIST and stays
 * locked after the G2 deadline, while this confirmation happens precisely in that window.
 *
 * The confirmed quantity is written to producer_cycle_supply, tied to the cycle:
 * products.stock stays the price list availability and is not touched.
 */
router.post('/confirm-supply', async (req, res) => {
    const pool = getDb();
    const { producerId, items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Nessuna quantità da confermare." });
    }

    try {
        const context = await getContext(req.user.id, producerId);
        if (!context) return res.status(403).json({ error: "Contesto produttore non valido" });

        // Confirmation is possible only between market closing and delivery
        const [cycles] = await pool.execute(`
            SELECT id, name FROM cycles
            WHERE gas_id = ? AND is_active = 1
              AND market_close_at <= NOW() AND delivery_at > NOW()
            ORDER BY delivery_at ASC LIMIT 1`, [context.gas_id]);

        if (cycles.length === 0) {
            return res.status(423).json({ error: "FUORI_FINESTRA: la conferma della fornitura è possibile solo dopo la chiusura del mercato e prima della consegna." });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            let updated = 0;
            for (const item of items) {
                const qty = Number(item.qty);
                if (!Number.isFinite(qty) || qty < 0) {
                    throw new Error(`QUANTITA_NON_VALIDA: prodotto ID ${item.id}`);
                }
                // The SELECT on products guarantees that the product belongs to this producer.
                // ON DUPLICATE: a new confirmation replaces the previous one for the same cycle.
                const [r] = await conn.execute(`
                    INSERT INTO producer_cycle_supply (cycle_id, product_id, confirmed_qty, confirmed_by)
                    SELECT ?, p.id, ?, ? FROM products p WHERE p.id = ? AND p.producer_id = ?
                    ON DUPLICATE KEY UPDATE confirmed_qty = VALUES(confirmed_qty), confirmed_by = VALUES(confirmed_by)`,
                    [cycles[0].id, qty, req.user.id, item.id, context.producer_id]
                );
                if (r.affectedRows > 0) updated++;
            }
            await conn.commit();
            res.json({ success: true, updated, cycleId: cycles[0].id });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (err) {
        const isBusiness = /^QUANTITA_NON_VALIDA/.test(err.message);
        console.error("[PROD_SUPPLY] Error:", err.message);
        res.status(isBusiness ? 400 : 500).json({ error: isBusiness ? err.message : "Errore durante la conferma della fornitura." });
    }
});

/**
 * POST /api/products/validate-list
 * Lets the producer validate their price list for the current cycle.
 */
router.post('/validate-list', async (req, res) => {
    const pool = getDb();
    const userId = req.user.id;
    const { producerId, cycleId } = req.body;

    if (!producerId || !cycleId) {
        return res.status(400).json({ error: "Dati incompleti per la validazione." });
    }

    try {
        // Check that the producer actually belongs to the user
        const context = await getContext(userId, producerId);
        if (!context) return res.status(403).json({ error: "Accesso negato." });

        const query = `
            INSERT INTO producer_cycle_validations (producer_id, cycle_id, is_validated, validated_at)
            VALUES (?, ?, 1, NOW())
            ON DUPLICATE KEY UPDATE is_validated = 1, validated_at = NOW()
        `;

        await pool.execute(query, [producerId, cycleId]);
        
        res.json({ success: true, message: "Listino validato con successo." });
    } catch (err) {
        console.error("[PROD_VALIDATE] Error:", err.message);
        res.status(500).json({ error: "Errore durante la validazione del listino." });
    }
});

module.exports = router;