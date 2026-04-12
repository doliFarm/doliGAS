/* =============================================================================
   FILE: frontend/src/components/ProtectedRoute.jsx - v3.1
   STATUS: Integro, Completo, Robusto.
   SICUREZZA: Impedisce l'accesso a rotte non coerenti con il profilo attivo.
   AGGIUNTA: Verifica incrociata tra location.pathname e activeProfile.
   ============================================================================= */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, activeProfile, loading } = useAuth();
  const location = useLocation();

  // 1. LOADING STATE: Evita redirect errati mentre il Context si inizializza
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2. AUTH CHECK: Se non sei loggato -> Vai al Login
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // 3. PROFILE SELECTION CHECK: 
  // Se l'utente è loggato ma non ha ancora un profilo attivo, permettiamo il passaggio
  // perché App.jsx intercetterà questa condizione e mostrerà il ProfileSelector.
  if (!activeProfile) {
    return children;
  }

  // Debug monitor (solo in sviluppo)
  console.log(`[PROTECTED] Contesto Attivo: ${activeProfile.role_name} | Rotta: ${location.pathname}`);

  // 4. CONTEXT VALIDATION:
  // Verifichiamo che il profilo attivo consenta di stare nell'area attuale.
  const path = location.pathname;
  
  const checkAccess = () => {
    // Area Admin
    if (path.startsWith('/admin') && activeProfile.role_name === 'Coordinatore') return true;
    // Area Produttore
    if (path.startsWith('/producer') && activeProfile.type === 'PRODUCER') return true;
    // Area Socio
    if (path.startsWith('/member') && activeProfile.role_name === 'Socio') return true;
    
    return false;
  };

  // Se il profilo attivo non corrisponde all'area (es. sono un Socio ma provo ad andare in /admin)
  if (!checkAccess()) {
    console.warn(`[ACCESS DENIED] Profilo ${activeProfile.role_name} non autorizzato per ${path}`);

    // Reindirizziamo l'utente alla dashboard corretta per il suo profilo attuale
    if (activeProfile.role_name === 'Coordinatore') return <Navigate to="/admin/dashboard" replace />;
    if (activeProfile.type === 'PRODUCER') return <Navigate to="/producer/dashboard" replace />;
    if (activeProfile.role_name === 'Socio') return <Navigate to="/member/dashboard" replace />;

    // Fallback estremo se il profilo è corrotto o non riconosciuto
    return <Navigate to="/" replace />;
  }

  // 5. SUCCESS: Accesso garantito
  return children;
};