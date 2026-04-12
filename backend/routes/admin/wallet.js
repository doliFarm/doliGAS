/**
 * doliGAS - Modulo Gestione Wallet (Admin)
 * @file backend/routes/admin/wallet.js
 * @version v1.3.0
 * @status Integro, Completo, Robusto.
 * @description Gestione flussi finanziari basata su Schema v22.0.
 * FIX: Allineamento ENUM ('DEPOSIT' invece di 'RECHARGE') e rimozione tabelle fantasma.
 */

const express = require('express');
const router = express.Router();

/**
 * Helper per acquisire il pool di connessioni singleton.
 */
const getDb = () => global.pool || require('../../config/db');

/**
 * Helper interno per estrarre il gasId in modo robusto.
 */
const getGasId = (req) => req.user?.verifiedGasId || req.body?.gasId || req.user?.gas_id;

// =============================================================================
// 1. LETTURA DATI E STATISTICHE
// =============================================================================

/**
 * GET /api/admin/wallet/pending
 * Recupera le ricariche (DEPOSIT) in attesa di approvazione.
 */
router.get('/pending', async (req, res) => {
    const pool = getDb();
    const gasId = getGasId(req);

    if (!gasId) return res.status(400).json({ error: "Contesto GAS non identificato." });

    try {
        const [rows] = await pool.execute(`
            SELECT wt.*, u.first_name, u.last_name 
            FROM wallet_transactions wt
            JOIN users u ON wt.user_id = u.id
            WHERE wt.gas_id = ? AND wt.status = 'pending'
            ORDER BY wt.created_at ASC
        `, [gasId]);
        
        res.json(rows);
    } catch (e) {
        console.error("[WALLET ADMIN] Pending error:", e.message);
        res.status(500).json({ error: "Errore recupero ricariche pendenti" });
    }
});

/**
 * GET /api/admin/wallet/stats
 * Calcola il totale cassa, soci attivi e pendenze.
 */
router.get('/stats', async (req, res) => {
    const pool = getDb();
    const gasId = getGasId(req);

    try {
        const [stats] = await pool.execute(`
            SELECT 
                IFNULL(SUM(balance), 0) as total_balance,
                COUNT(*) as total_members,
                (SELECT IFNULL(SUM(amount), 0) FROM wallet_transactions WHERE gas_id = ? AND status = 'pending') as total_pending
            FROM gas_memberships 
            WHERE gas_id = ? AND is_active = 1
        `, [gasId, gasId]);
        
        res.json(stats[0]);
    } catch (e) {
        console.error("[WALLET ADMIN] Stats error:", e.message);
        res.status(500).json({ error: "Errore calcolo statistiche cassa" });
    }
});

// =============================================================================
// 2. OPERAZIONI DI MOVIMENTAZIONE (MANUAL ADD & APPROVE)
// =============================================================================

/**
 * POST /api/admin/wallet/manual-add
 * Ricarica immediata: aggiorna saldo e crea transazione 'completed'.
 */
router.post('/manual-add', async (req, res) => {
    const pool = getDb();
    const conn = await pool.getConnection();
    
    const { userId, amount, description } = req.body;
    const gasId = getGasId(req);
    const adminId = req.user.id;

    try {
        if (!gasId || !userId || !amount) throw new Error("Dati obbligatori mancanti.");
        
        const cleanAmount = parseFloat(amount);
        if (isNaN(cleanAmount) || cleanAmount <= 0) throw new Error("Importo non valido.");

        await conn.beginTransaction();

        // 1. Aggiornamento Saldo Reale (Tabella gas_memberships)
        const [updateRes] = await conn.execute(
            "UPDATE gas_memberships SET balance = balance + ?, updated_at = NOW(), updated_by = ? WHERE user_id = ? AND gas_id = ?",
            [cleanAmount, adminId, userId, gasId]
        );

        if (updateRes.affectedRows === 0) throw new Error("Impossibile trovare il socio per questo GAS.");

        // 2. Registrazione Movimento (Tabella wallet_transactions)
        // NOTA: Usiamo 'DEPOSIT' come definito nell'ENUM dello schema v22.0
        await conn.execute(`
            INSERT INTO wallet_transactions 
            (gas_id, user_id, amount, type, status, description, created_at, created_by)
            VALUES (?, ?, ?, 'DEPOSIT', 'completed', ?, NOW(), ?)
        `, [gasId, userId, cleanAmount, description || 'Ricarica manuale coordinatore', adminId]);

        await conn.commit();
        res.json({ success: true });

    } catch (e) {
        if (conn) await conn.rollback();
        console.error("[WALLET ADMIN] Manual Add Crash:", e.message);
        res.status(500).json({ error: e.message });
    } finally {
        if (conn) conn.release();
    }
});

/**
 * POST /api/admin/wallet/approve/:txId
 * Conferma una ricarica richiesta dal socio.
 */
router.post('/approve/:txId', async (req, res) => {
    const pool = getDb();
    const conn = await pool.getConnection();
    const { txId } = req.params;
    const gasId = getGasId(req);
    const adminId = req.user.id;

    try {
        await conn.beginTransaction();

        // 1. Verifica e Lock della transazione
        const [tx] = await conn.execute(
            "SELECT * FROM wallet_transactions WHERE id = ? AND gas_id = ? AND status = 'pending' FOR UPDATE",
            [txId, gasId]
        );

        if (tx.length === 0) throw new Error("Transazione non valida o già processata.");

        const { user_id, amount } = tx[0];

        // 2. Aggiornamento saldo socio
        await conn.execute(
            "UPDATE gas_memberships SET balance = balance + ?, updated_at = NOW(), updated_by = ? WHERE user_id = ? AND gas_id = ?",
            [amount, adminId, user_id, gasId]
        );

        // 3. Chiusura transazione
        await conn.execute(
            "UPDATE wallet_transactions SET status = 'completed', updated_at = NOW(), updated_by = ? WHERE id = ?",
            [adminId, txId]
        );

        await conn.commit();
        res.json({ success: true });

    } catch (e) {
        if (conn) await conn.rollback();
        console.error("[WALLET ADMIN] Approval Error:", e.message);
        res.status(500).json({ error: e.message });
    } finally {
        if (conn) conn.release();
    }
});

// =============================================================================
// 3. STORICO E ESTRATTO CONTO
// =============================================================================

/**
 * GET /api/admin/wallet/:userId/history
 * Recupera tutti i movimenti di un socio specifico.
 */
router.get('/:userId/history', async (req, res) => {
    const pool = getDb();
    const { userId } = req.params;
    const gasId = getGasId(req);

    if (!gasId) return res.status(400).json({ error: "GAS ID mancante." });

    try {
        const [rows] = await pool.execute(`
            SELECT 
                id, amount, type, status, description, created_at
            FROM wallet_transactions
            WHERE user_id = ? AND gas_id = ?
            ORDER BY created_at DESC
        `, [userId, gasId]);
        
        res.json(rows);
    } catch (e) {
        console.error("[WALLET ADMIN] History error:", e.message);
        res.status(500).json({ error: "Errore recupero storico movimenti." });
    }
});

module.exports = router;