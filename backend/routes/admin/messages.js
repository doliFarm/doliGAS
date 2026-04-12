/**
 * @file backend/routes/admin/messages.js
 * @description Gestione Messaggistica e Notifiche (Coordinatore).
 * STATUS: Integro, Completo, Robusto.
 * FIX: Allineamento recupero gasId per prevenire Error 500.
 */

const express = require('express');
const router = express.Router();

/**
 * Helper per acquisire il pool di connessioni singleton.
 */
const getDb = () => global.pool || require('../../config/db');

/**
 * @route   POST /api/admin/messages/send
 * @desc    Invia una notifica interna a uno o più utenti (singolo o bulk)
 */
router.post('/send', async (req, res) => {
    const pool = getDb();
    // Riceviamo target_profile dal frontend (es: 'member' o 'producer')
    const { recipientIds, subject, message, target_profile } = req.body; 
    
    const gasId = req.user?.verifiedGasId || req.body?.gasId || req.user?.gas_id;

    if (!gasId) return res.status(400).json({ error: "Contesto GAS non identificato." });
    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
        return res.status(400).json({ error: "Nessun destinatario selezionato." });
    }

    // Validazione del profilo target (Fallback su 'member' se omesso per sicurezza)
    const validProfiles = ['member', 'coordinator', 'producer'];
    const finalProfile = validProfiles.includes(target_profile) ? target_profile : 'member';

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        // Inserimento con target_profile segregato
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