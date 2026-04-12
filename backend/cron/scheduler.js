/**
 * @file backend/cron/scheduler.js
 * @version v1.0.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Automation Engine (Node-cron). Manages G1-G7 lifecycle events, triggering automatic emails, notifications, and MOQ checks based on time rules.
 * @status Production Ready
 * @date 2026-01-16
 */

const cron = require('node-cron');
const getDb = () => global.pool || require('../config/db');
const { notifyAllMembers, notifyAllProducers, notifyCoordinatorRaw } = require('../utils/notifications');

const runScheduler = () => {
    console.log("[SCHEDULER] 🕒 Sistema di automazione avviato (Check ogni 60 min).");

    // Esegui ogni ora al minuto 0
    cron.schedule('0 * * * *', async () => {
        const pool = getDb();
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        console.log(`[SCHEDULER] 🔄 Run job at ${now.toISOString()}`);

        try {
            const [cycles] = await pool.execute("SELECT * FROM cycles WHERE is_active = 1");

            for (const c of cycles) {
                const gasId = c.gas_id;
                const data = {
                    cycle_name: c.name,
                    deadline: new Date(c.producers_deadline).toLocaleDateString(),
                    close_date: new Date(c.market_close_at).toLocaleString()
                };

                // G1: Apertura Produttori
                if (new Date(c.start_at) > oneHourAgo && new Date(c.start_at) <= now) {
                    await notifyAllProducers(gasId, 'G1_OPEN', data);
                }

                // G2: Alert Coordinatore (Hardcoded perché è un alert di sistema, non un template utente)
                if (new Date(c.producers_deadline) > oneHourAgo && new Date(c.producers_deadline) <= now) {
                    await notifyCoordinatorRaw(gasId, "Chiusura Listini", `Verifica listini per ${c.name}.`);
                }

                // G3: Apertura Mercato
                if (new Date(c.market_open_at) > oneHourAgo && new Date(c.market_open_at) <= now) {
                    await notifyAllMembers(gasId, 'G3_SHOP_OPEN', data);
                }

                // G4 Pre-Close (-3h)
                const diffMs = new Date(c.market_close_at) - now;
                const diffHours = diffMs / (1000 * 60 * 60);
                if (diffHours > 2.5 && diffHours <= 3.5) {
                    await notifyAllMembers(gasId, 'G4_REMINDER', data);
                }

                // G4: Chiusura & MOQ
                if (new Date(c.market_close_at) > oneHourAgo && new Date(c.market_close_at) <= now) {
                    // Check MOQ logic here (invariato rispetto a prima)
                    const [moqAlerts] = await pool.execute(`
                        SELECT p.name, p.min_order_qty, SUM(oi.quantity) as total 
                        FROM order_items oi JOIN products p ON oi.product_id = p.id JOIN orders o ON oi.order_id = o.id
                        WHERE o.cycle_id = ? AND o.status = 'pending' GROUP BY p.id HAVING total < p.min_order_qty
                    `, [c.id]);

                    if (moqAlerts.length > 0) {
                        const items = moqAlerts.map(a => `- ${a.name} (${a.total}/${a.min_order_qty})`).join('\n');
                        await notifyCoordinatorRaw(gasId, "⚠️ Allarme MOQ", `Prodotti sotto soglia:\n${items}`, 'alert');
                    } else {
                        await notifyCoordinatorRaw(gasId, "✅ Mercato Chiuso", "Tutti i MOQ soddisfatti.", 'success');
                    }
                }

                // G5: Invio Fornitori
                if (new Date(c.orders_sent_at) > oneHourAgo && new Date(c.orders_sent_at) <= now) {
                    await notifyAllProducers(gasId, 'G5_PROD_ORDER', data);
                }
            }
        } catch (e) {
            console.error("[SCHEDULER] Critical Error:", e);
        }
    });
};

module.exports = runScheduler;