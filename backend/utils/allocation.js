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
 * @file backend/utils/allocation.js
 * @description Proportional split of a received quantity among several orders
 * (largest remainder method). Guarantees that the shares add up EXACTLY to the
 * received total, with no cents or pieces lost to rounding.
 */

/**
 * @param {number} total   total quantity to split (e.g. 13.5 kg received)
 * @param {number[]} weights quantities ordered by each member (weights of the split)
 * @param {number} step    granularity: 0.01 for kg/litres, 1 for discrete units (pieces, bottles)
 * @returns {number[]} assigned shares, in the same order as `weights`
 */
const allocateProportionally = (total, weights, step = 0.01) => {
    const units = Math.round(total / step);
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    if (units <= 0 || sumWeights <= 0) return weights.map(() => 0);

    const raw = weights.map(w => (w / sumWeights) * units);
    const base = raw.map(r => Math.floor(r + 1e-9));
    const rest = units - base.reduce((a, b) => a + b, 0);

    // Leftover units go to the largest fractional remainders (ties: the first one)
    const order = raw
        .map((r, i) => ({ i, frac: r - base[i] }))
        .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));
    for (let k = 0; k < rest; k++) base[order[k % order.length].i] += 1;

    const decimals = step >= 1 ? 0 : Math.round(-Math.log10(step));
    return base.map(u => Number((u * step).toFixed(decimals)));
};

module.exports = { allocateProportionally };
