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
 * @file backend/routes/public.js
 * @description Public routes (contacts and tracking)
 * STATUS: Stable.
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db'); 
const emailService = require('../emailService');

// POST /api/public/contact
router.post('/contact', async (req, res) => {
    const { name, email, location, message } = req.body;

    // Input validation
    if (!name || !email || !message) {
        return res.status(400).json({ 
            success: false, 
            message: 'Nome, email e messaggio sono campi obbligatori.' 
        });
    }

    try {
        // 1. Save to the DB (priority: data integrity)
        const query = `
            INSERT INTO leads (name, email, location, message, status, created_at) 
            VALUES (?, ?, ?, ?, 'NEW', NOW())
        `;
        await db.execute(query, [name, email, location || 'N/A', message]);
        console.log(`[Public] Lead salvato nel DB: ${email}`);

        // 2. Send the email notification (fail-safe: if it fails, processing continues)
        // SECURITY: form fields are neutralized before they go into the HTML
        const esc = emailService.escapeHtml;
        const emailSubject = `🔔 Nuovo Contatto da ${String(name).substring(0, 100)}`;
        const emailText = `Nome: ${name}\nEmail: ${email}\nLocalità: ${location || 'Non specificata'}\nMessaggio:\n${message}`;
        const emailBody = `
            <h3>Nuovo messaggio dal sito doliGAS</h3>
            <p><strong>Nome:</strong> ${esc(name)}</p>
            <p><strong>Email:</strong> ${esc(email)}</p>
            <p><strong>Località:</strong> ${esc(location || 'Non specificata')}</p>
            <p><strong>Messaggio:</strong></p>
            <div style="background: #f4f4f4; padding: 15px; border-radius: 8px;">${esc(message).replace(/\n/g, '<br>')}</div>
        `;

        // The notification goes only to the administrator: never to the form sender (prevents abuse as a spam relay)
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_ADMIN;
        if (adminEmail) {
            emailService.sendEmail(adminEmail, emailSubject, emailText, emailBody)
                .catch(err => console.warn('[Public] Email notification skipped:', err.message));
        } else {
            console.warn('[Public] ADMIN_EMAIL non configurato: notifica lead non inviata.');
        }

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
// Anonymous visit tracking with anti-spam (6h)
router.post('/track', async (req, res) => {
    // Immediate response (fire-and-forget)
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
        // Fail silently, so minor tracking errors do not clutter the system logs
    }
});

module.exports = router;