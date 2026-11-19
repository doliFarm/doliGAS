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
 * @file backend/routes/members.js
 * @version v1.2.6
 * @author Luigi GRILLO @ doliFarm.com
 * @description Member area API: dashboard, shop, orders and wallet.
 * STATUS: Stable.
 * FIX: aligned with schema v22.0 enums (confirmed/SPESA), fixed error 500.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');
const { notifyCoordinatorRaw } = require('../utils/notifications');

/**
 * Helper returning the singleton connection pool.
 */
const getDb = () => global.pool || require('../config/db');

/**
 * Helper extracting the gasId (multi-level fallback).
 */
const getGasId = (req) => {
    const id = req.user?.verifiedGasId || req.query?.gasId || req.body?.gasId || req.user?.gas_id;
    return (id && id !== 'undefined' && id !== 'null') ? parseInt(id) : null;
};

// All routes require JWT authentication
router.use(authenticateToken);

// --- MIDDLEWARE: GAS membership check ---
const ensureMembership = async (req, res, next) => {
    const gasId = getGasId(req);
    if (!gasId) return res.status(400).json({ error: "Contesto GAS mancante" });

    const pool = getDb();
    try {
        const [rows] = await pool.execute(
            "SELECT 1 FROM gas_memberships WHERE user_id = ? AND gas_id = ? AND is_active = 1", 
            [req.user.id, gasId]
        );
        if (rows.length === 0) return res.status(403).json({ error: "Accesso negato o utente sospeso in questo GAS" });
        
        req.gasId = gasId; 
        next();
    } catch (e) {
        res.status(500).json({ error: "Errore verifica sicurezza membership" });
    }
};

// =============================================================================
// 1. DASHBOARD HOME
// =============================================================================

router.get('/dashboard', ensureMembership, async (req, res) => {
  try {
    const pool = getDb();
    const userId = req.user.id;
    const gasId = req.gasId;

    // A. Current balance
    const [membership] = await pool.execute(
        "SELECT balance FROM gas_memberships WHERE user_id = ? AND gas_id = ?", 
        [userId, gasId]
    );
    const balance = parseFloat(membership[0]?.balance || 0);

    // B. Active cycle (next delivery)
    const [cycles] = await pool.execute(`
        SELECT id, name, delivery_at, market_open_at, market_close_at 
        FROM cycles 
        WHERE gas_id = ? AND is_active = 1 AND delivery_at >= NOW() 
        ORDER BY delivery_at ASC LIMIT 1`, 
        [gasId]
    );
    
    const nextCycle = cycles[0] || null;
    let marketStatus = 'CLOSED';

    if (nextCycle) {
        const now = new Date();
        const open = new Date(nextCycle.market_open_at);
        const close = new Date(nextCycle.market_close_at);
        if (now >= open && now < close) marketStatus = 'OPEN';
        else if (now < open) marketStatus = 'COMING_SOON';
    }

    // C. Last order data
    const [orders] = await pool.execute(`
        SELECT id, status, total_amount, created_at
        FROM orders 
        WHERE user_id = ? AND gas_id = ?
        ORDER BY created_at DESC LIMIT 1`, 
        [userId, gasId]
    );

    let lastOrderData = null;
    if (orders.length > 0) {
        const order = orders[0];
        const [counts] = await pool.execute("SELECT COUNT(*) as cnt FROM order_items WHERE order_id = ?", [order.id]);
        lastOrderData = { 
            id: order.id,
            status: order.status, 
            total_amount: order.total_amount, 
            items_count: counts[0].cnt,
            date: order.created_at
        };
    }

    // D. Notifications (last 3)
    let messages = [];
    try {
       const [msgs] = await pool.execute(`
          SELECT title as subject, message, created_at, type, is_read
          FROM notifications 
          WHERE user_id = ?  AND target_profile = 'member' 
          ORDER BY created_at DESC LIMIT 3
       `, [userId]);
       messages = msgs;
    } catch(e) {}

    res.json({
        balance,
        nextDelivery: nextCycle ? nextCycle.delivery_at : null,
        nextDeliveryName: nextCycle ? nextCycle.name : 'Nessuna consegna prevista',
        marketStatus,
        marketClosesAt: nextCycle ? nextCycle.market_close_at : null,
        lastOrder: lastOrderData,
        messages
    });

  } catch (err) {
    console.error("[MEMBER_DASH] Error:", err.message);
    res.status(500).json({ error: "Errore caricamento dati dashboard" });
  }
});

// =============================================================================
// 2. SHOP (CATALOG) - FIX: price list validation filter v23.0
// =============================================================================

router.get('/shop', ensureMembership, async (req, res) => {
    try {
        const pool = getDb();
        const gasId = req.gasId;

        // 1. Load the active cycle
        const [cycles] = await pool.execute(`
            SELECT id, market_open_at, market_close_at 
            FROM cycles 
            WHERE gas_id = ? AND is_active = 1 AND delivery_at > NOW() 
            ORDER BY delivery_at ASC LIMIT 1`, 
            [gasId]
        );

        if (cycles.length === 0) {
            return res.json({ isOpen: false, cycleId: null, products: [] });
        }

        const cycleId = cycles[0].id;
        const now = new Date();
        const isOpen = now >= new Date(cycles[0].market_open_at) && now < new Date(cycles[0].market_close_at);

        /**
         * 2. Load the products filtered by PRICE LIST VALIDATION
         * INNER JOIN on the validations table:
         * if the producer has not validated this specific cycleId,
         * its products disappear from the members' catalog.
         */
        const query = `
            SELECT 
                p.id, p.name, p.price, p.stock, 
                -- Disponibile per questo socio: stock del listino meno quanto hanno già
                -- ordinato gli altri nel ciclo (NULL = illimitato). Stesso calcolo di POST /order.
                CASE WHEN p.stock IS NULL THEN NULL ELSE GREATEST(0, p.stock - COALESCE((
                    SELECT SUM(oi.quantity) FROM order_items oi
                    JOIN orders o ON o.id = oi.order_id
                    WHERE oi.product_id = p.id AND o.cycle_id = ? AND o.user_id <> ?
                      AND o.status IN ('confirmed', 'processing', 'delivered')
                ), 0)) END AS available,
                u.symbol as unit, 
                pr.business_name as producer,
                pc.name as category 
            FROM products p
            JOIN producers pr ON p.producer_id = pr.id
            JOIN product_units u ON p.unit_id = u.id
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            -- IL CUORE DEL FIX:
            INNER JOIN producer_cycle_validations v ON p.producer_id = v.producer_id
            WHERE pr.gas_id = ? 
              AND p.is_active = 1 
              AND pr.is_active = 1
              AND v.cycle_id = ? 
              AND v.is_validated = 1
            ORDER BY pc.name ASC, p.name ASC
        `;

        const [products] = await pool.execute(query, [cycleId, req.user.id, gasId, cycleId]);

        // mysql2 returns DECIMAL values as strings: the frontend compares available with numbers
        for (const p of products) {
            if (p.available !== null) p.available = Number(p.available);
        }

        res.json({ isOpen, cycleId, products });

    } catch (err) {
        console.error("[MEMBER_SHOP] Error:", err.message);
        res.status(500).json({ error: "Errore caricamento listino prodotti" });
    }
});

// =============================================================================
// 3. ORDER MANAGEMENT (CHECKOUT)
// =============================================================================

router.post('/order', ensureMembership, async (req, res) => {
    const { cycleId, items } = req.body; 
    const userId = req.user.id;
    const gasId = req.gasId;
    const pool = getDb();

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Carrello vuoto" });
    }

    const conn = await pool.getConnection();
    try {
        // READ COMMITTED (for this transaction only): after the lock on the product, the sum
        // of the quantities already ordered must see orders just confirmed by others.
        // With REPEATABLE READ it would read the snapshot taken at the first SELECT.
        await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
        await conn.beginTransaction();

        // SECURITY: the cycle must belong to the GAS, be active and have the market open
        const [openCycle] = await conn.execute(
            `SELECT id FROM cycles
             WHERE id = ? AND gas_id = ? AND is_active = 1
               AND NOW() >= market_open_at AND NOW() < market_close_at`,
            [cycleId || 0, gasId]
        );
        if (openCycle.length === 0) throw new Error("MERCATO_CHIUSO: il ciclo non è aperto agli ordini.");

        // Quantity validation (positive numbers). Lines for the same product are
        // summed and products sorted by id: the FOR UPDATE locks on stock are always
        // taken in the same order, so two parallel orders cannot deadlock each other.
        const merged = new Map();
        for (const item of items) {
            const q = Number(item.qty);
            const pid = Number(item.productId);
            if (!Number.isFinite(q) || q <= 0) throw new Error(`QUANTITA_NON_VALIDA: articolo ID ${item.productId}`);
            merged.set(pid, (merged.get(pid) || 0) + q);
        }
        const cartItems = [...merged.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([productId, qty]) => ({ productId, qty }));

        // A. GAS configuration (trust/prepaid)
        const [gasConfig] = await conn.execute("SELECT allow_insufficient_balance FROM gas WHERE id = ?", [gasId]);
        const canGoNegative = gasConfig.length > 0 && gasConfig[0].allow_insufficient_balance === 1;

       // B. Check current prices, availability and PRICE LIST VALIDATION
        let newTotal = 0;
        const validatedItems = [];
        const stockShortages = [];

        for (const item of cartItems) {
            // Hardened query: check is_active of the product and of the producer
            // and above all the price list validation for this specific cycle
            const [pRow] = await conn.execute(`
                SELECT p.name, p.price, p.stock, p.is_active
                FROM products p
                JOIN producers pr ON p.producer_id = pr.id
                INNER JOIN producer_cycle_validations v ON p.producer_id = v.producer_id
                WHERE p.id = ? 
                  AND v.cycle_id = ? 
                  AND v.is_validated = 1 
                  AND p.is_active = 1 
                  AND pr.is_active = 1
                  AND pr.gas_id = ?
            `, [item.productId, cycleId, gasId]);

            if (pRow.length === 0) {
                // The product does not exist, is not active, or the producer has not validated the price list
                throw new Error(`PRODOTTO_NON_DISPONIBILE: L'articolo ID ${item.productId} non è acquistabile in questo ciclo.`);
            }
            
            // Stock: products.stock is the price list cap for the cycle (NULL = unlimited).
            // It is never decremented: availability is computed by subtracting what the other
            // members have already ordered in the cycle. The member's own order does not count,
            // because it is about to be replaced by this one.
            if (pRow[0].stock !== null) {
                // Lock on the product row: two members cannot take the last unit at the same time
                await conn.execute("SELECT id FROM products WHERE id = ? FOR UPDATE", [item.productId]);
                const [used] = await conn.execute(`
                    SELECT
                        COALESCE(SUM(CASE WHEN o.user_id <> ? THEN oi.quantity END), 0) AS others,
                        COALESCE(SUM(CASE WHEN o.user_id = ? THEN oi.quantity END), 0) AS mine
                    FROM order_items oi
                    JOIN orders o ON o.id = oi.order_id
                    WHERE oi.product_id = ? AND o.cycle_id = ?
                      AND o.status IN ('confirmed', 'processing', 'delivered')`,
                    [userId, userId, item.productId, cycleId]
                );
                const available = Math.max(0, Number(pRow[0].stock) - Number(used[0].others));
                // If the stock was lowered after the order, the member can still confirm or
                // reduce the quantity already ordered: only an increase beyond availability is blocked.
                if (item.qty > available && item.qty > Number(used[0].mine)) {
                    stockShortages.push({ productId: item.productId, name: pRow[0].name, requested: item.qty, available });
                }
            }

            const price = parseFloat(pRow[0].price);
            newTotal += price * item.qty;
            validatedItems.push({ ...item, price });
        }

        if (stockShortages.length > 0) {
            const err = new Error("STOCK_INSUFFICIENTE: " + stockShortages.map(s => `${s.name} (disponibili ${s.available})`).join(', '));
            err.details = stockShortages;
            throw err;
        }

        // C. Current state (both wallet and any existing order)
        // 'confirmed' because since v22.0 submitting moves the order from draft to confirmed
        const [existing] = await conn.execute(
            "SELECT id, total_amount FROM orders WHERE user_id = ? AND cycle_id = ? AND status = 'confirmed' FOR UPDATE", 
            [userId, cycleId]
        );
        
        const [wallet] = await conn.execute(
            "SELECT balance FROM gas_memberships WHERE user_id = ? AND gas_id = ? FOR UPDATE", 
            [userId, gasId]
        );
        
        const currentBalance = parseFloat(wallet[0]?.balance || 0);
        let orderId;
        let delta = 0; 

        if (existing.length > 0) {
            orderId = existing[0].id;
            delta = newTotal - parseFloat(existing[0].total_amount);
        } else {
            delta = newTotal;
        }

        // D. Wallet capacity check (zero-inference rule)
        if (delta > 0 && currentBalance < delta && !canGoNegative) {
            throw new Error("INSUFFICIENT_FUNDS"); 
        }

        // E. Wallet movement (schema v22.0: type 'SPESA')
        if (delta !== 0) {
            await conn.execute(
                "UPDATE gas_memberships SET balance = balance - ?, updated_at = NOW() WHERE user_id = ? AND gas_id = ?",
                [delta, userId, gasId]
            );

            await conn.execute(`
                INSERT INTO wallet_transactions (gas_id, user_id, amount, type, status, description, created_at) 
                VALUES (?, ?, ?, 'SPESA', 'completed', ?, NOW())
            `, [gasId, userId, -delta, existing.length > 0 ? `Aggiornamento Ordine #${orderId}` : `Nuovo Ordine Ciclo #${cycleId}`]);
        }

        // F. Write the order (schema v22.0: status 'confirmed')
        if (existing.length > 0) {
            await conn.execute("DELETE FROM order_items WHERE order_id = ?", [orderId]);
            await conn.execute("UPDATE orders SET total_amount = ?, updated_at = NOW() WHERE id = ?", [newTotal, orderId]);
        } else {
            const [resOrder] = await conn.execute(
                "INSERT INTO orders (user_id, gas_id, cycle_id, status, total_amount, created_at) VALUES (?, ?, ?, 'confirmed', ?, NOW())", 
                [userId, gasId, cycleId, newTotal]
            );
            orderId = resOrder.insertId;
        }

        // G. Write the lines
        for (const vItem of validatedItems) {
            await conn.execute(
                "INSERT INTO order_items (order_id, product_id, quantity, price_at_order) VALUES (?, ?, ?, ?)",
                [orderId, vItem.productId, vItem.qty, vItem.price]
            );
        }

        await conn.commit();
        res.json({ success: true, orderId, newBalance: currentBalance - delta });

    } catch (err) {
        if (conn) await conn.rollback();
        const businessErrors = ["INSUFFICIENT_FUNDS", "MERCATO_CHIUSO", "QUANTITA_NON_VALIDA", "PRODOTTO_NON_DISPONIBILE"];
        if (err.message.startsWith("STOCK_INSUFFICIENTE")) {
            // 409: the request is valid but conflicts with what others have already ordered
            return res.status(409).json({ error: "STOCK_INSUFFICIENTE", message: err.message, details: err.details || [] });
        }
        const status = businessErrors.some(code => err.message.startsWith(code)) ? 400 : 500;
        console.error("[MEMBER_ORDER] Crash:", err.message);
        res.status(status).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// =============================================================================
// 4. WALLET & HISTORY
// =============================================================================

router.get('/wallet', ensureMembership, async (req, res) => {
    try {
        const pool = getDb();
        const [txs] = await pool.execute(`
            SELECT id, amount, type, status, description, created_at 
            FROM wallet_transactions 
            WHERE user_id = ? AND gas_id = ?
            ORDER BY created_at DESC LIMIT 50`, 
            [req.user.id, req.gasId]
        );
        res.json(txs);
    } catch (err) { res.status(500).json({ error: "Errore recupero movimenti wallet" }); }
});

router.get('/orders', ensureMembership, async (req, res) => {
    try {
        const pool = getDb();
        const [orders] = await pool.execute(`
            SELECT o.id, o.status, o.total_amount, o.created_at, c.name as cycle_name
            FROM orders o
            JOIN cycles c ON o.cycle_id = c.id
            WHERE o.user_id = ? AND o.gas_id = ?
            ORDER BY o.created_at DESC
        `, [req.user.id, req.gasId]);
        res.json(orders);
    } catch (err) { res.status(500).json({ error: "Errore recupero storico ordini" }); }
});

router.get('/orders/:id', ensureMembership, async (req, res) => {
    try {
        const pool = getDb();
        const [orders] = await pool.execute(`
            SELECT o.id, o.status, o.total_amount, o.created_at, c.name as cycle_name
            FROM orders o
            JOIN cycles c ON o.cycle_id = c.id
            WHERE o.id = ? AND o.user_id = ? AND o.gas_id = ?
        `, [req.params.id, req.user.id, req.gasId]);

        if (orders.length === 0) return res.status(404).json({ error: "Ordine non trovato" });

        const [items] = await pool.execute(`
            SELECT oi.quantity, oi.price_at_order, p.name as product_name, u.symbol as unit
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN product_units u ON p.unit_id = u.id
            WHERE oi.order_id = ?
        `, [req.params.id]);

        res.json({ ...orders[0], items });
    } catch (err) { res.status(500).json({ error: "Errore dettaglio ordine" }); }
});


// =============================================================================
// 5. WALLET TOP-UP REQUEST
// =============================================================================

/**
 * POST /api/members/wallet/topup-request
 * The member declares a payment (bank transfer or cash): a pending transaction
 * is created, which the coordinator approves from their area.
 * The balance does NOT change here: it changes only on approval.
 */
router.post('/wallet/topup-request', ensureMembership, async (req, res) => {
    const pool = getDb();
    const { amount, description } = req.body;
    const userId = req.user.id;
    const gasId = req.gasId;

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
        return res.status(400).json({ error: "IMPORTO_NON_VALIDO: indica una cifra maggiore di zero." });
    }
    if (value > 10000) {
        return res.status(400).json({ error: "IMPORTO_NON_VALIDO: cifra troppo alta, contatta il coordinatore." });
    }

    try {
        // One pending request at a time, so the coordinator's queue does not fill up
        const [pending] = await pool.execute(
            "SELECT id FROM wallet_transactions WHERE user_id = ? AND gas_id = ? AND status = 'pending' AND type = 'DEPOSIT'",
            [userId, gasId]
        );
        if (pending.length > 0) {
            return res.status(409).json({ error: "RICHIESTA_GIA_PRESENTE: hai già una ricarica in attesa di approvazione." });
        }

        const note = String(description || '').trim().substring(0, 500) || 'Ricarica dichiarata dal socio';
        const [result] = await pool.execute(`
            INSERT INTO wallet_transactions
                (gas_id, user_id, amount, type, status, description, created_at, created_by)
            VALUES (?, ?, ?, 'DEPOSIT', 'pending', ?, NOW(), ?)`,
            [gasId, userId, value, note, userId]
        );

        // Notify the coordinator, so they do not have to check the page by hand
        try {
            const [user] = await pool.execute("SELECT first_name, last_name FROM users WHERE id = ?", [userId]);
            const who = user.length ? `${user[0].first_name} ${user[0].last_name}` : `utente #${userId}`;
            await notifyCoordinatorRaw(
                gasId,
                'Nuova ricarica da approvare',
                `${who} ha dichiarato una ricarica di ${value.toFixed(2)} €. Verifica l'accredito e approvala dall'area soci.`,
                'info'
            );
        } catch (e) {
            console.error("[MEMBER_TOPUP] Notifica al coordinatore non inviata:", e.message);
        }

        res.json({ success: true, transactionId: result.insertId, status: 'pending' });
    } catch (err) {
        console.error("[MEMBER_TOPUP] Error:", err.message);
        res.status(500).json({ error: "Errore nella registrazione della richiesta." });
    }
});

/**
 * DELETE /api/members/wallet/topup-request/:id
 * The member cancels their own request, while it is still pending.
 */
router.delete('/wallet/topup-request/:id', ensureMembership, async (req, res) => {
    const pool = getDb();
    try {
        const [result] = await pool.execute(
            "DELETE FROM wallet_transactions WHERE id = ? AND user_id = ? AND gas_id = ? AND status = 'pending'",
            [req.params.id, req.user.id, req.gasId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Richiesta non trovata o già processata." });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Errore nell'annullamento della richiesta." });
    }
});

// =============================================================================
// 6. USER PROFILE
// =============================================================================


router.get('/profile', ensureMembership, async (req, res) => {
    try {
        const pool = getDb();
        const [rows] = await pool.execute(`
            SELECT u.id, u.first_name, u.last_name, u.email, u.phone, 
                   g.name as gas_name, r.name as role_name,
                   gm.balance, gm.address, gm.internal_notes
            FROM users u
            JOIN gas_memberships gm ON u.id = gm.user_id
            JOIN gas g ON gm.gas_id = g.id
            JOIN roles r ON gm.role_id = r.id
            WHERE u.id = ? AND gm.gas_id = ?
        `, [req.user.id, req.gasId]);

        if (rows.length === 0) return res.status(404).json({ error: "Utente non trovato" });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: "Errore recupero profilo" }); }
});

module.exports = router;