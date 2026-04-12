/**
 * @file backend/routes/products.js
 * @version v1.1.2
 * @author Luigi GRILLO @ doliFarm.com
 * @description Producer Area API. Fix: Rimossa colonna deleted_at inesistente che causava l'errore 500.
 * @status Integro, Completo, Robusto.
 * @date 2026-02-24
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');
const getDb = () => global.pool || require('../config/db');

router.use(authenticateToken);

// --- HELPER CONTEXT ---
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
// 1. LETTURA DATI (DASHBOARD & LISTINO)
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
            // Aggiunto 'id' e filtro per messaggi non letti (is_read = 0 o NULL)
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
        
        // --- LOGICA STATO ---
        let state = 'WAITING';
        if (now >= new Date(c.start_at) && now < new Date(c.producers_deadline)) state = 'LIST_OPEN';
        else if (now >= new Date(c.producers_deadline) && now < new Date(c.market_close_at)) state = 'WAITING';
        else if (now >= new Date(c.market_close_at)) state = 'ORDERS_RECEIVED';

        // --- NUOVA LOGICA: VERIFICA VALIDAZIONE LISTINO ---
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

        // --- RISPOSTA INTEGRATA ---
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

        // 1. RECUPERO INFO CICLO E VALIDAZIONE (Nuova logica workflow)
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
            // Verifichiamo se siamo oltre la deadline G2
            isListLocked = new Date() > new Date(cycles[0].producers_deadline);

            // Verifichiamo se il produttore ha già validato per questo ciclo
            const [val] = await pool.execute(
                "SELECT is_validated, validated_at FROM producer_cycle_validations WHERE producer_id = ? AND cycle_id = ?",
                [context.producer_id, cycleId]
            );
            
            if (val.length > 0) {
                isValidated = val[0].is_validated === 1;
                validatedAt = val[0].validated_at;
            }
        }

        // 2. RECUPERO PRODOTTI (Tua query originale)
        const [products] = await pool.execute(`
            SELECT p.*, u.symbol as unit, c.name as category_name
            FROM products p
            JOIN product_units u ON p.unit_id = u.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE p.producer_id = ? ORDER BY p.name ASC`, [context.producer_id]);

        const [units] = await pool.execute("SELECT id, name, symbol FROM product_units ORDER BY name");
        const [categories] = await pool.execute("SELECT id, name FROM product_categories WHERE gas_id = ?", [context.gas_id]);

        // 3. RISPOSTA COMPLETA
        res.json({ 
            products, 
            units, 
            categories, 
            isListLocked, // Per retrocompatibilità con isListOpen
            cycleId,      // Necessario per il tasto Valida
            isValidated,  // Necessario per lo stato del tasto
            validatedAt   // Opzionale, per info UI
        });

    } catch (err) { 
        console.error("[PROD_LIST] Error Details:", err.message);
        res.status(500).json({ error: "Errore caricamento listino" }); 
    }
});

/**
 * PATCH /api/products/messages/:id/read
 * Segna una notifica come letta in modo che non compaia più nella dashboard
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
// 2. SCRITTURA DATI (CRUD & BULK)
// ==================================================================================

router.post('/', async (req, res) => {
    const pool = getDb();
    const { name, category_id, unit_id, price, stock, min_order_qty, is_active, producerId } = req.body;
    try {
        const context = await getContext(req.user.id, producerId);
        if (!context) return res.status(403).json({ error: "Contesto non valido" });

        // 1. Catturiamo il risultato dell'INSERT
        const [result] = await pool.execute(`
            INSERT INTO products (producer_id, category_id, unit_id, name, price, stock, min_order_qty, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [context.producer_id, category_id || null, unit_id || 1, name, price, stock || null, min_order_qty || 1, is_active ? 1 : 0, req.user.id]
        );
        
        // 2. Revoca della validazione
        await pool.execute(`
            DELETE v FROM producer_cycle_validations v
            JOIN cycles c ON v.cycle_id = c.id
            WHERE v.producer_id = ? AND c.is_active = 1 AND c.producers_deadline > NOW()
        `, [context.producer_id]);
        
        // 3. Rispondiamo includendo l'ID appena generato
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
        const context = await getContext(req.user.id, producerId);
        await conn.beginTransaction();
        
        // 1. Eseguiamo gli aggiornamenti massivi
        for (const item of items) {
            await conn.execute(`
                UPDATE products 
                SET price = ?, stock = ?, min_order_qty = ?, is_active = ?, updated_at = NOW(), updated_by = ?
                WHERE id = ? AND producer_id = ?`,
                [item.price, item.stock, item.min_order_qty, item.is_active ? 1 : 0, req.user.id, item.id, context.producer_id]
            );
        }
        
        // 2. Revoca della validazione DENTRO la transazione per massima sicurezza
        await conn.execute(`
            DELETE v FROM producer_cycle_validations v
            JOIN cycles c ON v.cycle_id = c.id
            WHERE v.producer_id = ? 
            AND c.is_active = 1 
            AND c.producers_deadline > NOW()
        `, [context.producer_id]);

        // 3. Commit e risposta
        await conn.commit();
        res.json({ success: true }); // RISPOSTA INVIATA SOLO ALLA FINE

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
        const context = await getContext(req.user.id, producerId);
        
        // 1. Aggiornamento
        await pool.execute(`
            UPDATE products SET 
                name = ?, category_id = ?, unit_id = ?, price = ?, stock = ?, 
                min_order_qty = ?, is_active = ?, updated_at = NOW(), updated_by = ?
            WHERE id = ? AND producer_id = ?`,
            [name, category_id || null, unit_id || 1, price, stock || null, min_order_qty, is_active ? 1 : 0, req.user.id, req.params.id, context.producer_id]
        );
        
        // 2. Revoca
        await pool.execute(`
            DELETE v FROM producer_cycle_validations v
            JOIN cycles c ON v.cycle_id = c.id
            WHERE v.producer_id = ? AND c.is_active = 1 AND c.producers_deadline > NOW()
        `, [context.producer_id]);

        // 3. Risposta
        res.json({ success: true });

    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

router.delete('/:id', async (req, res) => {
    const pool = getDb();
    try {
        const context = await getContext(req.user.id, req.query.producerId);
        
        // 1. Cancellazione
        await pool.execute("DELETE FROM products WHERE id = ? AND producer_id = ?", [req.params.id, context.producer_id]);
        
        // 2. Revoca
        await pool.execute(`
            DELETE v FROM producer_cycle_validations v
            JOIN cycles c ON v.cycle_id = c.id
            WHERE v.producer_id = ? AND c.is_active = 1 AND c.producers_deadline > NOW()
        `, [context.producer_id]);

        // 3. Risposta
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
 * POST /api/products/validate-list
 * Permette al produttore di validare il proprio listino per il ciclo corrente.
 */
router.post('/validate-list', async (req, res) => {
    const pool = getDb();
    const userId = req.user.id;
    const { producerId, cycleId } = req.body;

    if (!producerId || !cycleId) {
        return res.status(400).json({ error: "Dati incompleti per la validazione." });
    }

    try {
        // Verifica che il produttore appartenga effettivamente all'utente
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