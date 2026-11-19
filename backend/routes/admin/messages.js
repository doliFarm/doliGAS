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
 * @file backend/routes/admin/messages.js
 * @description Messaging and notifications (Coordinator).
 * STATUS: Stable.
 * FIX: aligned gasId lookup to prevent error 500.
 */

const express = require('express');
const router = express.Router();

/**
 * Helper returning the singleton connection pool.
 */
const getDb = () => global.pool || require('../../config/db');

/**
 * @route   POST /api/admin/messages/send
 * @desc    Sends an internal notification to one or more users (single or bulk)
 */
router.post('/send', async (req, res) => {
    const pool = getDb();
    // target_profile comes from the frontend (e.g. 'member' or 'producer')
    const { recipientIds, subject, message, target_profile } = req.body; 
    
    const gasId = req.user?.verifiedGasId; // SECURITY: only the verified gasId

    if (!gasId) return res.status(400).json({ error: "Contesto GAS non identificato." });
    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
        return res.status(400).json({ error: "Nessun destinatario selezionato." });
    }

    // Target profile validation (falls back to 'member' if omitted, for safety)
    const validProfiles = ['member', 'coordinator', 'producer'];
    const finalProfile = validProfiles.includes(target_profile) ? target_profile : 'member';

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        // Insert with a segregated target_profile
        const insertQuery = `
            INSERT INTO notifications (gas_id, user_id, target_profile, title, message, type, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, 'info', 0, NOW())
        `;

        for (const userId of recipientIds) {
            await conn.execute(insertQuery, [
                gasId, 
                userId, 
                finalProfile, 
                subject.trim().substring(0, 255), 
                message.trim()
            ]);
        }

        await conn.commit();
        res.json({ success: true, count: recipientIds.length });
    } catch (err) {
        if (conn) await conn.rollback();
        res.status(500).json({ error: "Errore durante il salvataggio." });
    } finally {
        if (conn) conn.release();
    }
});

module.exports = router;