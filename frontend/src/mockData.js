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

export const gasConfig = {
  name: "GAS Fiesole",
  logoUrl: null, 
  iban: "IT 99 X 01234 56789 00000012345",
  intestatario: "Ass. DoliGAS Fiesole",
  logoutUrl: "https://welcome.dolifarm365.com",
  currency: "€",
  supportEmail: "info@dolifarm365.com"
};

export const initialUser = {
  id: "u1",
  name: 'Marco',
  balance: 15.50,
  isOrderConfirmed: false, // NEW STATE: true if the order is closed

  // REMOTE DRAFT
  remoteDraft: {
    exists: true,
    lastUpdated: '15/01/2026 10:30',
    items: [
       // NOTE: quantities are NUMBERS (1.5), not strings ("1.5")
       { producerId: 'p1', productId: 'prod2', quantity: 1.5, note: '' } 
    ]
  },

  // LAST ORDER (for the Repeat function)
  lastOrder: {
    id: "ord-99",
    date: '15/12/2025',
    total: 34.00,
    items: [ 
      // Add details (name, price) to show them in the preview without looking them up in the catalog
      { producerId: 'p1', productId: 'prod1', quantity: 2, name: "Mele Golden", price: 2.50 }, 
      { producerId: 'p2', productId: 'prod3', quantity: 1, name: "Pane Integrale", price: 4.50 }  
    ]
  },

  isCycleOpen: true,
  cycleClosingDate: 'Giovedì 18/01 ore 22:00'
};

export const coordinatorNotices = [
  { id: 1, type: 'info', text: "Ricordate di restituire le cassette vuote." },
  { id: 2, type: 'warning', text: "Arance Tarocco in ritardo per maltempo." }
];

export const initialProducers = [
  {
    id: 'p1',
    name: 'Az. Agricola Rossi',
    moqCurrent: 80, 
    moqTarget: 50, 
    products: [
      { id: 'prod1', name: 'Mele Golden', unit: 'kg', price: 2.50, description: "Raccolto 2025." },
      { id: 'prod2', name: 'Pere Abate', unit: 'kg', price: 3.00, description: "Maturazione 2gg." },
    ]
  },
  {
    id: 'p2',
    name: 'Il Forno Bio',
    moqCurrent: 5,
    moqTarget: 20, 
    products: [
      { id: 'prod3', name: 'Pane Integrale', unit: 'pz', price: 4.50, description: "Lievito madre." },
      { id: 'prod4', name: 'Focaccia Ligure', unit: 'pz', price: 8.00, description: "Teglia intera." },
    ]
  }
];

export const initialTransactions = [
  { id: 't1', date: '01/01', type: 'Ricarica Online', amount: 20.00, status: 'OK' },
  { id: 't2', date: '05/01', type: 'Bonifico', amount: 50.00, status: 'PENDING' },
  { id: 't3', date: '15/12', type: 'Spesa #ORD-99', amount: -34.00, status: 'OK' },
];
