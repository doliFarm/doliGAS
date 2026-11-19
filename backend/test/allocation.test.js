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

// Weighing split: unit tests, no database
const { allocateProportionally } = require('../utils/allocation');

const sum = (a) => Number(a.reduce((x, y) => x + y, 0).toFixed(6));

describe('allocateProportionally', () => {
    test('la somma delle quote è esattamente il totale ricevuto', () => {
        const q = allocateProportionally(10, [1, 1, 1], 0.01);
        expect(sum(q)).toBe(10);
        expect(q).toEqual([3.34, 3.33, 3.33]); // the extra cent goes to the first one when remainders are equal
    });

    test('ripartisce in proporzione all\'ordinato', () => {
        expect(allocateProportionally(9, [1, 2], 0.01)).toEqual([3, 6]);
        expect(allocateProportionally(13.5, [3, 6, 1.25, 1], 0.01).reduce((a, b) => a + b, 0)).toBeCloseTo(13.5, 9);
    });

    test('le unità discrete restano numeri interi', () => {
        const q = allocateProportionally(5, [1, 1, 1], 1);
        expect(q.every(Number.isInteger)).toBe(true);
        expect(sum(q)).toBe(5);
        expect(q).toEqual([2, 2, 1]);
    });

    test('totale zero o pesi nulli danno quote a zero', () => {
        expect(allocateProportionally(0, [1, 2], 0.01)).toEqual([0, 0]);
        expect(allocateProportionally(5, [0, 0], 0.01)).toEqual([0, 0]);
    });

    test('ricevuto più dell\'ordinato: l\'eccedenza è ripartita', () => {
        expect(allocateProportionally(6, [1, 2], 0.01)).toEqual([2, 4]);
    });
});
