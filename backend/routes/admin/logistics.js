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
const { allocateProportionally } = require('../../utils/allocation');

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
    const { cycleId, items } = req.body;
    const gasId = req.user.verifiedGasId; // SICUREZZA: mai il gasId del body
    const adminId = req.user.id;

    try {
        await conn.beginTransaction();

        for (const update of items) {
            const { productId, totalReceived } = update;

            const received = Number(totalReceived);
            if (!Number.isFinite(received) || received < 0) {
                throw new Error(`QUANTITA_NON_VALIDA: peso ricevuto non valido per il prodotto ID ${productId}`);
            }

            // Recupera tutti gli item per quel prodotto in quel ciclo, più l'unità di misura
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
             * Ripartizione proporzionale con il metodo dei resti maggiori: la somma delle
             * quote è esattamente il totale ricevuto, senza frazioni perse per arrotondamento.
             * Le unità discrete (pezzi, bottiglie) sono ripartite in numeri interi.
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
 * Finalizza l'ordine con il CONGUAGLIO sul peso reale e sposta lo stato a 'delivered'.
 * Modello wallet: l'importo ordinato è già stato scalato al momento dell'ordine
 * (routes/members.js). Qui si regola solo la differenza tra totale reale e totale ordinato:
 *   - differenza > 0 -> addebito aggiuntivo (SPESA)
 *   - differenza < 0 -> restituzione al socio (REFUND)
 */
router.post('/checkout/deliver', async (req, res) => {
    const pool = getDb();
    const conn = await pool.getConnection();
    const { orderId } = req.body;
    const gasId = req.user.verifiedGasId; // SICUREZZA: mai il gasId del body
    const adminId = req.user.id;

    try {
        await conn.beginTransaction();

        // 1. Recupero dati ordine e item per ricalcolo finale
        const [orderRows] = await conn.execute("SELECT user_id, status, total_amount FROM orders WHERE id = ? AND gas_id = ? FOR UPDATE", [orderId, gasId]);
        if (orderRows.length === 0) throw new Error("Ordine non trovato.");
        if (orderRows[0].status === 'delivered') throw new Error("Ordine già consegnato.");
        if (!['confirmed', 'processing'].includes(orderRows[0].status)) throw new Error("Ordine non consegnabile nello stato attuale.");

        const [items] = await conn.execute("SELECT qty_received, quantity, price_at_order FROM order_items WHERE order_id = ?", [orderId]);

        // Calcolo in centesimi per evitare errori di arrotondamento
        const toCents = (v) => Math.round(parseFloat(v) * 100);
        const realTotalCents = items.reduce((sum, it) => {
            const qty = parseFloat(it.qty_received ?? it.quantity);
            return sum + Math.round(qty * parseFloat(it.price_at_order) * 100);
        }, 0);
        const realTotal = realTotalCents / 100;
        const chargedTotal = toCents(orderRows[0].total_amount) / 100;
        const adjustment = (realTotalCents - toCents(orderRows[0].total_amount)) / 100;

        // 2. Conguaglio Wallet Socio (solo la differenza, con traccia nel registro movimenti)
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

        // 3. Aggiornamento stato ordine
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