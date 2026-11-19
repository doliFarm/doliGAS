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

// src/mockCoordinatorData.js

export const adminConfig = {
  gasName: "GAS Fiesole",
  currentCycle: {
    id: 101,
    name: "Consegna 15 Gennaio",
    status: "G4_DISTRIBUTION", // G1_OPEN, G2_CLOSED_SUPPLIER, G3_CLOSED_MEMBERS, G4_DISTRIBUTION
    stats: {
      totalOrders: 1250.00,
      totalReceived: 1180.00,
      discrepancy: -70.00,
      pendingTopups: 3
    }
  }
};

// LOGISTICS SIMULATION (aggregated by product)
// Used for the CHECK-IN phase (van)
export const logisticsSummary = [
  { 
    id: 'prod1', 
    name: 'Arance Tarocco', 
    producer: 'Az. Rossi', 
    unit: 'kg', 
    qtyOrdered: 100, 
    qtyReceived: 80, // 20% less!
    price: 1.50,
    status: 'divergent' // ok, divergent, checked
  },
  { 
    id: 'prod2', 
    name: 'Mele Golden', 
    producer: 'Az. Rossi', 
    unit: 'kg', 
    qtyOrdered: 50, 
    qtyReceived: 50, 
    price: 2.50,
    status: 'ok'
  },
  { 
    id: 'prod3', 
    name: 'Pane Integrale', 
    producer: 'Il Forno Bio', 
    unit: 'pz', 
    qtyOrdered: 30, 
    qtyReceived: 28, // 2 pieces missing
    price: 4.50,
    status: 'divergent'
  }
];

// MEMBERS AT CHECK-OUT SIMULATION (distribution)
// After the recalculation, Marco receives 8 kg instead of 10 kg
export const membersCheckoutList = [
  {
    id: 'u1',
    name: 'Marco Rossi',
    items: [
      { id: 'prod1', name: 'Arance Tarocco', originalQty: 10, finalQty: 8, unit: 'kg', price: 1.50, status: 'pending' },
      { id: 'prod3', name: 'Pane Integrale', originalQty: 2, finalQty: 2, unit: 'pz', price: 4.50, status: 'pending' } // Here the algorithm decided to give the whole pieces to him
    ],
    totalToPay: 21.00,
    isPaid: false
  },
  {
    id: 'u2',
    name: 'Giulia Bianchi',
    items: [
      { id: 'prod1', name: 'Arance Tarocco', originalQty: 5, finalQty: 4, unit: 'kg', price: 1.50, status: 'pending' },
      { id: 'prod3', name: 'Pane Integrale', originalQty: 1, finalQty: 0, unit: 'pz', price: 4.50, status: 'missing' } // She is unlucky, no bread
    ],
    totalToPay: 6.00,
    isPaid: false
  }
];


// PERMISSIONS MOCK (RBAC structure)
export const availablePermissions = [
  { module: 'catalogo', code: 'product_read', desc: 'Visualizzare listini' },
  { module: 'catalogo', code: 'product_write', desc: 'Creare/Modificare prodotti' },
  { module: 'ordini', code: 'order_read_own', desc: 'Vedere propri ordini' },
  { module: 'ordini', code: 'order_read_all', desc: 'Vedere ordini di tutti' },
  { module: 'ordini', code: 'order_manage', desc: 'Modificare ordini altrui' },
  { module: 'logistica', code: 'checkin_manage', desc: 'Gestire ricezione (Check-in)' },
  { module: 'logistica', code: 'checkout_manage', desc: 'Gestire distribuzione (Check-out)' },
  { module: 'finanza', code: 'wallet_read_own', desc: 'Vedere proprio saldo' },
  { module: 'finanza', code: 'wallet_adjust', desc: 'Gestire cassa/ricariche' },
  { module: 'utenti', code: 'user_write', desc: 'Invitare nuovi soci' },
];

export const mockRoles = [
  {
    id: 1,
    name: 'Coordinatore',
    isSystem: true,
    permissions: ['product_read', 'product_write', 'order_read_own', 'order_read_all', 'order_manage', 'checkin_manage', 'checkout_manage', 'wallet_read_own', 'wallet_adjust', 'user_write']
  },
  {
    id: 2,
    name: 'Socio',
    isSystem: true,
    permissions: ['product_read', 'order_read_own', 'wallet_read_own']
  },
  {
    id: 3,
    name: 'Volontario Logistica',
    isSystem: false,
    permissions: ['product_read', 'order_read_own', 'wallet_read_own', 'checkin_manage', 'checkout_manage', 'order_read_all']
  }
];

// MEMBERS MOCK (full registry)
export const allMembers = [
  { id: 1, name: 'Marco Rossi', email: 'marco@email.com', role: 'Coordinatore', balance: 15.50, status: 'ACTIVE' },
  { id: 2, name: 'Giulia Bianchi', email: 'giulia@email.com', role: 'Socio', balance: -5.00, status: 'ACTIVE' }, // In the red
  { id: 3, name: 'Luca Verdi', email: 'luca@email.com', role: 'Volontario Logistica', balance: 42.00, status: 'ACTIVE' },
  { id: 4, name: 'Anna Neri', email: 'anna@email.com', role: 'Socio', balance: 0.00, status: 'BANNED' }, // Disabled
];

// PENDING TOP-UPS MOCK (bank transfers to approve)
export const pendingTransactions = [
  { id: 'tx_101', userId: 2, userName: 'Giulia Bianchi', date: '14/01/2026', amount: 50.00, type: 'BONIFICO', ca: 'IT99X...1234' },
  { id: 'tx_102', userId: 5, userName: 'Mario Rossi (Nuovo)', date: '15/01/2026', amount: 20.00, type: 'QUOTA_ISCRIZIONE', ca: 'Contanti' },
];


