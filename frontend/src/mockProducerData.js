export const producerConfig = {
  id: 'p1',
  name: "Az. Agricola Rossi",
  gasName: "GAS Fiesole",
  // Stati possibili: 'EDIT_OPEN' (G1->G2), 'PROCESSING' (G2->G3), 'DISTRIBUTION' (G3->G4)
  cycleStatus: 'EDIT_OPEN', 
  deadline: "Domani, ore 18:00"
};

// Il catalogo personale del produttore
export const myCatalog = [
  { id: 101, name: "Mele Golden", unit: "kg", price: 2.50, stock: 100, moq: 1, isActive: true },
  { id: 102, name: "Patate Pasta Gialla", unit: "kg", price: 1.20, stock: 500, moq: 5, isActive: true },
  { id: 103, name: "Zucchine Romanesche", unit: "kg", price: 3.00, stock: 0, moq: 1, isActive: false }, // Disattivo
];

// Riepilogo ordini (Visibile solo in fase DISTRIBUTION)
export const myOrdersSummary = [
  { id: 101, name: "Mele Golden", totalQty: 45, unit: "kg", note: "Cassette basse" },
  { id: 102, name: "Patate Pasta Gialla", totalQty: 120, unit: "kg", note: "Sacchi da 5kg" },
];
