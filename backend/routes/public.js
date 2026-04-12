/**
 * @file backend/routes/public.js
 * @description Gestione rotte pubbliche (contatti e tracking)
 * STATUS: Integro, Completo, Robusto.
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db'); 
const emailService = require('../emailService');

// POST /api/public/contact
router.post('/contact', async (req, res) => {
    const { name, email, location, message } = req.body;

    // Validazione Robustezza
    if (!name || !email || !message) {
        return res.status(400).json({ 
            success: false, 
            message: 'Nome, email e messaggio sono campi obbligatori.' 
        });
    }

    try {
        // 1. Salvataggio DB (Priorità: Integrità dei dati)
        const query = `
            INSERT INTO leads (name, email, location, message, status, created_at) 
            VALUES (?, ?, ?, ?, 'NEW', NOW())
        `;
        await db.execute(query, [name, email, location || 'N/A', message]);
        console.log(`[Public] Lead salvato nel DB: ${email}`);

        // 2. Invio Notifica Email (Fail-safe: Se fallisce, il processo continua)
        const emailSubject = `🔔 Nuovo Contatto da ${name}`;
        const emailBody = `
            <h3>Nuovo messaggio dal sito doliGAS</h3>
            <p><strong>Nome:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Località:</strong> ${location || 'Non specificata'}</p>
            <p><strong>Messaggio:</strong></p>
            <div style="background: #f4f4f4; padding: 15px; border-radius: 8px;">${message}</div>
        `;

        // Utilizziamo un metodo generico del servizio email consolidato
        emailService.sendEmail({
            to: process.env.EMAIL_ADMIN || email, // Notifica all'admin o fallback
            subject: emailSubject,
            html: emailBody
        }).catch(err => console.warn('[Public] Email notification skipped:', err.message));

        res.status(200).json({ 
            success: true, 
            message: 'Grazie! Abbiamo ricevuto il tuo messaggio.' 
        });

    } catch (error) {
        console.error('[Public] Errore critico salvataggio lead:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Errore interno del server.' 
        });
    }
});

// POST /api/public/track
// Tracciamento visite anonimo con Anti-Spam (6h)
router.post('/track', async (req, res) => {
    // Risposta immediata (Fire-and-forget)
    res.status(200).json({ success: true });

    try {
        const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const ip = rawIp.split(',')[0].trim();
        const userAgent = req.headers['user-agent'] ? req.headers['user-agent'].substring(0, 250) : 'Unknown';

        const query = `
            INSERT INTO page_views (ip_address, user_agent, created_at)
            SELECT ?, ?, NOW()
            FROM DUAL
            WHERE NOT EXISTS (
                SELECT 1 FROM page_views 
                WHERE ip_address = ? 
                AND created_at > DATE_SUB(NOW(), INTERVAL 6 HOUR)
            )
        `;
        
        await db.execute(query, [ip, userAgent, ip]);
    } catch (e) {
        // Fail silently per non sporcare i log di sistema con errori di tracking minori
    }
});

module.exports = router;