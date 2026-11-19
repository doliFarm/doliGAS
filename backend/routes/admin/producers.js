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

/* =============================================================================
  FILE: backend/routes/admin/producers.js - v2.3
  DESC: producer registry (Admin).
  FIX: "undefined" crash resolved by switching to verifiedGasId and getDb().
  =============================================================================
*/

const express = require('express');
const router = express.Router();
const { verifyGasMembership } = require('../../middlewares/roles');

// Dynamic DB helper
const getDb = () => global.pool || require('../../config/db');

// Context protection: the user must be Coordinator of the requested GAS
router.use(verifyGasMembership('Coordinatore'));

// --- 1. PRODUCER LIST ---
router.get('/', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId; // <-- FIX: use the verified id

    try {
        const [rows] = await pool.execute(`
            SELECT p.*, u.first_name, u.last_name 
            FROM producers p 
            LEFT JOIN users u ON p.user_id = u.id 
            WHERE p.gas_id = ?
            ORDER BY p.business_name ASC
        `, [gasId]);
        res.json(rows);
    } catch (e) { 
        console.error("[PRODUCERS] Fetch Error:", e.message);
        res.status(500).json({ error: "Errore caricamento produttori" }); 
    }
});

// --- 2. CREATE / EDIT ---
router.post('/', async (req, res) => {
    const pool = getDb();
    const { 
        id, business_name, vat_number, contact_name, 
        contact_email, contact_phone, address, iban, 
        user_id, is_active, internal_notes 
    } = req.body;

    const gasId = req.user.verifiedGasId; // <-- FIX
    const adminId = req.user.id;

    // --- SANITIZATION ---
    // MySQL crashes on 'undefined'. Convert to null.
    const p_business_name = business_name ? business_name.trim() : null;
    const p_vat = vat_number || null;
    const p_c_name = contact_name || null;
    const p_c_email = contact_email || null;
    const p_c_phone = contact_phone || null;
    const p_address = address || null;
    const p_iban = iban || null;
    const p_user_id = user_id || null;
    const p_active = (is_active !== undefined && is_active !== null) ? is_active : 1;
    const p_notes = internal_notes || null;

    if (!p_business_name) {
        return res.status(400).json({ error: "Il nome azienda è obbligatorio." });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        if (id) {
            // UPDATE
            await conn.execute(`
                UPDATE producers 
                SET business_name=?, vat_number=?, contact_name=?, contact_email=?, 
                    contact_phone=?, address=?, iban=?, user_id=?, is_active=?, 
                    internal_notes=?, updated_by=?, updated_at=NOW()
                WHERE id=? AND gas_id=?`, 
                [
                    p_business_name, p_vat, p_c_name, p_c_email, 
                    p_c_phone, p_address, p_iban, p_user_id, p_active, 
                    p_notes, adminId, id, gasId
                ]
            );
        } else {
            // INSERT
            await conn.execute(`
                INSERT INTO producers (
                    gas_id, business_name, vat_number, contact_name, contact_email, 
                    contact_phone, address, iban, user_id, is_active, 
                    internal_notes, created_by, updated_by
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
                [
                    gasId, p_business_name, p_vat, p_c_name, p_c_email, 
                    p_c_phone, p_address, p_iban, p_user_id, p_active, 
                    p_notes, adminId, adminId
                ]
            );
        }

        await conn.commit();
        res.json({ success: true });
    } catch (e) { 
        await conn.rollback();
        console.error("[PRODUCERS] Save Error:", e.message);
        res.status(500).json({ error: "Errore salvataggio produttore" }); 
    } finally {
        conn.release();
    }
});

// --- 3. SINGLE DELETE ---
router.delete('/:id', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId; // <-- FIX

    try {
        // Referential integrity check (products)
        const [products] = await pool.execute("SELECT id FROM products WHERE producer_id = ? LIMIT 1", [req.params.id]);
        
        if (products.length > 0) {
            // Soft delete if it has products
            await pool.execute("UPDATE producers SET is_active=0 WHERE id=? AND gas_id=?", [req.params.id, gasId]);
            return res.json({ success: true, message: "Produttore disattivato (ha prodotti collegati)." });
        }
        
        // Hard delete if empty
        await pool.execute("DELETE FROM producers WHERE id = ? AND gas_id = ?", [req.params.id, gasId]);
        res.json({ success: true, message: "Produttore eliminato." });
    } catch (e) { 
        console.error("[PRODUCERS] Delete Error:", e.message);
        res.status(500).json({ error: "Errore eliminazione" }); 
    }
});

// --- 4. BULK STATUS UPDATE ---
router.patch('/bulk-status', async (req, res) => {
    const pool = getDb();
    const { ids, is_active } = req.body;
    const gasId = req.user.verifiedGasId; // <-- FIX
    
    if (!ids || !ids.length) return res.json({ success: true });

    try {
        const placeholders = ids.map(() => '?').join(',');
        const query = `UPDATE producers SET is_active = ? WHERE id IN (${placeholders}) AND gas_id = ?`;
        
        await pool.execute(query, [is_active, ...ids, gasId]);
        
        res.json({ success: true });
    } catch (e) { 
        console.error("[PRODUCERS] Bulk Update Error:", e.message);
        res.status(500).json({ error: "Errore aggiornamento massivo" }); 
    }
});

module.exports = router;