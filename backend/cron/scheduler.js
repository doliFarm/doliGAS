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
 * @file backend/cron/scheduler.js
 * @description Automation engine for the G1-G7 cycle.
 *
 * Every hour it checks the active cycles and sends the notifications for the steps reached.
 *
 * Two important properties:
 * - **exactly once**: each event is recorded in `cycle_events` with a unique key
 *   (cycle_id, event_key). The insert happens BEFORE sending, so a second process
 *   or a restart cannot duplicate notifications;
 * - **no lost events**: the condition is "the date has passed and the event has not
 *   been sent yet", not "the date passed within the last hour". If the server is down
 *   for a day, when it comes back it catches up on the missed steps.
 *
 * The G4_REMINDER notice is the exception: it is a reminder before closing and makes
 * no sense afterwards, so it expires together with the market.
 */

const cron = require('node-cron');
const getDb = () => global.pool || require('../config/db');
const { notifyAllMembers, notifyAllProducers, notifyCoordinatorRaw } = require('../utils/notifications');

const CRON_EXPRESSION = process.env.SCHEDULER_CRON || '0 * * * *'; // every hour at minute 0
const REMINDER_HOURS_BEFORE_CLOSE = 3;

/**
 * Tries to claim an event. Returns true only to the first caller:
 * the unique key makes every later attempt fail.
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
        return false; // when in doubt, do not send: a missed notification is better than a duplicate one
    }
};

/** Releases a claimed event if sending failed completely. */
const releaseEvent = async (cycleId, eventKey) => {
    const pool = getDb();
    try {
        await pool.execute("DELETE FROM cycle_events WHERE cycle_id = ? AND event_key = ?", [cycleId, eventKey]);
    } catch (e) {
        console.error(`[SCHEDULER] Impossibile rilasciare l'evento ${eventKey}:`, e.message);
    }
};

/**
 * Checks the minimum order quantities (MOQ) when the market closes and warns the coordinator.
 * At closing time member orders are in status 'confirmed' or 'processing'.
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

/** Cycle steps, in order. `due` tells whether the moment has come. */
const buildEvents = (cycle, now) => {
    const at = (field) => new Date(cycle[field]);
    const reminderAt = new Date(at('market_close_at').getTime() - REMINDER_HOURS_BEFORE_CLOSE * 3600 * 1000);

    return [
        { key: 'G1_OPEN',       due: now >= at('start_at'),             run: (c, d) => notifyAllProducers(c.gas_id, 'G1_OPEN', d) },
        { key: 'G2_DEADLINE',   due: now >= at('producers_deadline'),   run: (c) => notifyCoordinatorRaw(c.gas_id, 'Listini chiusi', `È scaduto il termine per i listini di ${c.name}: verifica che i produttori abbiano validato.`, 'info') },
        { key: 'G3_SHOP_OPEN',  due: now >= at('market_open_at'),       run: (c, d) => notifyAllMembers(c.gas_id, 'G3_SHOP_OPEN', d) },
        // Reminder before closing: expires with the market, it is not caught up afterwards
        { key: 'G4_REMINDER',   due: now >= reminderAt && now < at('market_close_at'), run: (c, d) => notifyAllMembers(c.gas_id, 'G4_REMINDER', d) },
        { key: 'G4_CLOSE',      due: now >= at('market_close_at'),      run: (c) => checkMoq(c) },
        { key: 'G5_PROD_ORDER', due: now >= at('orders_sent_at'),       run: (c, d) => notifyAllProducers(c.gas_id, 'G5_PROD_ORDER', d) }
    ];
};

/** One check round. Exported so it can be run by hand and in tests. */
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
            if (!await claimEvent(cycle.id, event.key)) continue; // already sent, or claimed by another process

            try {
                await event.run(cycle, data);
                sent += 1;
                console.log(`[SCHEDULER] ✉️ ${event.key} inviato per il ciclo #${cycle.id} (${cycle.name})`);
            } catch (e) {
                console.error(`[SCHEDULER] Invio di ${event.key} per il ciclo #${cycle.id} fallito:`, e.message);
                await releaseEvent(cycle.id, event.key); // it will be retried on the next round
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
