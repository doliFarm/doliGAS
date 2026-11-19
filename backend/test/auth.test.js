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

// Login with OTP code and GAS context
const { request, app, as, resetDb, closePool, USERS, GAS_ID } = require('./helpers');

beforeAll(resetDb);
afterAll(closePool);

const login = (contact, gasSlug = 'demo') => request(app).post('/api/auth/login').send({ contact, gasSlug });
const verify = (contact, token) => request(app).post('/api/auth/verify').send({ contact, token });

describe('login con OTP', () => {
    test('codice corretto: token e profili', async () => {
        const r1 = await login(USERS.giulia.email);
        expect(r1.status).toBe(200);
        expect(r1.body.debug_code).toMatch(/^\d{6}$/);

        const r2 = await verify(USERS.giulia.email, r1.body.debug_code);
        expect(r2.status).toBe(200);
        expect(r2.body.token).toBeTruthy();
        expect(r2.body.profiles.some(p => p.context_id === GAS_ID && p.role_name === 'Socio')).toBe(true);

        // The code can be used only once
        const r3 = await verify(USERS.giulia.email, r1.body.debug_code);
        expect(r3.status).toBe(400);
    });

    test('codice errato: rifiutato, e dopo troppi tentativi il codice viene invalidato', async () => {
        const { body } = await login(USERS.roberto.email);
        const wrong = body.debug_code === '000000' ? '111111' : '000000';
        for (let i = 0; i < 4; i++) expect((await verify(USERS.roberto.email, wrong)).status).toBe(400);
        expect((await verify(USERS.roberto.email, wrong)).status).toBe(429); // the fifth one
        // Even the right code is no longer valid
        expect((await verify(USERS.roberto.email, body.debug_code)).status).not.toBe(200);
    });

    test('utente sconosciuto: risposta generica, nessun codice', async () => {
        const r = await login('nessuno@example.com');
        expect(r.status).toBe(200);
        expect(r.body.debug_code).toBeUndefined();
    });
});

describe('contesto GAS', () => {
    test('senza token: 401', async () => {
        expect((await request(app).get(`/api/members/shop?gasId=${GAS_ID}`)).status).toBe(401);
    });

    test('gasId diversi tra query e body: rifiutato', async () => {
        const r = await as(USERS.coordinatore).post(`/api/admin/wallet/manual-add?gasId=${GAS_ID}`, { gasId: 99, userId: 6, amount: 1 });
        expect(r.status).toBe(400);
    });

    test('GAS a cui non si è iscritti: 403', async () => {
        expect((await as(USERS.giulia).get('/api/admin/cycles/history?gasId=99')).status).toBe(403);
    });

    test('un socio non entra nelle rotte del coordinatore', async () => {
        expect((await as(USERS.giulia).get(`/api/admin/cycles/history?gasId=${GAS_ID}`)).status).toBe(403);
    });

    test('il coordinatore sì', async () => {
        expect((await as(USERS.coordinatore).get(`/api/admin/cycles/history?gasId=${GAS_ID}`)).status).toBe(200);
    });
});
