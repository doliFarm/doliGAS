/* =============================================================================
   FILE: backend/routes/member_app.js - v1.0
   STATUS: Integro, Completo, Robusto.
   DESC: API Verticali per l'App Socio (Dashboard, Shop, Wallet).
   SICUREZZA: Tutte le rotte richiedono authenticateToken.
   ============================================================================= */

const express = require('express');
const router = express.Router();
const pool = global.pool; // Usa il pool globale (definito in server.js)

// IMPORT MIDDLEWARE
const { authenticateToken } = require('../middlewares/auth');

// 1. SICUREZZA GLOBALE
// Tutte le chiamate a /api/member-app/* devono essere autenticate
router.use(authenticateToken);

// 2. MIDDLEWARE CONTROLLO RUOLO SOCIO
// Opzionale: blocchiamo chi non è Socio? 
// Per ora lasciamo aperto anche a Coord/Prod che vogliono vedere la view socio.
// Se volessimo restringere:
/*
router.use((req, res, next) => {
    // Permettiamo a tutti i ruoli di vedere la dashboard socio per test
    next();
});
*/

// --- DASHBOARD HOME ---
router.get('/dashboard-stats', async (req, res) => {
    const userId = req.user.id;
    const gasId = req.user.gasId;

    try {
        // A. Saldo Wallet
        // Nota: Assumiamo che il saldo sia nella tabella memberships
        const [wallet] = await pool.execute(
            "SELECT balance FROM gas_memberships WHERE user_id = ? AND gas_id = ?", 
            [userId, gasId]
        );
        const balance = wallet.length ? parseFloat(wallet[0].balance) : 0;
        
        // B. Ciclo Attivo
        const [cycle] = await pool.execute(
            "SELECT * FROM cycles WHERE gas_id = ? AND is_active = 1 LIMIT 1", 
            [gasId]
        );
        
        let activeCycle = null;
        let alertClosing = false;
        let draftOrder = null;

        if (cycle.length > 0) {
            activeCycle = cycle[0];
            
            // C. Ordine in Bozza (se esiste per questo ciclo)
            const [order] = await pool.execute(
                "SELECT id, total_amount, status FROM orders WHERE user_id = ? AND cycle_id = ? AND status = 'draft'", 
                [userId, activeCycle.id]
            );
            
            if (order.length > 0) {
                draftOrder = order[0];
            }

            // D. Alert Chiusura (se mancano meno di 3 ore)
            // Calcolo differenza ore
            const now = new Date();
            const closeDate = new Date(activeCycle.market_close_at);
            const diffMs = closeDate - now;
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours > 0 && diffHours < 3) {
                alertClosing = true;
            }
        }
        
        // E. Notifiche Non Lette
        let unreadNotifications = 0;
        // Controllo difensivo se la tabella notifiche non esiste ancora
        try {
            const [notif] = await pool.execute(
                "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0  AND target_profile = 'member' ", 
                [userId]
            );
            unreadNotifications = notif[0].count;
        } catch (e) {
            // Tabella non esiste o errore query, ignoriamo silenziosamente
        }

        res.json({
            balance,
            activeCycle,
            draftOrder,
            unreadNotifications,
            alertClosing
        });

    } catch (e) { 
        console.error("[Dashboard Error]", e);
        res.status(500).json({ error: "Errore caricamento dashboard" }); 
    }
});

// --- SHOP (LISTINO) ---
router.get('/shop', async (req, res) => {
    const userId = req.user.id;
    const gasId = req.user.gasId;

    try {
        // 1. Cerca ciclo attivo
        const [cycle] = await pool.execute("SELECT id FROM cycles WHERE gas_id = ? AND is_active = 1", [gasId]);
        
        if (cycle.length === 0) {
            return res.json({ products: [], isOpen: false });
        }
        const cycleId = cycle[0].id;
        
        // 2. Recupera prodotti con quantità già nel carrello (LEFT JOIN)
        // Questa query è "Integra": unisce prodotti, categorie, produttori e carrello attuale
        const query = `
            SELECT 
                p.id, p.name, p.price, p.description, 
                u.symbol as unit, u.is_discrete, 
                pr.business_name as producer_name, 
                pc.name as category_name, 
                COALESCE(oi.quantity, 0) as cart_qty
            FROM products p 
            JOIN producers pr ON p.producer_id = pr.id 
            JOIN product_categories pc ON p.category_id = pc.id 
            LEFT JOIN product_units u ON p.unit_id = u.id
            -- Join complessa per trovare la quantità nel carrello bozza dell'utente
            LEFT JOIN orders o ON o.cycle_id = ? AND o.user_id = ? AND o.status = 'draft' 
            LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.product_id = p.id
            WHERE p.is_active = 1 AND p.gas_id = ? 
            ORDER BY pc.name ASC, p.name ASC`;
            
        const [products] = await pool.execute(query, [cycleId, userId, gasId]);
        
        res.json({ products, isOpen: true, cycleId });

    } catch (e) { 
        console.error("[Shop Error]", e);
        res.status(500).json({ error: "Errore caricamento listino" }); 
    }
});

// --- CARRELLO (AGGIORNA QUANTITÀ) ---
router.post('/cart/update', async (req, res) => {
    const { cycleId, productId, quantity } = req.body;
    const userId = req.user.id;
    const gasId = req.user.gasId;

    // Transazione per garantire consistenza
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Trova o Crea Ordine Bozza
        let [order] = await conn.execute(
            "SELECT id FROM orders WHERE user_id = ? AND cycle_id = ? AND status = 'draft'", 
            [userId, cycleId]
        );
        
        let orderId;
        if (order.length === 0) {
            const [resInsert] = await conn.execute(
                "INSERT INTO orders (gas_id, user_id, cycle_id, status, created_by) VALUES (?, ?, ?, 'draft', ?)", 
                [gasId, userId, cycleId, userId]
            );
            orderId = resInsert.insertId;
        } else {
            orderId = order[0].id;
        }

        // 2. Aggiorna Riga Ordine
        if (parseFloat(quantity) <= 0) {
            // Rimuovi
            await conn.execute("DELETE FROM order_items WHERE order_id = ? AND product_id = ?", [orderId, productId]);
        } else {
            // Inserisci o Aggiorna
            // Recupera prezzo attuale per storicizzarlo
            const [prod] = await conn.execute("SELECT price FROM products WHERE id = ?", [productId]);
            const price = prod[0].price;

            await conn.execute(`
                INSERT INTO order_items (order_id, product_id, quantity, price_at_order, created_by) 
                VALUES (?, ?, ?, ?, ?) 
                ON DUPLICATE KEY UPDATE quantity = ?, price_at_order = ?
            `, [orderId, productId, quantity, price, userId, quantity, price]);
        }

        // 3. Ricalcola Totale Ordine
        await conn.execute(`
            UPDATE orders 
            SET total_amount = (
                SELECT COALESCE(SUM(quantity * price_at_order), 0) 
                FROM order_items WHERE order_id = ?
            ) 
            WHERE id = ?
        `, [orderId, orderId]);

        await conn.commit();
        
        // Ritorna il nuovo totale per aggiornare la UI
        const [updated] = await pool.execute("SELECT total_amount FROM orders WHERE id = ?", [orderId]);
        res.json({ success: true, total: updated[0].total_amount });

    } catch (e) { 
        await conn.rollback();
        console.error("[Cart Error]", e);
        res.status(500).json({ error: "Errore aggiornamento carrello" }); 
    } finally {
        conn.release();
    }
});

// --- WALLET (STORICO) ---
router.get('/wallet/history', async (req, res) => {
    try {
        // Recupera transazioni
        const [transactions] = await pool.execute(
            "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", 
            [req.user.id]
        );
        
        // Recupera Info GAS per bonifico (IBAN)
        const [gasInfo] = await pool.execute("SELECT iban, name FROM gas WHERE id = ?", [req.user.gasId]);
        
        res.json({ 
            transactions, 
            gasInfo: gasInfo[0] || {} 
        });
    } catch (e) { 
        console.error("[Wallet Error]", e);
        res.status(500).json({ error: "Errore storico borsellino" }); 
    }
});

// --- NOTIFICHE ---
router.get('/notifications', async (req, res) => {
    try {
        const [r] = await pool.execute("SELECT * FROM notifications WHERE user_id = ? AND target_profile = 'member' ORDER BY created_at DESC LIMIT 20", [req.user.id]);
        res.json(r);
    } catch (e) { res.json([]); } // Fallback vuoto se tabella non esiste
});

router.post('/notifications/mark-read', async (req, res) => {
    const { notificationIds } = req.body; // Array di ID
    if (!notificationIds || !notificationIds.length) return res.json({success:true});
    try {
        // Costruiamo query dinamica sicura
        const placeholders = notificationIds.map(() => '?').join(',');
        await pool.execute(
            `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`, 
            [req.user.id, ...notificationIds]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Errore update notifiche" }); }
});

module.exports = router;