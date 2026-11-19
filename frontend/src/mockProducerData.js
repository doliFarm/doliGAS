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

export const producerConfig = {
  id: 'p1',
  name: "Az. Agricola Rossi",
  gasName: "GAS Fiesole",
  // Possible states: 'EDIT_OPEN' (G1->G2), 'PROCESSING' (G2->G3), 'DISTRIBUTION' (G3->G4)
  cycleStatus: 'EDIT_OPEN', 
  deadline: "Domani, ore 18:00"
};

// The producer's own catalog
export const myCatalog = [
  { id: 101, name: "Mele Golden", unit: "kg", price: 2.50, stock: 100, moq: 1, isActive: true },
  { id: 102, name: "Patate Pasta Gialla", unit: "kg", price: 1.20, stock: 500, moq: 5, isActive: true },
  { id: 103, name: "Zucchine Romanesche", unit: "kg", price: 3.00, stock: 0, moq: 1, isActive: false }, // Disabled
];

// Order summary (visible only in the DISTRIBUTION phase)
export const myOrdersSummary = [
  { id: 101, name: "Mele Golden", totalQty: 45, unit: "kg", note: "Cassette basse" },
  { id: 102, name: "Patate Pasta Gialla", totalQty: 120, unit: "kg", note: "Sacchi da 5kg" },
];
