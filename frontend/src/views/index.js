/* =============================================================================
   FILE: frontend/src/views/index.js - v3.3
   STATUS: Integro, Completo, Robusto.
   DESC: Barrel file uniformato TOTALMENTE a Named Exports.
   ============================================================================= */

// --- 1. AUTH & PUBBLICHE ---
export { Login } from './auth/Login';
export { Verify } from './auth/Verify';
export { Welcome } from './Welcome';

// --- 2. ADMIN / COORDINATORE ---
export { CoordDashboard } from './admin/CoordDashboard';
export { CoordMembers } from './admin/CoordMembers';
export { CoordCycles } from './admin/CoordCycles';
export { CoordCatalog } from './admin/CoordCatalog';
export { CoordLogistics } from './admin/CoordLogistics';
export { CoordProducers } from './admin/CoordProducers';
export { CoordSettings } from './admin/CoordSettings';

// --- 3. SOCIO / MEMBER APP ---
export { DashboardView } from './member/DashboardView';
export { ShopView } from './member/ShopView';
export { WalletView } from './member/WalletView';

// --- 4. PRODUTTORE ---
// Assumendo che anche questi siano stati creati/aggiornati come Named Exports
export { ProducerDashboard } from './producer/ProducerDashboard'; 
export { ProducerEditor } from './producer/ProducerEditor'; 
export { ProducerOrders } from './producer/ProducerOrders';