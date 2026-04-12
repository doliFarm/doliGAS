/* =============================================================================
   FILE: backend/routes/admin/producers.js - v2.3
   STATUS: Integro, Completo, Robusto.
   DESC: Gestione Anagrafica Produttori (Admin).
   FIX: Risolto crash "undefined" passando a verifiedGasId e getDb().
   ============================================================================= */

const express = require('express');
const router = express.Router();
const { verifyGasMembership } = require('../../middlewares/roles');

// Helper DB Dinamico
const getDb = () => global.pool || require('../../config/db');

// Protezione Contesto: Verifica che l'utente sia Coordinatore del GAS richiesto
router.use(verifyGasMembership('Coordinatore'));

// --- 1. LISTA PRODUTTORI ---
router.get('/', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId; // <-- FIX: Uso ID verificato

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

// --- 2. CREAZIONE / MODIFICA ---
router.post('/', async (req, res) => {
    const pool = getDb();
    const { 
        id, business_name, vat_number, contact_name, 
        contact_email, contact_phone, address, iban, 
        user_id, is_active, internal_notes 
    } = req.body;

    const gasId = req.user.verifiedGasId; // <-- FIX
    const adminId = req.user.id;

    // --- SANITIZZAZIONE ---
    // MySQL crasha con 'undefined'. Convertiamo in null.
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

// --- 3. ELIMINAZIONE SINGOLA ---
router.delete('/:id', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId; // <-- FIX

    try {
        // Verifica Integrità Referenziale (Prodotti)
        const [products] = await pool.execute("SELECT id FROM products WHERE producer_id = ? LIMIT 1", [req.params.id]);
        
        if (products.length > 0) {
            // Soft Delete se ha prodotti
            await pool.execute("UPDATE producers SET is_active=0 WHERE id=? AND gas_id=?", [req.params.id, gasId]);
            return res.json({ success: true, message: "Produttore disattivato (ha prodotti collegati)." });
        }
        
        // Hard Delete se vuoto
        await pool.execute("DELETE FROM producers WHERE id = ? AND gas_id = ?", [req.params.id, gasId]);
        res.json({ success: true, message: "Produttore eliminato." });
    } catch (e) { 
        console.error("[PRODUCERS] Delete Error:", e.message);
        res.status(500).json({ error: "Errore eliminazione" }); 
    }
});

// --- 4. AGGIORNAMENTO MASSIVO STATO ---
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