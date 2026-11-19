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

/* =============================================================================
  FILE: frontend/src/views/index.js - v3.3
  DESC: barrel file, named exports ONLY.
  =============================================================================
*/

// --- 1. AUTH & PUBLIC ---
export { Login } from './auth/Login';
export { Verify } from './auth/Verify';
export { Welcome } from './Welcome';

// --- 2. ADMIN / COORDINATOR ---
export { CoordDashboard } from './admin/CoordDashboard';
export { CoordMembers } from './admin/CoordMembers';
export { CoordCycles } from './admin/CoordCycles';
export { CoordCatalog } from './admin/CoordCatalog';
export { CoordLogistics } from './admin/CoordLogistics';
export { CoordProducers } from './admin/CoordProducers';
export { CoordSettings } from './admin/CoordSettings';

// --- 3. MEMBER APP ---
export { DashboardView } from './member/DashboardView';
export { ShopView } from './member/ShopView';
export { WalletView } from './member/WalletView';

// --- 4. PRODUCER ---
// Assuming these were also created/updated as named exports
export { ProducerDashboard } from './producer/ProducerDashboard'; 
export { ProducerEditor } from './producer/ProducerEditor'; 
export { ProducerOrders } from './producer/ProducerOrders';