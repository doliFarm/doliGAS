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
 * @file  backend/routes/auth.js
 * @version v1.1.2
 * @author Luigi GRILLO @ doliFarm.com
 * @description Authentication Logic. Multi-Tenant context mapping, Dual-Role logic, and Enhanced Debugging.
 * @status Stable
 * @date 2026-02-24
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); 
const crypto = require('crypto');
const { sendEmail } = require('../emailService');

// Dynamic DB helper
const getDb = () => global.pool || require('../config/db');
const JWT_SECRET = process.env.JWT_SECRET; // Required: checked at startup in server.js

// SECURITY: limit on OTP verification attempts (anti brute force, in memory)
const MAX_OTP_ATTEMPTS = 5;
const otpAttempts = new Map(); // userId -> failed attempts

// --- 1. LOGIN (code request) ---
router.post('/login', async (req, res) => {
    const { contact, gasSlug } = req.body;
    const pool = getDb();
    /**
     * Demo instances without SMTP: the code is returned in the response, because
     * there is no other way to receive it. The frontend shows it in the debug
     * console. Applies ONLY with DEMO_SHOW_OTP=true, never to be used on a real
     * installation: anyone who knows an email address could log in as that
     * person. Independent of ENABLE_DEBUG_API.
     */
    const showOtpInResponse = process.env.DEMO_SHOW_OTP === 'true';
    
    // ALWAYS-ON LOG TO TRACE INCOMING REQUESTS
    console.log(`[AUTH] 📩 Richiesta OTP per il GAS "${gasSlug}"`);
    
    if (!contact || !gasSlug) {
        console.error("[AUTH] ❌ Dati mancanti nella richiesta body");
        return res.status(400).json({ error: 'Dati mancanti' });
    }

    try {
        // Diagnostic query: look up the user WITHOUT is_active filters to see whether it exists
        const [checkRows] = await pool.execute(`
            SELECT u.id, u.email, g.name as gas_name, g.is_active as gas_active, gm.is_active as member_active
            FROM users u
            JOIN gas_memberships gm ON u.id = gm.user_id
            JOIN gas g ON gm.gas_id = g.id
            WHERE (u.email = ? OR u.phone = ?) AND g.slug = ?
        `, [contact, contact, gasSlug]);
        
        // If nothing is found, log the specific failure
        if (checkRows.length === 0) {
            console.warn(`[AUTH] ⚠️ Nessun utente trovato per il contatto indicato nel GAS "${gasSlug}".`);
            return res.json({ success: true, message: 'Se i dati sono corretti, riceverai un codice.' });
        }

        const user = checkRows[0];

        // If the user exists but is disabled
        if (!user.gas_active || !user.member_active) {
            console.warn(`[AUTH] 🚫 Utente trovato ma NON ATTIVO. GAS_OK: ${user.gas_active}, MEMBER_OK: ${user.member_active}`);
            return res.json({ success: true, message: 'Se i dati sono corretti, riceverai un codice.' });
        }

        // Past this point the user is valid and active
        const code = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await pool.execute("DELETE FROM magic_links WHERE user_id = ?", [user.id]);
        await pool.execute("INSERT INTO magic_links (user_id, token, expires_at) VALUES (?, ?, ?)", [user.id, code, expiresAt]);

        // KEY LOG: if you see this, the backend did its job
        // SECURITY: the code must NEVER be written to the logs
        otpAttempts.delete(user.id);
        console.log(`[AUTH] 🔑 OTP generato per utente #${user.id}`);
        
        // SEND EMAIL
        try {
            await sendEmail(user.email, `Codice accesso ${user.gas_name}`, `Il tuo codice di accesso doliGAS è: ${code}`);
            console.log(`[AUTH] 📧 Email OTP inviata a utente #${user.id}`);
        } catch (e) {
            console.error(`[AUTH] ❌ Errore invio email: ${e.message}`);
        }

        const responseData = { success: true, message: 'Codice inviato.' };
        
        // Demo instance: the code goes back to the frontend for the debug console
        if (showOtpInResponse) {
            responseData.debug_code = code;
        }

        res.json(responseData);

    } catch (err) { 
        console.error("[AUTH] 💥 Errore fatale nel processo di login:", err);
        res.status(500).json({ error: 'Errore interno login' }); 
    }
});

// --- 2. VERIFY (multi-profile & dual role) ---
router.post('/verify', async (req, res) => {
    const { contact, token } = req.body;
    const pool = getDb();

    try {
        const [users] = await pool.execute("SELECT id, email, first_name, last_name FROM users WHERE email = ? OR phone = ?", [contact, contact]);
        if (users.length === 0) return res.status(400).json({ error: 'Credenziali non valide' });
        const user = users[0];

        const [links] = await pool.execute("SELECT * FROM magic_links WHERE user_id = ? AND token = ? AND expires_at > NOW()", [user.id, String(token || '')]);
        if (links.length === 0) {
            // After MAX_OTP_ATTEMPTS failed attempts the code is invalidated
            const attempts = (otpAttempts.get(user.id) || 0) + 1;
            otpAttempts.set(user.id, attempts);
            if (attempts >= MAX_OTP_ATTEMPTS) {
                await pool.execute("DELETE FROM magic_links WHERE user_id = ?", [user.id]);
                otpAttempts.delete(user.id);
                console.warn(`[AUTH] 🚫 Troppi tentativi OTP per utente #${user.id}: codice invalidato`);
                return res.status(429).json({ error: 'Troppi tentativi. Richiedi un nuovo codice.' });
            }
            return res.status(400).json({ error: 'Codice errato o scaduto' });
        }
        otpAttempts.delete(user.id);

        const [rawProfiles] = await pool.execute(`
            SELECT 
                'GAS' as type, 
                g.id as context_id, 
                COALESCE(g.name, 'GAS Senza Nome') as context_name, 
                r.name as role_name, 
                g.slug as gas_slug
            FROM gas_memberships gm
            JOIN gas g ON gm.gas_id = g.id
            JOIN roles r ON gm.role_id = r.id
            WHERE gm.user_id = ? AND gm.is_active = 1 AND g.is_active = 1

            UNION ALL

            SELECT 
                'PRODUCER' as type, 
                p.id as context_id, 
                COALESCE(p.business_name, 'Azienda Senza Nome') as context_name, 
                'Produttore' as role_name, 
                g.slug as gas_slug
            FROM producers p
            JOIN gas g ON p.gas_id = g.id
            WHERE p.user_id = ? AND p.is_active = 1
        `, [user.id, user.id]);

        if (rawProfiles.length === 0) return res.status(403).json({ error: 'Nessun profilo attivo trovato' });

        const finalProfiles = [];
        rawProfiles.forEach(p => {
            finalProfiles.push({ ...p, id: `${p.type}-${p.context_id}-${p.role_name}` });

            if (p.type === 'GAS' && p.role_name === 'Coordinatore') {
                finalProfiles.push({
                    type: 'GAS',
                    context_id: p.context_id,
                    context_name: `${p.context_name} (Acquisti)`, 
                    role_name: 'Socio',
                    gas_slug: p.gas_slug,
                    id: `${p.type}-${p.context_id}-Socio-Virtual`
                });
            }
        });

        const jwtPayload = { id: user.id, email: user.email };
        const jwtToken = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '30d' });

        await pool.execute("DELETE FROM magic_links WHERE user_id = ?", [user.id]);

        res.json({
            success: true,
            token: jwtToken,
            profiles: finalProfiles,
            user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email }
        });

    } catch (err) {
        console.error('[AUTH] Verify error:', err);
        res.status(500).json({ error: 'Errore verifica' });
    }
});

// --- 3. REFRESH / ME (reload data after a page refresh) ---
router.get('/me', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token mancante' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const pool = getDb();
        const userId = decoded.id;

        const [rawProfiles] = await pool.execute(`
            SELECT 'GAS' as type, g.id as context_id, g.name as context_name, r.name as role_name, g.slug as gas_slug
            FROM gas_memberships gm JOIN gas g ON gm.gas_id = g.id JOIN roles r ON gm.role_id = r.id
            WHERE gm.user_id = ? AND gm.is_active = 1 AND g.is_active = 1
            UNION ALL
            SELECT 'PRODUCER' as type, p.id as context_id, p.business_name as context_name, 'Produttore' as role_name, g.slug as gas_slug
            FROM producers p JOIN gas g ON p.gas_id = g.id
            WHERE p.user_id = ? AND p.is_active = 1
        `, [userId, userId]);

        const finalProfiles = [];
        rawProfiles.forEach(p => {
            finalProfiles.push({ ...p, id: `${p.type}-${p.context_id}-${p.role_name}` });
            if (p.type === 'GAS' && p.role_name === 'Coordinatore') {
                finalProfiles.push({
                    type: 'GAS',
                    context_id: p.context_id,
                    context_name: `${p.context_name} (Acquisti)`,
                    role_name: 'Socio',
                    gas_slug: p.gas_slug,
                    id: `${p.type}-${p.context_id}-Socio-Virtual`
                });
            }
        });

        res.json({ user: decoded, profiles: finalProfiles });
    } catch (e) {
        return res.status(403).json({ error: 'Sessione scaduta' });
    }
});

module.exports = router;