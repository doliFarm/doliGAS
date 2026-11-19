/**
 * @file backend/cron/scheduler.js
 * @description Motore di automazione del ciclo G1-G7.
 *
 * Ogni ora controlla i cicli attivi e invia le notifiche delle tappe raggiunte.
 *
 * Due proprietà importanti:
 * - **una volta sola**: ogni evento viene registrato in `cycle_events` con una chiave
 *   unica (cycle_id, event_key). L'inserimento avviene PRIMA dell'invio, quindi un
 *   secondo processo o un riavvio non possono duplicare le notifiche;
 * - **niente eventi perduti**: la condizione è "la data è passata e l'evento non è
 *   ancora stato inviato", non "la data è passata nell'ultima ora". Se il server
 *   resta spento per un giorno, al ritorno recupera le tappe mancate.
 *
 * L'avviso G4_REMINDER è l'eccezione: è un promemoria prima della chiusura e perde
 * senso dopo, quindi scade insieme al mercato.
 */

const cron = require('node-cron');
const getDb = () => global.pool || require('../config/db');
const { notifyAllMembers, notifyAllProducers, notifyCoordinatorRaw } = require('../utils/notifications');

const CRON_EXPRESSION = process.env.SCHEDULER_CRON || '0 * * * *'; // ogni ora al minuto 0
const REMINDER_HOURS_BEFORE_CLOSE = 3;

/**
 * Tenta di prendere in carico un evento. Restituisce true solo al primo chiamante:
 * la chiave unica fa fallire ogni tentativo successivo.
 */
const claimEvent = async (cycleId, eventKey) => {
    const pool = getDb();
    try {
        const [res] = await pool.execute(
            "INSERT IGNORE INTO cycle_events (cycle_id, event_key) VALUES (?, ?)",
            [cycleId, eventKey]
        );
        return res.affectedRows > 0;
    } catch (e) {
        console.error(`[SCHEDULER] Impossibile registrare l'evento ${eventKey} del ciclo ${cycleId}:`, e.message);
        return false; // in dubbio non si invia: meglio una notifica mancata che una doppia
    }
};

/** Rilascia un evento preso in carico, se l'invio è fallito del tutto. */
const releaseEvent = async (cycleId, eventKey) => {
    const pool = getDb();
    try {
        await pool.execute("DELETE FROM cycle_events WHERE cycle_id = ? AND event_key = ?", [cycleId, eventKey]);
    } catch (e) {
        console.error(`[SCHEDULER] Impossibile rilasciare l'evento ${eventKey}:`, e.message);
    }
};

/**
 * Verifica i minimi d'ordine (MOQ) alla chiusura del mercato e avvisa il coordinatore.
 * Gli ordini dei soci alla chiusura sono in stato 'confirmed' o 'processing'.
 */
const checkMoq = async (cycle) => {
    const pool = getDb();
    const [alerts] = await pool.execute(`
        SELECT p.name, p.min_order_qty, pu.symbol AS unit, SUM(oi.quantity) AS total
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN product_units pu ON p.unit_id = pu.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.cycle_id = ?
          AND o.status IN ('confirmed', 'processing')
        GROUP BY p.id
        HAVING total < p.min_order_qty
    `, [cycle.id]);

    if (alerts.length > 0) {
        const items = alerts
            .map(a => `- ${a.name}: ${a.total} ${a.unit} su ${a.min_order_qty} richiesti`)
            .join('\n');
        await notifyCoordinatorRaw(
            cycle.gas_id,
            '⚠️ Prodotti sotto il minimo d\'ordine',
            `Mercato chiuso per ${cycle.name}. Questi prodotti non raggiungono la quantità minima:\n${items}`,
            'alert'
        );
    } else {
        await notifyCoordinatorRaw(
            cycle.gas_id,
            '✅ Mercato chiuso',
            `Il mercato per ${cycle.name} è chiuso e tutti i minimi d'ordine sono soddisfatti.`,
            'success'
        );
    }
};

/** Tappe del ciclo, in ordine. `due` dice se il momento è arrivato. */
const buildEvents = (cycle, now) => {
    const at = (field) => new Date(cycle[field]);
    const reminderAt = new Date(at('market_close_at').getTime() - REMINDER_HOURS_BEFORE_CLOSE * 3600 * 1000);

    return [
        { key: 'G1_OPEN',       due: now >= at('start_at'),             run: (c, d) => notifyAllProducers(c.gas_id, 'G1_OPEN', d) },
        { key: 'G2_DEADLINE',   due: now >= at('producers_deadline'),   run: (c) => notifyCoordinatorRaw(c.gas_id, 'Listini chiusi', `È scaduto il termine per i listini di ${c.name}: verifica che i produttori abbiano validato.`, 'info') },
        { key: 'G3_SHOP_OPEN',  due: now >= at('market_open_at'),       run: (c, d) => notifyAllMembers(c.gas_id, 'G3_SHOP_OPEN', d) },
        // Promemoria prima della chiusura: scade con il mercato, non si recupera dopo
        { key: 'G4_REMINDER',   due: now >= reminderAt && now < at('market_close_at'), run: (c, d) => notifyAllMembers(c.gas_id, 'G4_REMINDER', d) },
        { key: 'G4_CLOSE',      due: now >= at('market_close_at'),      run: (c) => checkMoq(c) },
        { key: 'G5_PROD_ORDER', due: now >= at('orders_sent_at'),       run: (c, d) => notifyAllProducers(c.gas_id, 'G5_PROD_ORDER', d) }
    ];
};

/** Un giro di controllo. Esportato per poterlo invocare a mano e nei test. */
const runOnce = async (now = new Date()) => {
    const pool = getDb();
    const [cycles] = await pool.execute("SELECT * FROM cycles WHERE is_active = 1");
    let sent = 0;

    for (const cycle of cycles) {
        const data = {
            cycle_name: cycle.name,
            deadline: new Date(cycle.producers_deadline).toLocaleString('it-IT'),
            close_date: new Date(cycle.market_close_at).toLocaleString('it-IT'),
            delivery_date: new Date(cycle.delivery_at).toLocaleString('it-IT')
        };

        for (const event of buildEvents(cycle, now)) {
            if (!event.due) continue;
            if (!await claimEvent(cycle.id, event.key)) continue; // già inviato, o preso da un altro processo

            try {
                await event.run(cycle, data);
                sent += 1;
                console.log(`[SCHEDULER] ✉️ ${event.key} inviato per il ciclo #${cycle.id} (${cycle.name})`);
            } catch (e) {
                console.error(`[SCHEDULER] Invio di ${event.key} per il ciclo #${cycle.id} fallito:`, e.message);
                await releaseEvent(cycle.id, event.key); // si riproverà al giro successivo
            }
        }
    }
    return sent;
};

const runScheduler = () => {
    if (process.env.SCHEDULER_ENABLED === 'false') {
        console.log('[SCHEDULER] Disattivato da SCHEDULER_ENABLED=false.');
        return null;
    }

    const task = cron.schedule(CRON_EXPRESSION, async () => {
        try {
            const sent = await runOnce();
            if (sent > 0) console.log(`[SCHEDULER] Giro completato: ${sent} eventi inviati.`);
        } catch (e) {
            console.error('[SCHEDULER] Errore nel giro di controllo:', e.message);
        }
    });

    console.log(`[SCHEDULER] 🕒 Automazione G1-G7 avviata (pianificazione: ${CRON_EXPRESSION}).`);
    return task;
};

module.exports = runScheduler;
module.exports.runOnce = runOnce;
module.exports.buildEvents = buildEvents;
