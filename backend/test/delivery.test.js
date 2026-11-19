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

// From market closing to delivery: weighing (G6) and adjustment (G7)
const { as, resetDb, closePool, sql, balanceOf, setPhase, USERS, GAS_ID, CYCLE_ID } = require('./helpers');

afterAll(closePool);

const coord = () => as(USERS.coordinatore);
const weigh = (items) => coord().post('/api/admin/logistics/checkin/bulk-update', { gasId: GAS_ID, cycleId: CYCLE_ID, items });
const deliver = (orderId) => coord().post('/api/admin/logistics/checkout/deliver', { gasId: GAS_ID, orderId });
const received = async (orderId, productId) =>
    Number((await sql('SELECT qty_received FROM order_items WHERE order_id = ? AND product_id = ?', [orderId, productId]))[0].qty_received);

beforeEach(async () => {
    await resetDb();
    await setPhase('chiuso');
});

describe('pesatura', () => {
    test('il riepilogo somma le quantità ordinate per prodotto', async () => {
        const r = await coord().get(`/api/admin/logistics/checkin/${CYCLE_ID}?gasId=${GAS_ID}`);
        expect(r.status).toBe(200);
        const arance = r.body.find(p => p.product_id === 1);
        expect(Number(arance.qty_ordered)).toBe(10.25); // Giulia 3 + Sara 6 + Anna 1.25
        expect(arance.total_members_involved).toBe(3);
    });

    test('il peso ricevuto è ripartito in proporzione e la somma torna esatta', async () => {
        expect((await weigh([{ productId: 1, totalReceived: 9 }])).status).toBe(200);
        const quote = [await received(1, 1), await received(3, 1), await received(4, 1)];
        expect(quote).toEqual([2.63, 5.27, 1.1]);
        expect(quote.reduce((a, b) => a + b, 0)).toBeCloseTo(9, 9);
    });

    test('unità discrete: quote intere', async () => {
        // Pecorino (pieces): Giulia 1, Sara 5; 5 arrive
        await weigh([{ productId: 4, totalReceived: 5 }]);
        expect([await received(1, 4), await received(3, 4)]).toEqual([1, 4]);
    });

    test('peso non valido: rifiutato e niente modificato', async () => {
        const r = await weigh([{ productId: 1, totalReceived: 9 }, { productId: 2, totalReceived: -1 }]);
        expect(r.status).toBe(400);
        expect((await sql('SELECT COUNT(*) AS n FROM order_items WHERE qty_received IS NOT NULL'))[0].n).toBe(0);
    });
});

describe('consegna con conguaglio', () => {
    test('peso inferiore: si restituisce la differenza (REFUND)', async () => {
        // Giulia: order #1 for €26, balance €124. Oranges: 2.63 kg instead of 3 → -€0.74
        await weigh([{ productId: 1, totalReceived: 9 }]);
        const r = await deliver(1);
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ finalAmount: 25.26, chargedAtOrder: 26, adjustment: -0.74 });
        expect(await balanceOf(USERS.giulia)).toBe(124.74);
        const [tx] = await sql("SELECT amount, type FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1", [USERS.giulia.id]);
        expect(tx).toEqual({ amount: '0.74', type: 'REFUND' });
        const [o] = await sql('SELECT status, total_amount FROM orders WHERE id = 1');
        expect(o).toEqual({ status: 'delivered', total_amount: '25.26' });
    });

    test('peso superiore: si addebita la differenza (SPESA)', async () => {
        // Roberto: bread 2 kg at €3.50, 2.40 kg arrive → +€1.40
        await weigh([{ productId: 7, totalReceived: 2.4 }]);
        const r = await deliver(2);
        expect(r.body.adjustment).toBe(1.4);
        expect(await balanceOf(USERS.roberto)).toBe(58.6);
    });

    test('peso uguale: nessun movimento, il totale non viene riaddebitato', async () => {
        const txBefore = (await sql('SELECT COUNT(*) AS n FROM wallet_transactions'))[0].n;
        const r = await deliver(4); // Anna: nothing weighed, the ordered quantity applies
        expect(r.body.adjustment).toBe(0);
        expect(await balanceOf(USERS.anna)).toBe(108.5);
        expect((await sql('SELECT COUNT(*) AS n FROM wallet_transactions'))[0].n).toBe(txBefore);
    });

    test('un ordine si consegna una volta sola', async () => {
        await deliver(1);
        const r = await deliver(1);
        expect(r.status).toBe(400);
        expect(r.body.error).toMatch(/già consegnato/);
        expect(await balanceOf(USERS.giulia)).toBe(124);
    });

    test('il saldo finale di ciascuno è ricarica meno quanto ha davvero ricevuto', async () => {
        await weigh([{ productId: 1, totalReceived: 9 }, { productId: 4, totalReceived: 5 }, { productId: 7, totalReceived: 2.4 }]);
        for (const id of [1, 2, 3, 4]) expect((await deliver(id)).status).toBe(200);

        // For each member: balance = sum of completed transactions (ledger and balance agree)
        const rows = await sql(`
            SELECT m.user_id, m.balance,
                   (SELECT COALESCE(SUM(t.amount), 0) FROM wallet_transactions t
                     WHERE t.user_id = m.user_id AND t.gas_id = m.gas_id AND t.status = 'completed') AS ledger
            FROM gas_memberships m WHERE m.gas_id = ? AND m.user_id IN (6, 7, 8, 10)`, [GAS_ID]);
        for (const r of rows) expect(Number(r.balance)).toBeCloseTo(Number(r.ledger), 2);

        // Sara: oranges 5.27 kg, pecorino 4 pcs, ricotta 3, yogurt 4 → 10.54 + 48 + 27 + 6 = 91.54
        expect(await balanceOf(USERS.sara)).toBeCloseTo(200 - 91.54, 2);
    });
});

describe('ricarica del socio', () => {
    test('richiesta, approvazione del coordinatore e saldo aggiornato', async () => {
        const socio = as(USERS.giulia);
        const r = await socio.post('/api/members/wallet/topup-request', { gasId: GAS_ID, amount: 50, description: 'Bonifico' });
        expect(r.status).toBe(200);
        expect(await balanceOf(USERS.giulia)).toBe(124); // pending: the balance does not change

        expect((await socio.post('/api/members/wallet/topup-request', { gasId: GAS_ID, amount: 10 })).status).toBe(409);

        const ok = await coord().post(`/api/admin/wallet/approve/${r.body.transactionId}?gasId=${GAS_ID}`, {});
        expect(ok.status).toBe(200);
        expect(await balanceOf(USERS.giulia)).toBe(174);

        // Approving twice does not credit twice
        await coord().post(`/api/admin/wallet/approve/${r.body.transactionId}?gasId=${GAS_ID}`, {});
        expect(await balanceOf(USERS.giulia)).toBe(174);
    });

    test('importi non validi: rifiutati', async () => {
        for (const amount of [0, -5, 'x', 20000]) {
            expect((await as(USERS.giulia).post('/api/members/wallet/topup-request', { gasId: GAS_ID, amount })).status).toBe(400);
        }
    });
});
