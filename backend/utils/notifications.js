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
 * @file backend/utils/notifications.js
 * @version v1.0.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Notification System. Centralizes logic for DB notifications and Email dispatching, supporting dynamic templates and multi-channel fallback.
 * @status Stable
 * @date 2026-01-16
 */

const { sendEmail } = require('../emailService');
const getDb = () => global.pool || require('../config/db');

// Hardcoded fallback templates, for safety (empty DB or failed query)
const FALLBACK_TEMPLATES = {
    'G1_OPEN': { sub: 'Apertura Listini', body: 'Aggiorna i tuoi prodotti per {{cycle_name}}.' },
    'G3_SHOP_OPEN': { sub: 'Apertura Ordini', body: 'Puoi ordinare per {{cycle_name}} fino al {{close_date}}.' },
    'G4_REMINDER': { sub: 'Chiusura Imminente', body: 'Il mercato chiude tra poco.' },
    'G5_PROD_ORDER': { sub: 'Nuovi Ordini', body: 'Scarica la lista ordini per {{cycle_name}}.' }
};

/**
 * Loads and fills a template
 */
const getCompiledTemplate = async (gasId, eventKey, data) => {
    const pool = getDb();
    let subject, body;

    try {
        const [rows] = await pool.execute(
            "SELECT subject, body FROM notification_templates WHERE gas_id = ? AND event_key = ?",
            [gasId, eventKey]
        );

        if (rows.length > 0) {
            subject = rows[0].subject;
            body = rows[0].body;
        } else {
            // Use the fallback
            const fb = FALLBACK_TEMPLATES[eventKey] || { sub: 'Avviso GAS', body: 'Nuova notifica dal GAS.' };
            subject = fb.sub;
            body = fb.body;
        }

        // Replace {{key}} variables
        Object.keys(data).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, data[key]);
            body = body.replace(regex, data[key]);
        });

        return { subject, body };

    } catch (e) {
        console.error(`[NOTIF_ENGINE] Template Error (${eventKey}):`, e.message);
        return { subject: "Notifica Sistema", body: "Si è verificato un evento." };
    }
};

/**
 * Sends a single notification (core function)
 */
const sendNotification = async ({ userId, gasId, subject, message, type = 'info', emailTarget = null }) => {
    const pool = getDb();
    
    // 1. Database channel (highest priority)
    try {
        if (userId) {
            await pool.execute(
                `INSERT INTO notifications (user_id, gas_id, title, message, type, is_read) 
                 VALUES (?, ?, ?, ?, ?, 0)`,
                [userId, gasId, subject, message, type]
            );
        }
    } catch (e) {
        console.error("[NOTIF_ENGINE] DB Write Error:", e.message);
        // Do not block: still try to send the email
    }

    // 2. Email channel (fail-safe)
    if (emailTarget) {
        try {
            await sendEmail(emailTarget, `[doliGAS] ${subject}`, message);
        } catch (e) {
            console.error(`[NOTIF_ENGINE] Email Failed to ${emailTarget}:`, e.message);
            // Do not rethrow, so the caller's loop is not interrupted
        }
    }

    // 3. WhatsApp channel (placeholder for a future implementation)
    // if (phoneTarget) { await sendWhatsapp(...) }
};

// --- GROUP FUNCTIONS ---

const notifyAllMembers = async (gasId, eventKey, data) => {
    const pool = getDb();
    const { subject, body } = await getCompiledTemplate(gasId, eventKey, data);

    try {
        // Recipients: whoever can shop, i.e. Members (3) and Coordinators (1).
        // Producers (2) have their own notifications: they do not get the market notices.
        const [users] = await pool.execute(`
            SELECT u.id, u.email FROM users u 
            JOIN gas_memberships gm ON u.id = gm.user_id 
            WHERE gm.gas_id = ? AND gm.is_active = 1 AND gm.role_id IN (1, 3)`, 
            [gasId]
        );

        console.log(`[NOTIFY] Invio '${eventKey}' a ${users.length} soci.`);
        
        // Parallel execution
        await Promise.all(users.map(u => 
            sendNotification({
                userId: u.id,
                gasId,
                subject,
                message: body,
                type: 'info',
                emailTarget: u.email
            })
        ));
    } catch (e) { console.error("[NOTIFY_MEMBERS] Error:", e.message); }
};

const notifyAllProducers = async (gasId, eventKey, data) => {
    const pool = getDb();
    const { subject, body } = await getCompiledTemplate(gasId, eventKey, data);

    try {
        const [users] = await pool.execute(`
            SELECT u.id, u.email FROM users u 
            JOIN producers p ON u.id = p.user_id 
            WHERE p.gas_id = ? AND p.is_active = 1`, 
            [gasId]
        );

        await Promise.all(users.map(u => 
            sendNotification({
                userId: u.id,
                gasId,
                subject,
                message: body,
                type: 'warning',
                emailTarget: u.email
            })
        ));
    } catch (e) { console.error("[NOTIFY_PROD] Error:", e.message); }
};

const notifyCoordinatorRaw = async (gasId, title, message, type = 'alert') => {
    const pool = getDb();
    try {
        const [admins] = await pool.execute(`
            SELECT u.id, u.email FROM users u 
            JOIN gas_memberships gm ON u.id = gm.user_id 
            WHERE gm.gas_id = ? AND gm.role_id = 1`, 
            [gasId]
        );

        await Promise.all(admins.map(u => 
            sendNotification({
                userId: u.id,
                gasId,
                subject: title,
                message,
                type,
                emailTarget: u.email
            })
        ));
    } catch (e) { console.error("[NOTIFY_COORD] Error:", e.message); }
};

module.exports = { notifyAllMembers, notifyAllProducers, notifyCoordinatorRaw };