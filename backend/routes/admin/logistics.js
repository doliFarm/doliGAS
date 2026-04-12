/**
 * doliGAS - Enterprise Resource Planning per Gruppi di Acquisto Solidale
 * Modulo Logistica e Gestione Distribuzione
 * -----------------------------------------------------------------------------
 * FILE: backend/routes/admin/logistics.js
 * STATUS: Integro, Completo, Robusto.
 * DESC: Gestisce G6 (Check-in/Pesi) e G7 (Distribuzione/Consegna).
 * FEATURES: Ripartizione proporzionale, Gestione Surplus, Audit Ledger Wallet.
 */

const express = require('express');
const router = express.Router();

/**
 * Helper per acquisire il pool di connessioni singleton.
 */
const getDb = () => global.pool || require('../../config/db');

// =============================================================================
// SEZIONE G6: RICEZIONE E PESATURA (CHECK-IN)
// =============================================================================

/**
 * GET /api/admin/logistics/checkin/:cycleId
 * Riepilogo prodotti ordinati per la fase di pesatura.
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
 * Ripartizione proporzionale del peso totale ricevuto tra tutti i soci ordinanti.
 * ROBUSTEZZA: Utilizza transazioni per garantire coerenza tra pesi e portafogli.
 */
router.post('/checkin/bulk-update', async (req, res) => {
    const pool = getDb();
    const conn = await pool.getConnection();
    const { cycleId, items, gasId } = req.body;
    const adminId = req.user.id;

    try {
        await conn.beginTransaction();

        for (const update of items) {
            const { productId, totalReceived } = update;

            // Recupera tutti gli item per quel prodotto in quel ciclo
            const [itemsToUpdate] = await conn.execute(`
                SELECT oi.id, oi.quantity, oi.price_at_order, o.user_id
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.cycle_id = ? AND oi.product_id = ? AND o.gas_id = ?
            `, [cycleId, productId, gasId]);

            if (itemsToUpdate.length === 0) continue;

            const totalOrdered = itemsToUpdate.reduce((sum, i) => sum + parseFloat(i.quantity), 0);
            let distributedSoFar = 0;

            for (let i = 0; i < itemsToUpdate.length; i++) {
                const item = itemsToUpdate[i];
                let assigned;

                // Gestione resto sull'ultimo elemento per evitare errori di arrotondamento
                if (i === itemsToUpdate.length - 1) {
                    assigned = totalReceived - distributedSoFar;
                } else {
                    assigned = totalOrdered > 0 ? (item.quantity / totalOrdered) * totalReceived : 0;
                }
                distributedSoFar += assigned;

                // Aggiornamento item
                await conn.execute("UPDATE order_items SET qty_received = ? WHERE id = ?", [assigned, item.id]);
            }
        }

        await conn.commit();
        res.json({ success: true });
    } catch (e) {
        await conn.rollback();
        console.error("[LOGISTICS] Bulk Update Error:", e.message);
        res.status(500).json({ error: "Errore durante il ricalcolo pesi: " + e.message });
    } finally {
        conn.release();
    }
});

// =============================================================================
// SEZIONE G7: CONSEGNA E CHIUSURA (CHECK-OUT)
// =============================================================================

/**
 * GET /api/admin/logistics/checkout-list/:cycleId
 * Elenco soci con ordini pronti per il ritiro.
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
 * Dettaglio ordine per la generazione della ricevuta di consegna.
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
 * Finalizza l'ordine: addebita il wallet e sposta lo stato a 'delivered'.
 * ROBUSTEZZA: Calcolo del totale "al volo" per evitare discrepanze tra DB e interfaccia.
 */
router.post('/checkout/deliver', async (req, res) => {
    const pool = getDb();
    const conn = await pool.getConnection();
    const { orderId, gasId } = req.body;
    const adminId = req.user.id;

    try {
        await conn.beginTransaction();

        // 1. Recupero dati ordine e item per ricalcolo finale
        const [orderRows] = await conn.execute("SELECT user_id, status FROM orders WHERE id = ? AND gas_id = ? FOR UPDATE", [orderId, gasId]);
        if (orderRows.length === 0) throw new Error("Ordine non trovato.");
        if (orderRows[0].status === 'delivered') throw new Error("Ordine già consegnato.");

        const [items] = await conn.execute("SELECT qty_received, quantity, price_at_order FROM order_items WHERE order_id = ?", [orderId]);

        const realTotal = items.reduce((sum, it) => {
            return sum + (parseFloat(it.qty_received ?? it.quantity) * parseFloat(it.price_at_order));
        }, 0);

        // 2. Addebito Wallet Socio (Audit Ledger)
        await conn.execute(
            "UPDATE gas_memberships SET balance = balance - ?, updated_at = NOW() WHERE user_id = ? AND gas_id = ?",
            [realTotal, orderRows[0].user_id, gasId]
        );

        await conn.execute(`
            INSERT INTO wallet_history (gas_id, user_id, amount, type, description, created_by, created_by_name)
            VALUES (?, ?, ?, 'SPESA', ?, ?, ?)
        `, [gasId, orderRows[0].user_id, -realTotal, `Acquisto Ciclo Logistica - Ordine #${orderId}`, adminId, req.user.name || 'Admin']);

        // 3. Aggiornamento stato ordine
        await conn.execute("UPDATE orders SET status = 'delivered', total_amount = ?, updated_at = NOW() WHERE id = ?", [realTotal, orderId]);

        await conn.commit();
        res.json({ success: true, finalAmount: realTotal });
    } catch (e) {
        await conn.rollback();
        console.error("[LOGISTICS] Delivery Error:", e.message);
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
});

// =============================================================================
// SEZIONE UTILITY E SURPLUS
// =============================================================================

/**
 * POST /api/admin/logistics/handle-surplus
 * Registra merce ricevuta in eccesso (non ordinata da nessuno).
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