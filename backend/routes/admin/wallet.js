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
 * doliGAS - Wallet management module (Admin)
 * @file backend/routes/admin/wallet.js
 * @version v1.3.0
 * @status Stable
 * @description Financial flows based on schema v22.0.
 * FIX: aligned enums ('DEPOSIT' instead of 'RECHARGE') and removed phantom tables.
 */

const express = require('express');
const router = express.Router();

/**
 * Helper returning the singleton connection pool.
 */
const getDb = () => global.pool || require('../../config/db');

/**
 * Internal helper extracting the gasId from the request context.
 */
// SECURITY: only the gasId verified by the verifyGasMembership middleware
const getGasId = (req) => req.user?.verifiedGasId;

// =============================================================================
// 1. READ DATA AND STATISTICS
// =============================================================================

/**
 * GET /api/admin/wallet/pending
 * Lists the top-ups (DEPOSIT) awaiting approval.
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
 * Computes total cash, active members and pending items.
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
// 2. MOVEMENTS (MANUAL ADD & APPROVE)
// =============================================================================

/**
 * POST /api/admin/wallet/manual-add
 * Immediate top-up: updates the balance and creates a 'completed' transaction.
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

        // 1. Update the actual balance (gas_memberships table)
        const [updateRes] = await conn.execute(
            "UPDATE gas_memberships SET balance = balance + ?, updated_at = NOW(), updated_by = ? WHERE user_id = ? AND gas_id = ?",
            [cleanAmount, adminId, userId, gasId]
        );

        if (updateRes.affectedRows === 0) throw new Error("Impossibile trovare il socio per questo GAS.");

        // 2. Record the movement (wallet_transactions table)
        // NOTE: 'DEPOSIT' as defined in the schema v22.0 enum
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
 * Confirms a top-up requested by the member.
 */
router.post('/approve/:txId', async (req, res) => {
    const pool = getDb();
    const conn = await pool.getConnection();
    const { txId } = req.params;
    const gasId = getGasId(req);
    const adminId = req.user.id;

    try {
        await conn.beginTransaction();

        // 1. Check and lock the transaction
        const [tx] = await conn.execute(
            "SELECT * FROM wallet_transactions WHERE id = ? AND gas_id = ? AND status = 'pending' FOR UPDATE",
            [txId, gasId]
        );

        if (tx.length === 0) throw new Error("Transazione non valida o già processata.");

        const { user_id, amount } = tx[0];

        // 2. Update the member balance
        await conn.execute(
            "UPDATE gas_memberships SET balance = balance + ?, updated_at = NOW(), updated_by = ? WHERE user_id = ? AND gas_id = ?",
            [amount, adminId, user_id, gasId]
        );

        // 3. Close the transaction
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
// 3. HISTORY AND STATEMENT
// =============================================================================

/**
 * GET /api/admin/wallet/:userId/history
 * Lists all transactions of a given member.
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