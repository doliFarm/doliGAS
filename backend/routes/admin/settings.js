/**
 * @file backend/routes/admin/settings.js
 * @version v1.2.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description GAS Configuration API. Gestione Info Generali, Regole operative (Pagamenti, Ordini, Consegne), 
 * Categorie Prodotti e Template Notifiche.
 * @status Integro, Completo, Robusto.
 * @date 2026-02-24
 */

const express = require('express');
const router = express.Router();
const getDb = () => global.pool || require('../../config/db');

// --- 1. INFO E REGOLE GAS ---

/**
 * GET /api/admin/settings/gas-info
 * Recupera tutte le configurazioni del GAS corrente, inclusi i nuovi flag operativi.
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

        // ROBUSTEZZA: Conversione esplicita in boolean per prevenire bug nel frontend
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
 * Aggiorna le anagrafiche e le modalità operative del GAS.
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

// --- 2. CATEGORIE PRODOTTI ---

/**
 * GET /api/admin/settings/categories
 * Recupera l'elenco delle categorie associate al GAS corrente.
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
 * Crea o aggiorna una categoria (Upsert).
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
 * Eliminazione categoria con controllo di integrità referenziale sui prodotti.
 */
router.delete('/categories/:id', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId;
    const categoryId = req.params.id;

    try {
        // Verifica se ci sono prodotti associati (Integrità Referenziale)
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

// --- 3. TEMPLATES NOTIFICHE ---

/**
 * GET /api/admin/settings/templates
 * Recupera i testi personalizzati per le email automatiche del GAS.
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
 * Salva massivamente i template notifiche con gestione transazionale.
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