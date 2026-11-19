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
 * Shared test helpers.
 *
 * Data: every test file starts from the demo seed (backend/db/seeds/demo.sql), reloaded
 * from scratch with resetDb(). Useful references in the seed:
 * - GAS 1 "demo"; user 1 coordinator; users 2-5 producers (producers 1-4);
 *   users 6-10 members (Giulia €124, Roberto €60, Sara €95, Luca €45, Anna €108.50);
 * - cycle 2 "Ciclo in corso" with the market open; producers 1-3 have validated,
 *   the Cantina (producer 4, products 10-12) has not;
 * - confirmed orders in cycle 2: #1 Giulia €26, #2 Roberto €20.50, #3 Sara €105, #4 Anna €11.50.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../config/db');
const { loadSeed } = require('../db/seed');

const GAS_ID = 1;
const CYCLE_ID = 2;
const USERS = {
    coordinatore: { id: 1, email: 'admin@gas.it' },
    agrisole: { id: 2, email: 'bio@agrisole.it', producerId: 1 },
    caseificio: { id: 3, email: 'info@caseificio.it', producerId: 2 },
    cantina: { id: 5, email: 'cantina@vino.it', producerId: 4 },
    giulia: { id: 6, email: 'giulia@socio.it' },
    roberto: { id: 7, email: 'roberto@socio.it' },
    sara: { id: 8, email: 'sara@socio.it' },
    luca: { id: 9, email: 'luca@socio.it' },
    anna: { id: 10, email: 'anna@socio.it' }
};

/** Empties the test database and reloads the demo seed. */
const resetDb = () => loadSeed({ name: 'demo', reset: true, log: () => {} });

/** Runs a query and returns the rows. */
const sql = async (query, params = []) => (await pool.query(query, params))[0];

/** JWT token like the one issued by /api/auth/verify. */
const tokenFor = (user) => jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

/** HTTP client already authenticated as the given user. */
const as = (user) => {
    const auth = (r) => r.set('Authorization', `Bearer ${tokenFor(user)}`);
    return {
        get: (url) => auth(request(app).get(url)),
        post: (url, body) => auth(request(app).post(url)).send(body),
        put: (url, body) => auth(request(app).put(url)).send(body),
        patch: (url, body) => auth(request(app).patch(url)).send(body),
        delete: (url) => auth(request(app).delete(url))
    };
};

const balanceOf = async (user) =>
    Number((await sql('SELECT balance FROM gas_memberships WHERE user_id = ? AND gas_id = ?', [user.id, GAS_ID]))[0].balance);

/**
 * Moves the cycle to a phase: dates are rewritten relative to NOW() in the database.
 * - 'listini':  before the G2 deadline (the producer can edit the price list)
 * - 'mercato':  market open (G3-G4)
 * - 'chiuso':   market closed, before delivery (G4-G7)
 */
const setPhase = async (phase, cycleId = CYCLE_ID) => {
    const offsets = {
        listini: [-2, 1, 2, 4, 5, 6, 7],
        mercato: [-6, -4, -3, 2, 3, 4, 5],
        chiuso:  [-8, -6, -5, -1, -1, 1, 2]
    }[phase];
    if (!offsets) throw new Error(`Fase sconosciuta: ${phase}`);
    const cols = ['start_at', 'producers_deadline', 'market_open_at', 'market_close_at', 'orders_sent_at', 'confirmation_at', 'delivery_at'];
    const set = cols.map((c, i) => `${c} = NOW() + INTERVAL ${offsets[i] * 24} HOUR`).join(', ');
    await sql(`UPDATE cycles SET ${set} WHERE id = ?`, [cycleId]);
};

const closePool = () => pool.end();

module.exports = { request, app, pool, sql, resetDb, tokenFor, as, balanceOf, setPhase, closePool, GAS_ID, CYCLE_ID, USERS };
