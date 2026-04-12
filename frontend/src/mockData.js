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
  isOrderConfirmed: false, // NUOVO STATO: true se l'ordine è chiuso

  // BOZZA REMOTA
  remoteDraft: {
    exists: true,
    lastUpdated: '15/01/2026 10:30',
    items: [
       // NOTA: Le quantità sono NUMERI (1.5), non stringhe ("1.5")
       { producerId: 'p1', productId: 'prod2', quantity: 1.5, note: '' } 
    ]
  },

  // ULTIMO ORDINE (Per la funzione Ripeti)
  lastOrder: {
    id: "ord-99",
    date: '15/12/2025',
    total: 34.00,
    items: [ 
      // Aggiungo dettagli (name, price) per mostrarli nell'anteprima senza cercare nel catalogo
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
