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

// Producer: price list, per-cycle validation, supply confirmation
const { as, resetDb, closePool, sql, setPhase, USERS, GAS_ID, CYCLE_ID } = require('./helpers');

afterAll(closePool);

const caseificio = () => as(USERS.caseificio);
const PID = USERS.caseificio.producerId; // 2: Pecorino (4), Ricotta (5), Yogurt (6)
const bulk = (items, user = USERS.caseificio) =>
    as(user).put('/api/products/bulk', { producerId: user.producerId, items });
const item = (id, price, extra = {}) => ({ id, price, stock: null, min_order_qty: 1, is_active: 1, ...extra });
const isValidated = async (producerId) =>
    (await sql('SELECT COUNT(*) AS n FROM producer_cycle_validations WHERE producer_id = ? AND cycle_id = ? AND is_validated = 1', [producerId, CYCLE_ID]))[0].n === 1;
const shopIds = async () =>
    (await as(USERS.luca).get(`/api/members/shop?gasId=${GAS_ID}`)).body.products.map(p => p.id);

beforeEach(resetDb);

describe('listino', () => {
    test('il produttore vede i suoi prodotti con la quantità ordinata nel ciclo', async () => {
        const r = await caseificio().get(`/api/products?producerId=${PID}`);
        expect(r.status).toBe(200);
        const pecorino = r.body.products.find(p => p.id === 4);
        expect(Number(pecorino.ordered_qty)).toBe(6);
        expect(r.body.products.every(p => p.producer_id === PID)).toBe(true);
    });

    test('prima di G2: la modifica passa e revoca la validazione, poi si rivalida', async () => {
        await setPhase('listini');
        expect(await isValidated(PID)).toBe(true);

        expect((await bulk([item(4, 13)])).status).toBe(200);
        expect((await sql('SELECT price FROM products WHERE id = 4'))[0].price).toBe('13.00');
        expect(await isValidated(PID)).toBe(false);

        const v = await caseificio().post('/api/products/validate-list', { producerId: PID, cycleId: CYCLE_ID });
        expect(v.status).toBe(200);
        expect(await isValidated(PID)).toBe(true);
    });

    test('dopo G2 il listino è bloccato', async () => {
        await setPhase('mercato');
        const r = await bulk([item(4, 1)]);
        expect(r.status).toBe(423);
        expect((await sql('SELECT price FROM products WHERE id = 4'))[0].price).toBe('12.00');
        expect(await isValidated(PID)).toBe(true);
    });

    test('non si modificano i prodotti di un altro produttore', async () => {
        await setPhase('listini');
        await bulk([item(1, 99)]); // Oranges, from Azienda Agricola Sole
        expect((await sql('SELECT price FROM products WHERE id = 1'))[0].price).toBe('2.00');
    });

    test('senza validazione i prodotti spariscono dal negozio', async () => {
        await sql('DELETE FROM producer_cycle_validations WHERE producer_id = ?', [PID]);
        const ids = await shopIds();
        expect(ids).not.toContain(4);
        expect(ids).toContain(1);
    });
});

describe('conferma della fornitura', () => {
    const confirm = (items) => caseificio().post('/api/products/confirm-supply', { producerId: PID, items });

    test('a mercato aperto: fuori finestra', async () => {
        expect((await confirm([{ id: 4, qty: 5 }])).status).toBe(423);
    });

    test('a mercato chiuso: salvata per il ciclo, senza toccare lo stock del listino', async () => {
        await setPhase('chiuso');
        await sql('UPDATE products SET stock = 10 WHERE id = 4');
        const r = await confirm([{ id: 4, qty: 5 }, { id: 1, qty: 9 }]); // product 1 is not theirs
        expect(r.status).toBe(200);
        expect(r.body.updated).toBe(1);
        expect(await sql('SELECT product_id, confirmed_qty FROM producer_cycle_supply WHERE cycle_id = ?', [CYCLE_ID]))
            .toEqual([{ product_id: 4, confirmed_qty: '5.000' }]);
        expect((await sql('SELECT stock FROM products WHERE id = 4'))[0].stock).toBe(10);

        // A new confirmation replaces the previous one, and the producer sees it
        await confirm([{ id: 4, qty: 4 }]);
        const list = await caseificio().get(`/api/products?producerId=${PID}`);
        expect(Number(list.body.products.find(p => p.id === 4).confirmed_qty)).toBe(4);
    });

    test('quantità non valida: rifiutata', async () => {
        await setPhase('chiuso');
        expect((await confirm([{ id: 4, qty: -1 }])).status).toBe(400);
    });
});
