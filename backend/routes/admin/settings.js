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
 * @file backend/routes/admin/settings.js
 * @version v1.2.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description GAS Configuration API. General info, operating rules (payments, orders, deliveries),
 * product categories and notification templates.
 * @status Stable
 * @date 2026-02-24
 */

const express = require('express');
const router = express.Router();
const getDb = () => global.pool || require('../../config/db');

// --- 1. GAS INFO AND RULES ---

/**
 * GET /api/admin/settings/gas-info
 * Loads all the settings of the current GAS, including the new operating flags.
 */
router.get('/gas-info', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId;

    if (!gasId) return res.status(400).json({ error: "Contesto GAS non identificato" });

    try {
        const [rows] = await pool.execute(`
            SELECT 
                id, name, slug, description, iban, website, email_contact, 
                allow_insufficient_balance, manage_payments, manage_orders, manage_deliveries 
            FROM gas 
            WHERE id = ?`, 
            [gasId]
        );
        
        if (rows.length === 0) return res.status(404).json({ error: "GAS non trovato" });
        
        const data = rows[0];

        // Explicit conversion to boolean to prevent frontend bugs
        data.allow_insufficient_balance = !!data.allow_insufficient_balance;
        data.manage_payments = !!data.manage_payments;
        data.manage_orders = !!data.manage_orders;
        data.manage_deliveries = !!data.manage_deliveries;

        res.json(data);
    } catch (e) {
        console.error("[SETTINGS] Info Fetch Error:", e.message);
        res.status(500).json({ error: "Errore caricamento impostazioni" });
    }
});

/**
 * POST /api/admin/settings/gas-info
 * Updates the GAS details and operating modes.
 */
router.post('/gas-info', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId;
    const { 
        name, description, iban, website, email_contact, 
        allow_insufficient_balance, manage_payments, manage_orders, manage_deliveries 
    } = req.body;
    
    if (!name) return res.status(400).json({ error: "Nome GAS obbligatorio" });

    try {
        await pool.execute(`
            UPDATE gas SET 
                name = ?, description = ?, iban = ?, website = ?, email_contact = ?,
                allow_insufficient_balance = ?, 
                manage_payments = ?, manage_orders = ?, manage_deliveries = ?,
                updated_at = NOW()
            WHERE id = ?`, 
            [
                name, description || null, iban || null, website || null, email_contact || null, 
                allow_insufficient_balance ? 1 : 0, 
                manage_payments ? 1 : 0, manage_orders ? 1 : 0, manage_deliveries ? 1 : 0,
                gasId
            ]
        );
        res.json({ success: true, message: "Impostazioni salvate con successo" });
    } catch (e) {
        console.error("[SETTINGS] Update Error:", e.message);
        res.status(500).json({ error: "Errore durante il salvataggio dei dati" });
    }
});

// --- 2. PRODUCT CATEGORIES ---

/**
 * GET /api/admin/settings/categories
 * Lists the categories of the current GAS.
 */
router.get('/categories', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId;
    try {
        const [rows] = await pool.execute(
            "SELECT id, name FROM product_categories WHERE gas_id = ? ORDER BY name ASC",
            [gasId]
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: "Errore caricamento categorie" });
    }
});

/**
 * POST /api/admin/settings/categories
 * Creates or updates a category (upsert).
 */
router.post('/categories', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId;
    const { id, name } = req.body;
    if (!name) return res.status(400).json({ error: "Nome categoria obbligatorio" });

    try {
        if (id) {
            await pool.execute(
                "UPDATE product_categories SET name = ?, updated_at = NOW(), updated_by = ? WHERE id = ? AND gas_id = ?",
                [name, req.user.id, id, gasId]
            );
        } else {
            await pool.execute(
                "INSERT INTO product_categories (gas_id, name, created_by, updated_by) VALUES (?, ?, ?, ?)",
                [gasId, name, req.user.id, req.user.id]
            );
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Errore salvataggio categoria" });
    }
});

/**
 * DELETE /api/admin/settings/categories/:id
 * Deletes a category, checking referential integrity on products.
 */
router.delete('/categories/:id', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId;
    const categoryId = req.params.id;

    try {
        // Check whether products are linked to it (referential integrity)
        const [products] = await pool.execute(
            "SELECT id FROM products WHERE category_id = ? LIMIT 1",
            [categoryId]
        );

        if (products.length > 0) {
            return res.status(400).json({ 
                error: "Impossibile eliminare: esistono prodotti associati a questa categoria." 
            });
        }

        await pool.execute(
            "DELETE FROM product_categories WHERE id = ? AND gas_id = ?",
            [categoryId, gasId]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Errore durante l'eliminazione della categoria" });
    }
});

// --- 3. NOTIFICATION TEMPLATES ---

/**
 * GET /api/admin/settings/templates
 * Loads the custom texts for the GAS automatic emails.
 */
router.get('/templates', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId;
    try {
        const [rows] = await pool.execute(
            "SELECT event_key, subject, body FROM notification_templates WHERE gas_id = ?", 
            [gasId]
        );
        res.json(rows);
    } catch (e) { 
        res.status(500).json({ error: "Errore caricamento template" }); 
    }
});

/**
 * POST /api/admin/settings/templates
 * Saves the notification templates in bulk, in a transaction.
 */
router.post('/templates', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId;
    const { templates } = req.body;

    if (!Array.isArray(templates)) return res.status(400).json({ error: "Formato dati non valido" });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const t of templates) {
            await conn.execute(`
                INSERT INTO notification_templates (gas_id, event_key, subject, body)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE subject = VALUES(subject), body = VALUES(body)
            `, [gasId, t.event_key, t.subject, t.body]);
        }
        await conn.commit();
        res.json({ success: true });
    } catch (e) {
        await conn.rollback();
        console.error("[SETTINGS] Template Save Error:", e.message);
        res.status(500).json({ error: "Errore salvataggio template notifiche" });
    } finally { 
        conn.release(); 
    }
});

module.exports = router;