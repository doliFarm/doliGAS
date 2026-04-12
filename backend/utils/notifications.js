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

// Fallback templates hardcoded per sicurezza (se il DB è vuoto o query fallisce)
const FALLBACK_TEMPLATES = {
    'G1_OPEN': { sub: 'Apertura Listini', body: 'Aggiorna i tuoi prodotti per {{cycle_name}}.' },
    'G3_SHOP_OPEN': { sub: 'Apertura Ordini', body: 'Puoi ordinare per {{cycle_name}} fino al {{close_date}}.' },
    'G4_REMINDER': { sub: 'Chiusura Imminente', body: 'Il mercato chiude tra poco.' },
    'G5_PROD_ORDER': { sub: 'Nuovi Ordini', body: 'Scarica la lista ordini per {{cycle_name}}.' }
};

/**
 * Recupera e compila un template
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
            // Usa fallback
            const fb = FALLBACK_TEMPLATES[eventKey] || { sub: 'Avviso GAS', body: 'Nuova notifica dal GAS.' };
            subject = fb.sub;
            body = fb.body;
        }

        // Sostituzione Variabili {{key}}
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
 * Invia notifica singola (Core Function)
 */
const sendNotification = async ({ userId, gasId, subject, message, type = 'info', emailTarget = null }) => {
    const pool = getDb();
    
    // 1. Canale Database (Priorità Massima - Transazionale implicita)
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
        // Non blocchiamo: proviamo comunque a mandare email
    }

    // 2. Canale Email (Fail-safe)
    if (emailTarget) {
        try {
            await sendEmail(emailTarget, `[doliGAS] ${subject}`, message);
        } catch (e) {
            console.error(`[NOTIF_ENGINE] Email Failed to ${emailTarget}:`, e.message);
            // Non rilanciamo l'errore per non bloccare il loop del chiamante
        }
    }

    // 3. Canale WhatsApp (Placeholder per implementazione futura)
    // if (phoneTarget) { await sendWhatsapp(...) }
};

// --- FUNZIONI DI GRUPPO ---

const notifyAllMembers = async (gasId, eventKey, data) => {
    const pool = getDb();
    const { subject, body } = await getCompiledTemplate(gasId, eventKey, data);

    try {
        const [users] = await pool.execute(`
            SELECT u.id, u.email FROM users u 
            JOIN gas_memberships gm ON u.id = gm.user_id 
            WHERE gm.gas_id = ? AND gm.is_active = 1 AND gm.role_id != 1`, 
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