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

// Member order: immediate charge, changes, credit, stock
const { as, resetDb, closePool, sql, balanceOf, setPhase, USERS, GAS_ID, CYCLE_ID } = require('./helpers');

afterAll(closePool);

const order = (user, items, cycleId = CYCLE_ID) =>
    as(user).post('/api/members/order', { gasId: GAS_ID, cycleId, items });

const lastTx = async (user) =>
    (await sql('SELECT amount, type FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1', [user.id]))[0];

describe('addebito all\'ordine', () => {
    beforeEach(resetDb);

    test('nuovo ordine: il saldo scende subito del totale e resta traccia SPESA', async () => {
        // Luca (€45) has no orders in the cycle
        const r = await order(USERS.luca, [{ productId: 1, qty: 2 }, { productId: 7, qty: 1 }]); // 4 + 3,50
        expect(r.status).toBe(200);
        expect(await balanceOf(USERS.luca)).toBe(37.5);
        expect(await lastTx(USERS.luca)).toEqual({ amount: '-7.50', type: 'SPESA' });
        const [o] = await sql('SELECT total_amount, status FROM orders WHERE id = ?', [r.body.orderId]);
        expect(o).toEqual({ total_amount: '7.50', status: 'confirmed' });
    });

    test('modifica dell\'ordine: si addebita o si restituisce solo la differenza', async () => {
        // Giulia already has order #1 for €26 and a €124 balance
        let r = await order(USERS.giulia, [{ productId: 4, qty: 3 }]); // 36 €: +10
        expect(r.status).toBe(200);
        expect(r.body.orderId).toBe(1);
        expect(await balanceOf(USERS.giulia)).toBe(114);

        r = await order(USERS.giulia, [{ productId: 1, qty: 1 }]); // 2 €: -34
        expect(await balanceOf(USERS.giulia)).toBe(148);
        expect(await lastTx(USERS.giulia)).toEqual({ amount: '34.00', type: 'SPESA' });

        // A single order per member and cycle, with its lines replaced
        const items = await sql('SELECT product_id, quantity FROM order_items WHERE order_id = 1');
        expect(items).toEqual([{ product_id: 1, quantity: '1.00' }]);
    });

    test('credito insufficiente: rifiutato senza toccare saldo né ordine', async () => {
        const r = await order(USERS.luca, [{ productId: 11, qty: 1 }, { productId: 4, qty: 4 }]);
        expect(r.status).toBe(400);
        // The Cantina has not validated: the error is on the product, before the credit check
        expect(r.body.error).toMatch(/^PRODOTTO_NON_DISPONIBILE/);

        const r2 = await order(USERS.luca, [{ productId: 4, qty: 4 }]); // 48 € > 45 €
        expect(r2.status).toBe(400);
        expect(r2.body.error).toBe('INSUFFICIENT_FUNDS');
        expect(await balanceOf(USERS.luca)).toBe(45);
        expect(await sql('SELECT id FROM orders WHERE user_id = ?', [USERS.luca.id])).toHaveLength(0);
    });

    test('GAS "di fiducia": con allow_insufficient_balance il saldo può andare sotto zero', async () => {
        await sql('UPDATE gas SET allow_insufficient_balance = 1 WHERE id = ?', [GAS_ID]);
        const r = await order(USERS.luca, [{ productId: 4, qty: 4 }]);
        expect(r.status).toBe(200);
        expect(await balanceOf(USERS.luca)).toBe(-3);
    });

    test('mercato chiuso: rifiutato', async () => {
        await setPhase('chiuso');
        const r = await order(USERS.luca, [{ productId: 1, qty: 1 }]);
        expect(r.status).toBe(400);
        expect(r.body.error).toMatch(/^MERCATO_CHIUSO/);
    });

    test('prodotto di un produttore che non ha validato il listino: rifiutato', async () => {
        const r = await order(USERS.luca, [{ productId: 10, qty: 1 }]);
        expect(r.status).toBe(400);
        expect(r.body.error).toMatch(/^PRODOTTO_NON_DISPONIBILE/);
    });

    test('quantità non valide: rifiutate', async () => {
        for (const qty of [0, -1, 'abc']) {
            const r = await order(USERS.luca, [{ productId: 1, qty }]);
            expect(r.status).toBe(400);
            expect(r.body.error).toMatch(/^QUANTITA_NON_VALIDA/);
        }
        expect(await balanceOf(USERS.luca)).toBe(45);
    });

    test('il socio vede solo i prodotti dei listini validati', async () => {
        const r = await as(USERS.luca).get(`/api/members/shop?gasId=${GAS_ID}`);
        expect(r.status).toBe(200);
        expect(r.body.isOpen).toBe(true);
        const ids = r.body.products.map(p => p.id);
        expect(ids).toEqual(expect.arrayContaining([1, 4, 7]));
        expect(ids).not.toContain(10);
    });
});

describe('stock', () => {
    // Pecorino (id 4) with stock 3 and no orders in the cycle
    beforeEach(async () => {
        await resetDb();
        await sql('UPDATE products SET stock = 3 WHERE id = 4');
        await sql('DELETE FROM order_items WHERE product_id = 4');
    });

    const available = async (user) =>
        (await as(user).get(`/api/members/shop?gasId=${GAS_ID}`)).body.products.find(p => p.id === 4).available;

    test('il disponibile scende con gli ordini degli altri, non con i propri', async () => {
        expect(await available(USERS.roberto)).toBe(3);
        expect((await order(USERS.giulia, [{ productId: 4, qty: 2 }])).status).toBe(200);
        expect(await available(USERS.roberto)).toBe(1);
        expect(await available(USERS.giulia)).toBe(3);
        // products.stock is not decremented
        expect((await sql('SELECT stock FROM products WHERE id = 4'))[0].stock).toBe(3);
    });

    test('oltre il disponibile: 409 con il dettaglio e nessun addebito', async () => {
        await order(USERS.giulia, [{ productId: 4, qty: 2 }]);
        const before = await balanceOf(USERS.roberto);
        const r = await order(USERS.roberto, [{ productId: 4, qty: 2 }]);
        expect(r.status).toBe(409);
        expect(r.body.error).toBe('STOCK_INSUFFICIENTE');
        expect(r.body.details).toEqual([expect.objectContaining({ productId: 4, requested: 2, available: 1 })]);
        expect(await balanceOf(USERS.roberto)).toBe(before);
    });

    test('righe ripetute dello stesso prodotto vengono sommate', async () => {
        const r = await order(USERS.luca, [{ productId: 4, qty: 2 }, { productId: 4, qty: 2 }]);
        expect(r.status).toBe(409);
        expect(r.body.details[0].requested).toBe(4);
    });

    test('stock abbassato dopo l\'ordine: si può confermare o ridurre, non aumentare', async () => {
        await order(USERS.giulia, [{ productId: 4, qty: 3 }]);
        await order(USERS.roberto, [{ productId: 1, qty: 1 }]);
        await sql('UPDATE products SET stock = 1 WHERE id = 4');
        expect((await order(USERS.giulia, [{ productId: 4, qty: 3 }, { productId: 1, qty: 1 }])).status).toBe(200);
        expect((await order(USERS.giulia, [{ productId: 4, qty: 2 }])).status).toBe(200);
        expect((await order(USERS.giulia, [{ productId: 4, qty: 3 }])).status).toBe(409);
    });

    test('due ordini in parallelo sull\'ultima disponibilità: ne passa uno solo', async () => {
        await order(USERS.roberto, [{ productId: 4, qty: 1 }]); // 2 left
        const results = await Promise.all([
            order(USERS.giulia, [{ productId: 4, qty: 2 }]),
            order(USERS.anna, [{ productId: 4, qty: 2 }])
        ]);
        expect(results.map(r => r.status).sort()).toEqual([200, 409]);
        const [{ total }] = await sql(`
            SELECT SUM(oi.quantity) AS total FROM order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE o.cycle_id = ? AND oi.product_id = 4`, [CYCLE_ID]);
        expect(Number(total)).toBe(3);
    });

    test('stock NULL: illimitato', async () => {
        await sql('UPDATE products SET stock = NULL WHERE id = 4');
        expect(await available(USERS.luca)).toBeNull();
        await sql('UPDATE gas_memberships SET balance = 1000 WHERE user_id = ?', [USERS.luca.id]);
        expect((await order(USERS.luca, [{ productId: 4, qty: 50 }])).status).toBe(200);
    });
});
