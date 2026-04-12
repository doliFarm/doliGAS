/**
 * @file frontend/src/App.jsx
 * @version v2.0.0 (Lazy Loaded)
 * @description Main Application Router. Implementa Code Splitting per prestazioni ottimali.
 * @status Stable
 * @date 2026-02-18
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Loader2 } from 'lucide-react';

// --- 1. VISTE PUBBLICHE (STATICHE - Velocità immediata) ---
import { Welcome } from './views/Welcome';
import { Login } from './views/auth/Login';
import { Verify } from './views/auth/Verify';
import { PrivacyView, TermsView } from './views/LegalViews';
import { ProfileSelector } from './components/ProfileSelector';

// --- 2. LAYOUT APPLICAZIONI (LAZY - Scaricati solo dopo il login) ---
// Nota: Usiamo .then() per gestire i "Named Exports" (export const ...)
const MemberApp = lazy(() => import('./MemberApp').then(module => ({ default: module.MemberApp })));
const CoordinatorApp = lazy(() => import('./CoordinatorApp').then(module => ({ default: module.CoordinatorApp })));
const ProducerApp = lazy(() => import('./ProducerApp').then(module => ({ default: module.ProducerApp })));

// --- 3. VISTE INTERNE (LAZY - Code Splitting Granulare) ---

// Viste Socio
const DashboardView = lazy(() => import('./views/member/DashboardView').then(module => ({ default: module.DashboardView })));
const ShopView = lazy(() => import('./views/member/ShopView').then(module => ({ default: module.ShopView })));
const WalletView = lazy(() => import('./views/member/WalletView').then(module => ({ default: module.WalletView })));
const OrderHistoryView = lazy(() => import('./views/member/OrderHistoryView').then(module => ({ default: module.OrderHistoryView })));
const UserProfileView = lazy(() => import('./views/member/UserProfileView').then(module => ({ default: module.UserProfileView })));

// Viste Coordinatore
const CoordDashboard = lazy(() => import('./views/admin/CoordDashboard').then(module => ({ default: module.CoordDashboard })));
const CoordMembers = lazy(() => import('./views/admin/CoordMembers').then(module => ({ default: module.CoordMembers })));
const CoordCycles = lazy(() => import('./views/admin/CoordCycles').then(module => ({ default: module.CoordCycles })));
const CoordCatalog = lazy(() => import('./views/admin/CoordCatalog').then(module => ({ default: module.CoordCatalog })));
const CoordLogistics = lazy(() => import('./views/admin/CoordLogistics').then(module => ({ default: module.CoordLogistics })));
const CoordProducers = lazy(() => import('./views/admin/CoordProducers').then(module => ({ default: module.CoordProducers })));
const CoordSettings = lazy(() => import('./views/admin/CoordSettings').then(module => ({ default: module.CoordSettings })));

// Viste Produttore
const ProducerDashboard = lazy(() => import('./views/producer/ProducerDashboard').then(module => ({ default: module.ProducerDashboard })));
const ProducerEditor = lazy(() => import('./views/producer/ProducerEditor').then(module => ({ default: module.ProducerEditor })));
const ProducerOrders = lazy(() => import('./views/producer/ProducerOrders').then(module => ({ default: module.ProducerOrders })));

// Debug Console (Lazy per non appesantire la prod)
const DebugConsole = lazy(() => import('./components/DebugConsole'));

// --- COMPONENTI DI UTILITÀ ---

// Loader a tutta pagina per le transizioni Lazy
const PageLoader = () => (
  <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
    <Loader2 className="animate-spin text-emerald-600 mb-4" size={48} />
    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Caricamento Modulo...</p>
  </div>
);

// Helper per determinare se siamo su un sottodominio GAS
const isGasSubdomain = () => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  return parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'welcome';
};

// Logica di Redirect dalla Root
const RootRedirect = () => {
  const { user, activeProfile } = useAuth();
  
  // 1. Se loggato
  if (user) {
      // Se ha già scelto un profilo, vai alla dashboard corretta
      if (activeProfile) {
          if (activeProfile.type === 'PRODUCER') return <Navigate to="/producer/dashboard" replace />;
          if (activeProfile.role_name === 'Coordinatore') return <Navigate to="/admin/dashboard" replace />;
          return <Navigate to="/member/dashboard" replace />;
      }
      // Altrimenti vai al selettore profili
      return <ProfileSelector />;
  }
  
  // 2. Se non loggato
  // Se siamo su demo.dolifarm.com -> Vai al login
  if (isGasSubdomain()) {
    return <Navigate to="/auth/login" replace />;
  }
  // Altrimenti -> Welcome Page
  return <Welcome />;
};

const App = () => {
  const { user, loading, activeProfile, profiles } = useAuth();
  const location = useLocation();
  // Loader Iniziale (Auth check)
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Inizializzazione doliGAS...</p>
      </div>
    );
  }

  // Gate di sicurezza: se loggato ma senza profilo attivo, mostra il selettore
  const isAuthRoute = window.location.pathname.startsWith('/auth');
  if (user && profiles.length > 1 && !activeProfile && !isAuthRoute) {
      return <ProfileSelector />;
  }

  return (
    <>
      {/* Suspense gestisce il caricamento dei componenti Lazy */}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* --- ROTTE PUBBLICHE (Veloci) --- */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/auth/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/auth/verify" element={<Verify />} />
          <Route path="/privacy" element={<PrivacyView />} />
          <Route path="/terms" element={<TermsView />} />

          {/* --- AREA COORDINATORE (Lazy Loaded) --- */}
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

          {/* --- AREA SOCIO (Lazy Loaded) --- */}
          <Route path="/member/*" element={<ProtectedRoute allowedRoles={['Socio']}><MemberApp /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardView />} />
            <Route path="shop" element={<ShopView />} />
            <Route path="wallet" element={<WalletView />} />
            <Route path="orders" element={<OrderHistoryView />} /> 
            <Route path="profile" element={<UserProfileView />} />
          </Route>

          {/* --- AREA PRODUTTORE (Lazy Loaded) --- */}
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
      
      {/* Debug Console caricata solo in dev */}
      {import.meta.env.MODE === 'development' && location.pathname !== '/' && (
        <Suspense fallback={null}>
          <DebugConsole />
        </Suspense>
      )}
    </>
  );
};

export default App;