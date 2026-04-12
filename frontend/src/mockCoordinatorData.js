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

// SIMULAZIONE LOGISTICA (Aggregato per Prodotto)
// Questo serve per la fase di CHECK-IN (Furgone)
export const logisticsSummary = [
  { 
    id: 'prod1', 
    name: 'Arance Tarocco', 
    producer: 'Az. Rossi', 
    unit: 'kg', 
    qtyOrdered: 100, 
    qtyReceived: 80, // 20% in meno!
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
    qtyReceived: 28, // Mancano 2 pezzi
    price: 4.50,
    status: 'divergent'
  }
];

// SIMULAZIONE SOCI AL CHECK-OUT (Distribuzione)
// Dopo il ricalcolo, Marco riceve 8kg invece di 10kg
export const membersCheckoutList = [
  {
    id: 'u1',
    name: 'Marco Rossi',
    items: [
      { id: 'prod1', name: 'Arance Tarocco', originalQty: 10, finalQty: 8, unit: 'kg', price: 1.50, status: 'pending' },
      { id: 'prod3', name: 'Pane Integrale', originalQty: 2, finalQty: 2, unit: 'pz', price: 4.50, status: 'pending' } // Qui l'algoritmo ha deciso di dare i pezzi interi a lui
    ],
    totalToPay: 21.00,
    isPaid: false
  },
  {
    id: 'u2',
    name: 'Giulia Bianchi',
    items: [
      { id: 'prod1', name: 'Arance Tarocco', originalQty: 5, finalQty: 4, unit: 'kg', price: 1.50, status: 'pending' },
      { id: 'prod3', name: 'Pane Integrale', originalQty: 1, finalQty: 0, unit: 'pz', price: 4.50, status: 'missing' } // Lei è sfortunata, niente pane
    ],
    totalToPay: 6.00,
    isPaid: false
  }
];


// MOCK PERMESSI (Struttura RBAC)
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

// MOCK SOCI (Anagrafica Completa)
export const allMembers = [
  { id: 1, name: 'Marco Rossi', email: 'marco@email.com', role: 'Coordinatore', balance: 15.50, status: 'ACTIVE' },
  { id: 2, name: 'Giulia Bianchi', email: 'giulia@email.com', role: 'Socio', balance: -5.00, status: 'ACTIVE' }, // In rosso
  { id: 3, name: 'Luca Verdi', email: 'luca@email.com', role: 'Volontario Logistica', balance: 42.00, status: 'ACTIVE' },
  { id: 4, name: 'Anna Neri', email: 'anna@email.com', role: 'Socio', balance: 0.00, status: 'BANNED' }, // Disattivata
];

// MOCK RICARICHE PENDENTI (Bonifici da approvare)
export const pendingTransactions = [
  { id: 'tx_101', userId: 2, userName: 'Giulia Bianchi', date: '14/01/2026', amount: 50.00, type: 'BONIFICO', ca: 'IT99X...1234' },
  { id: 'tx_102', userId: 5, userName: 'Mario Rossi (Nuovo)', date: '15/01/2026', amount: 20.00, type: 'QUOTA_ISCRIZIONE', ca: 'Contanti' },
];


