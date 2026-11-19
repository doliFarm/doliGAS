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
 * @file backend/routes/admin/cycles.js
 * @version v1.0.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Cycle Management API. Handles creation, scheduling, and state management of Operational Cycles (G1-G7).
 * @status Stable
 * @date 2026-01-16
 */

const express = require('express');
const router = express.Router();
const { verifyGasMembership } = require('../../middlewares/roles');

// --- SAFE DB HELPER ---
const getDb = () => global.pool || require('../../config/db');

// Multi-profile protection: injects req.user.verifiedGasId
router.use(verifyGasMembership('Coordinatore'));

// --- DATE HELPERS ---
/**
 * Formats a date as 'YYYY-MM-DD HH:MM:SS' in the server's local time (TZ).
 * Cycle dates are stored as wall-clock time of the GAS, so toISOString() must not
 * be used here: it converts to UTC and would shift every repeated cycle.
 */
const pad = (n) => String(n).padStart(2, '0');
const formatLocal = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// setDate/setMonth work on local time, so repetitions keep the same wall-clock
// time even across a daylight saving change
const addDays = (dateStr, days) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return formatLocal(d);
};

const addMonths = (dateStr, months) => {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + months);
    return formatLocal(d);
};

/**
 * The seven cycle dates, in mandatory order.
 * The frontend already performs this check, but the server cannot trust the client:
 * out-of-sequence dates would put the scheduler and the shop in inconsistent states.
 */
const CYCLE_DATES = [
    ['start_at', 'G1 avvio'],
    ['producers_deadline', 'G2 chiusura listini'],
    ['market_open_at', 'G3 apertura ordini'],
    ['market_close_at', 'G4 chiusura ordini'],
    ['orders_sent_at', 'G5 invio ai fornitori'],
    ['confirmation_at', 'G6 conferma fornitori'],
    ['delivery_at', 'G7 consegna']
];

/**
 * Converts a date to the format accepted by MySQL ('YYYY-MM-DD HH:MM:SS').
 * The frontend uses a datetime-local field, which sends 'YYYY-MM-DDTHH:MM' without a time zone:
 * the conversion is textual on purpose, so the time stays the one typed by the
 * user and is not shifted by a round trip through UTC.
 */
const toMysqlDateTime = (value) => {
    if (!value) return null;
    const s = String(value).trim()
        .replace('T', ' ')
        .replace(/\.\d+/, '')      // milliseconds
        .replace(/Z$/i, '')        // UTC designator
        .replace(/[+-]\d{2}:?\d{2}$/, ''); // time zone offset
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s) ? `${s}:00` : s;
};

/** Returns an error message, or null if the dates are valid. */
const validateCycleDates = (body) => {
    const parsed = [];
    for (const [field, label] of CYCLE_DATES) {
        const value = body[field];
        if (!value) return `Data mancante: ${label}`;
        const d = new Date(value);
        if (isNaN(d.getTime())) return `Data non valida: ${label}`;
        parsed.push({ label, d });
    }
    for (let i = 1; i < parsed.length; i++) {
        if (parsed[i].d < parsed[i - 1].d) {
            return `Sequenza non valida: ${parsed[i].label} precede ${parsed[i - 1].label}`;
        }
    }
    return null;
};

// --- 1. LOAD OFFSET SCHEMA (G1-G7) ---
router.get('/schema', async (req, res) => {
    const pool = getDb();
    try {
        const [rows] = await pool.execute(`
            SELECT 
                g1_avvio_offset as g1, 
                g2_listini_fornitori_offset as g2, 
                g3_apertura_ordini_soci_offset as g3, 
                g4_chiusura_ordini_soci_offset as g4, 
                g5_invio_ordini_fornitori_offset as g5, 
                g6_conferma_fornitori_offset as g6, 
                g7_consegna_checkout_offset as g7 
            FROM gas WHERE id = ?`, [req.user.verifiedGasId]);
        
        res.json(rows[0] || { g1: 10, g2: 8, g3: 7, g4: 2, g5: 2, g6: 1, g7: 0 });
    } catch (e) { 
        console.error("[CYCLES] Schema Error:", e);
        res.status(500).json({ error: "Errore caricamento schema" }); 
    }
});

// --- 2. CREATE CYCLES WITH REPETITION ---
router.post('/', async (req, res) => {
    const { 
        name, start_at, producers_deadline, market_open_at, 
        market_close_at, orders_sent_at, confirmation_at, 
        delivery_at, repeat_type, repeat_count 
    } = req.body;
    
    const pool = getDb();

    if (!name || !String(name).trim()) return res.status(400).json({ error: "Il nome del ciclo è obbligatorio" });
    const datesError = validateCycleDates(req.body);
    if (datesError) return res.status(400).json({ error: datesError });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const iterations = repeat_type === 'none' ? 1 : Math.min(parseInt(repeat_count) || 1, 12); 
        let dayIncrement = 0;
        let monthIncrement = 0;

        if (repeat_type === 'weekly') dayIncrement = 7;
        else if (repeat_type === 'fortnightly') dayIncrement = 14;
        else if (repeat_type === 'monthly') monthIncrement = 1;

        for (let i = 0; i < iterations; i++) {
            const suffix = i > 0 ? ` (${i + 1})` : '';
            const offsetDays = dayIncrement * i;
            const offsetMonths = monthIncrement * i;
            const calc = (d) => offsetMonths > 0 ? addMonths(d, offsetMonths) : addDays(d, offsetDays);

            await connection.execute(`
                INSERT INTO cycles (
                    gas_id, name, start_at, producers_deadline, 
                    market_open_at, market_close_at, orders_sent_at, 
                    confirmation_at, delivery_at, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [
                    req.user.verifiedGasId, 
                    name + suffix, 
                    calc(start_at), 
                    calc(producers_deadline), 
                    calc(market_open_at), 
                    calc(market_close_at), 
                    calc(orders_sent_at), 
                    calc(confirmation_at), 
                    calc(delivery_at), 
                    i === 0 ? 1 : 0 
                ]
            );
        }
        await connection.commit();
        res.json({ success: true });
    } catch (e) {
        await connection.rollback();
        console.error("[CYCLES] Create Error:", e);
        res.status(500).json({ error: "Errore creazione cicli" });
    } finally {
        connection.release();
    }
});

// --- 6. UPDATE OFFSET SCHEMA ---
// Must stay BEFORE PUT /:id: Express matches routes in order, and '/:id' would
// otherwise catch '/schema' as a cycle id.
router.put('/schema', async (req, res) => {
    const { g1, g2, g3, g4, g5, g6, g7 } = req.body;
    const pool = getDb();
    try {
        await pool.execute(`
            UPDATE gas SET 
                g1_avvio_offset=?, g2_listini_fornitori_offset=?, 
                g3_apertura_ordini_soci_offset=?, g4_chiusura_ordini_soci_offset=?, 
                g5_invio_ordini_fornitori_offset=?, g6_conferma_fornitori_offset=?, 
                g7_consegna_checkout_offset=? 
            WHERE id=?`, [g1, g2, g3, g4, g5, g6, g7, req.user.verifiedGasId]);
        res.json({ success: true });
    } catch (e) { 
        console.error("[CYCLES] Update Schema Error:", e);
        res.status(500).json({ error: "Errore aggiornamento schema" }); 
    }
});

/**
 * PUT /api/admin/cycles/:id
 * Edits an existing cycle: name and the seven dates. Repetition does not apply
 * to editing, which always concerns a single cycle.
 */
router.put('/:id', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId;
    const { name } = req.body;

    if (!name || !String(name).trim()) return res.status(400).json({ error: "Il nome del ciclo è obbligatorio" });
    const datesError = validateCycleDates(req.body);
    if (datesError) return res.status(400).json({ error: datesError });

    try {
        const [existing] = await pool.execute(
            "SELECT id FROM cycles WHERE id = ? AND gas_id = ?",
            [req.params.id, gasId]
        );
        if (existing.length === 0) return res.status(404).json({ error: "Ciclo non trovato" });

        await pool.execute(`
            UPDATE cycles SET
                name = ?, start_at = ?, producers_deadline = ?, market_open_at = ?,
                market_close_at = ?, orders_sent_at = ?, confirmation_at = ?, delivery_at = ?,
                updated_at = NOW(), updated_by = ?
            WHERE id = ? AND gas_id = ?`,
            [
                String(name).trim(),
                ...CYCLE_DATES.map(([field]) => toMysqlDateTime(req.body[field])),
                req.user.id, req.params.id, gasId
            ]
        );

        /**
         * Moving a date forward brings back into play a step already notified:
         * we remove from the log the events whose date is in the future again, so
         * the scheduler will send them again at the right time.
         */
        await pool.execute(`
            DELETE ce FROM cycle_events ce
            JOIN cycles c ON c.id = ce.cycle_id
            WHERE ce.cycle_id = ?
              AND (
                   (ce.event_key = 'G1_OPEN'       AND c.start_at > NOW())
                OR (ce.event_key = 'G2_DEADLINE'   AND c.producers_deadline > NOW())
                OR (ce.event_key = 'G3_SHOP_OPEN'  AND c.market_open_at > NOW())
                OR (ce.event_key IN ('G4_REMINDER','G4_CLOSE') AND c.market_close_at > NOW())
                OR (ce.event_key = 'G5_PROD_ORDER' AND c.orders_sent_at > NOW())
              )`, [req.params.id]);

        res.json({ success: true });
    } catch (e) {
        console.error("[CYCLES] Update Error:", e.message);
        res.status(500).json({ error: "Errore aggiornamento ciclo" });
    }
});

// --- 3. CYCLE HISTORY ---
router.get('/history', async (req, res) => {
    const pool = getDb();
    try {
        const [rows] = await pool.execute(`
            SELECT *, (SELECT COUNT(*) FROM orders WHERE cycle_id = cycles.id) as orders_count 
            FROM cycles WHERE gas_id = ? ORDER BY delivery_at DESC`, [req.user.verifiedGasId]);
        res.json(rows);
    } catch (e) { 
        console.error("[CYCLES] History Error:", e);
        res.status(500).json({ error: "Errore caricamento storico" }); 
    }
});

// --- 4. HOLIDAYS (FULL CRUD) ---
router.get('/holidays', async (req, res) => {
    const pool = getDb();
    try {
        const [rows] = await pool.execute("SELECT * FROM holidays WHERE gas_id = ? ORDER BY holiday_date ASC", [req.user.verifiedGasId]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: "Errore caricamento festività" }); }
});

router.post('/holidays', async (req, res) => {
    const { id, name, holiday_date } = req.body;
    const pool = getDb();
    try {
        if (id) {
            await pool.execute(
                "UPDATE holidays SET name = ?, holiday_date = ? WHERE id = ? AND gas_id = ?",
                [name, holiday_date, id, req.user.verifiedGasId]
            );
        } else {
            await pool.execute(
                "INSERT INTO holidays (gas_id, holiday_date, name) VALUES (?, ?, ?)",
                [req.user.verifiedGasId, holiday_date, name]
            );
        }
        res.json({ success: true });
    } catch (e) {
        console.error("[CYCLES] Holiday Save Error:", e.message);
        res.status(500).json({ error: "Errore salvataggio festività" });
    }
});

router.delete('/holidays/:id', async (req, res) => {
    const pool = getDb();
    try {
        await pool.execute("DELETE FROM holidays WHERE id = ? AND gas_id = ?", [req.params.id, req.user.verifiedGasId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Errore eliminazione festività" }); }
});

// --- 5. DELETE CYCLE ---
router.delete('/:id', async (req, res) => {
    const pool = getDb();
    try {
        const [orders] = await pool.execute("SELECT id FROM orders WHERE cycle_id = ? LIMIT 1", [req.params.id]);
        if (orders.length > 0) return res.status(409).json({ error: "Impossibile eliminare: ci sono ordini attivi." });
        
        await pool.execute("DELETE FROM cycles WHERE id = ? AND gas_id = ?", [req.params.id, req.user.verifiedGasId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Errore eliminazione ciclo" }); }
});

// --- 7. UPDATE ACTIVE STATUS ---
router.patch('/:id/status', async (req, res) => {
    const { is_active } = req.body;
    const pool = getDb();
    try {
        await pool.execute("UPDATE cycles SET is_active = ? WHERE id = ? AND gas_id = ?", [is_active, req.params.id, req.user.verifiedGasId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Errore aggiornamento stato" }); }
});

module.exports = router;