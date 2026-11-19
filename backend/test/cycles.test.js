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

// Coordinator cycle management: offset schema, repetitions, time zone
const { as, sql, resetDb, closePool, USERS, GAS_ID } = require('./helpers');

afterAll(closePool);
beforeEach(resetDb);

const pad = (n) => String(n).padStart(2, '0');
const localNow = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

test('il database e l\'API usano lo stesso fuso orario', async () => {
    // Cycle dates are wall-clock strings compared both with NOW() in SQL and with
    // new Date() in Node: if the two clocks disagree, phases shift by hours.
    const [{ now }] = await sql('SELECT NOW() AS now');
    const diffSeconds = Math.abs(new Date(now) - new Date(localNow())) / 1000;
    expect(diffSeconds).toBeLessThan(120);
});

test('il coordinatore salva lo schema degli offset', async () => {
    const schema = { g1: 12, g2: 9, g3: 8, g4: 3, g5: 2, g6: 1, g7: 0 };
    const res = await as(USERS.coordinatore).put('/api/admin/cycles/schema', { gasId: GAS_ID, ...schema });
    expect(res.status).toBe(200);
    const saved = await as(USERS.coordinatore).get(`/api/admin/cycles/schema?gasId=${GAS_ID}`);
    expect(saved.body).toEqual(schema);
});

test('la modifica di un ciclo funziona ancora', async () => {
    const res = await as(USERS.coordinatore).put('/api/admin/cycles/2', {
        gasId: GAS_ID, name: 'Ciclo rinominato',
        start_at: '2027-01-01T08:00', producers_deadline: '2027-01-03T18:00',
        market_open_at: '2027-01-04T08:00', market_close_at: '2027-01-08T18:00',
        orders_sent_at: '2027-01-09T08:00', confirmation_at: '2027-01-10T08:00',
        delivery_at: '2027-01-11T17:00'
    });
    expect(res.status).toBe(200);
    const [c] = await sql('SELECT name, market_close_at FROM cycles WHERE id = 2');
    expect(c).toEqual({ name: 'Ciclo rinominato', market_close_at: '2027-01-08 18:00:00' });
});

test('le ripetizioni mantengono l\'orario anche col cambio dell\'ora legale', async () => {
    // Daylight saving time ends on 25/10/2026: the second cycle must still close at 18:00
    const res = await as(USERS.coordinatore).post('/api/admin/cycles', {
        gasId: GAS_ID, name: 'Settimanale', repeat_type: 'weekly', repeat_count: 2,
        start_at: '2026-10-12T08:00', producers_deadline: '2026-10-14T18:00',
        market_open_at: '2026-10-15T08:00', market_close_at: '2026-10-20T18:00',
        orders_sent_at: '2026-10-21T08:00', confirmation_at: '2026-10-22T08:00',
        delivery_at: '2026-10-23T17:00'
    });
    expect(res.status).toBe(200);
    const rows = await sql("SELECT name, market_close_at, delivery_at FROM cycles WHERE name LIKE 'Settimanale%' ORDER BY id");
    expect(rows).toEqual([
        { name: 'Settimanale', market_close_at: '2026-10-20 18:00:00', delivery_at: '2026-10-23 17:00:00' },
        { name: 'Settimanale (2)', market_close_at: '2026-10-27 18:00:00', delivery_at: '2026-10-30 17:00:00' }
    ]);
});
