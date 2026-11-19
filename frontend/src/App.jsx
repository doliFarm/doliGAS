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
 * @file frontend/src/App.jsx
 * @version v2.0.0 (Lazy Loaded)
 * @description Main Application Router. Uses code splitting for performance.
 * @status Stable
 * @date 2026-02-18
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Loader2 } from 'lucide-react';

// --- 1. PUBLIC VIEWS (STATIC - immediate) ---
import { Welcome } from './views/Welcome';
import { Login } from './views/auth/Login';
import { Verify } from './views/auth/Verify';
import { PrivacyView, TermsView } from './views/LegalViews';
import { ProfileSelector } from './components/ProfileSelector';

// --- 2. APPLICATION LAYOUTS (LAZY - downloaded only after login) ---
// Note: .then() is used to handle named exports (export const ...)
const MemberApp = lazy(() => import('./MemberApp').then(module => ({ default: module.MemberApp })));
const CoordinatorApp = lazy(() => import('./CoordinatorApp').then(module => ({ default: module.CoordinatorApp })));
const ProducerApp = lazy(() => import('./ProducerApp').then(module => ({ default: module.ProducerApp })));

// --- 3. INTERNAL VIEWS (LAZY - granular code splitting) ---

// Member views
const DashboardView = lazy(() => import('./views/member/DashboardView').then(module => ({ default: module.DashboardView })));
const ShopView = lazy(() => import('./views/member/ShopView').then(module => ({ default: module.ShopView })));
const WalletView = lazy(() => import('./views/member/WalletView').then(module => ({ default: module.WalletView })));
const OrderHistoryView = lazy(() => import('./views/member/OrderHistoryView').then(module => ({ default: module.OrderHistoryView })));
const UserProfileView = lazy(() => import('./views/member/UserProfileView').then(module => ({ default: module.UserProfileView })));

// Coordinator views
const CoordDashboard = lazy(() => import('./views/admin/CoordDashboard').then(module => ({ default: module.CoordDashboard })));
const CoordMembers = lazy(() => import('./views/admin/CoordMembers').then(module => ({ default: module.CoordMembers })));
const CoordCycles = lazy(() => import('./views/admin/CoordCycles').then(module => ({ default: module.CoordCycles })));
const CoordCatalog = lazy(() => import('./views/admin/CoordCatalog').then(module => ({ default: module.CoordCatalog })));
const CoordLogistics = lazy(() => import('./views/admin/CoordLogistics').then(module => ({ default: module.CoordLogistics })));
const CoordProducers = lazy(() => import('./views/admin/CoordProducers').then(module => ({ default: module.CoordProducers })));
const CoordSettings = lazy(() => import('./views/admin/CoordSettings').then(module => ({ default: module.CoordSettings })));

// Producer views
const ProducerDashboard = lazy(() => import('./views/producer/ProducerDashboard').then(module => ({ default: module.ProducerDashboard })));
const ProducerEditor = lazy(() => import('./views/producer/ProducerEditor').then(module => ({ default: module.ProducerEditor })));
const ProducerOrders = lazy(() => import('./views/producer/ProducerOrders').then(module => ({ default: module.ProducerOrders })));

// Debug console (lazy, to keep it out of the production bundle)
const DebugConsole = lazy(() => import('./components/DebugConsole'));

// --- UTILITY COMPONENTS ---

// Full page loader for lazy transitions
const PageLoader = () => (
  <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
    <Loader2 className="animate-spin text-emerald-600 mb-4" size={48} />
    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Caricamento Modulo...</p>
  </div>
);

// Helper telling whether we are on a GAS subdomain
const isGasSubdomain = () => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  return parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'welcome';
};

// Redirect logic from the root
const RootRedirect = () => {
  const { user, activeProfile } = useAuth();
  
  // 1. If logged in
  if (user) {
      // If a profile has already been chosen, go to the matching dashboard
      if (activeProfile) {
          if (activeProfile.type === 'PRODUCER') return <Navigate to="/producer/dashboard" replace />;
          if (activeProfile.role_name === 'Coordinatore') return <Navigate to="/admin/dashboard" replace />;
          return <Navigate to="/member/dashboard" replace />;
      }
      // Otherwise go to the profile selector
      return <ProfileSelector />;
  }
  
  // 2. If not logged in
  // On demo.dolifarm.com -> go to login
  if (isGasSubdomain()) {
    return <Navigate to="/auth/login" replace />;
  }
  // Otherwise -> welcome page
  return <Welcome />;
};

const App = () => {
  const { user, loading, activeProfile, profiles } = useAuth();
  const location = useLocation();
  // Initial loader (auth check)
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Inizializzazione doliGAS...</p>
      </div>
    );
  }

  // Security gate: logged in but without an active profile, show the selector
  const isAuthRoute = window.location.pathname.startsWith('/auth');
  if (user && profiles.length > 1 && !activeProfile && !isAuthRoute) {
      return <ProfileSelector />;
  }

  return (
    <>
      {/* Suspense handles the loading of lazy components */}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* --- PUBLIC ROUTES (fast) --- */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/auth/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/auth/verify" element={<Verify />} />
          <Route path="/privacy" element={<PrivacyView />} />
          <Route path="/terms" element={<TermsView />} />

          {/* --- COORDINATOR AREA (lazy loaded) --- */}
          <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['Coordinatore']}><CoordinatorApp /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CoordDashboard />} />
            <Route path="members" element={<CoordMembers />} />
            <Route path="cycles" element={<CoordCycles />} />
            <Route path="catalog" element={<CoordCatalog />} />
            <Route path="logistics" element={<CoordLogistics />} />
            <Route path="producers" element={<CoordProducers />} />
            <Route path="settings" element={<CoordSettings />} />
          </Route>

          {/* --- MEMBER AREA (lazy loaded) --- */}
          <Route path="/member/*" element={<ProtectedRoute allowedRoles={['Socio']}><MemberApp /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardView />} />
            <Route path="shop" element={<ShopView />} />
            <Route path="wallet" element={<WalletView />} />
            <Route path="orders" element={<OrderHistoryView />} /> 
            <Route path="profile" element={<UserProfileView />} />
          </Route>

          {/* --- PRODUCER AREA (lazy loaded) --- */}
          <Route path="/producer/*" element={<ProtectedRoute allowedTypes={['PRODUCER']}><ProducerApp /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ProducerDashboard />} />
            <Route path="editor" element={<ProducerEditor />} />
            <Route path="orders" element={<ProducerOrders />} />
          </Route>

          {/* --- FALLBACK --- */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      
      {/* Debug console loaded only in dev */}
      {import.meta.env.MODE === 'development' && location.pathname !== '/' && (
        <Suspense fallback={null}>
          <DebugConsole />
        </Suspense>
      )}
    </>
  );
};

export default App;