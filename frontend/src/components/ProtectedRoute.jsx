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
  FILE: frontend/src/components/ProtectedRoute.jsx - v3.1
  SECURITY: prevents access to routes that do not match the active profile.
  ADDED: cross-check between location.pathname and activeProfile.
  =============================================================================
*/

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, activeProfile, loading } = useAuth();
  const location = useLocation();

  // 1. LOADING STATE: avoids wrong redirects while the context initializes
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2. AUTH CHECK: not logged in -> go to login
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // 3. PROFILE SELECTION CHECK:
  // if the user is logged in but has no active profile yet, let them through
  // because App.jsx catches this condition and shows the ProfileSelector.
  if (!activeProfile) {
    return children;
  }

  // Debug monitor (development only)
  console.log(`[PROTECTED] Contesto Attivo: ${activeProfile.role_name} | Rotta: ${location.pathname}`);

  // 4. CONTEXT VALIDATION:
  // check that the active profile allows staying in the current area.
  const path = location.pathname;
  
  const checkAccess = () => {
    // Admin area
    if (path.startsWith('/admin') && activeProfile.role_name === 'Coordinatore') return true;
    // Producer area
    if (path.startsWith('/producer') && activeProfile.type === 'PRODUCER') return true;
    // Member area
    if (path.startsWith('/member') && activeProfile.role_name === 'Socio') return true;
    
    return false;
  };

  // If the active profile does not match the area (e.g. a Member trying to open /admin)
  if (!checkAccess()) {
    console.warn(`[ACCESS DENIED] Profilo ${activeProfile.role_name} non autorizzato per ${path}`);

    // Redirect the user to the right dashboard for their current profile
    if (activeProfile.role_name === 'Coordinatore') return <Navigate to="/admin/dashboard" replace />;
    if (activeProfile.type === 'PRODUCER') return <Navigate to="/producer/dashboard" replace />;
    if (activeProfile.role_name === 'Socio') return <Navigate to="/member/dashboard" replace />;

    // Last-resort fallback if the profile is corrupted or unknown
    return <Navigate to="/" replace />;
  }

  // 5. SUCCESS: access granted
  return children;
};