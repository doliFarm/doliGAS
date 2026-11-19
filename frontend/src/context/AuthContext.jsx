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
 * @file frontend/src/context/AuthContext.jsx
 * @version v1.0.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Authentication Context Provider. Handles Login/Logout logic, OTP verification, Profile Switching, and Token management.
 * @status Stable
 * @date 2026-01-16
 */

import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- INTERCEPTOR FOR EXPIRED SESSIONS ---
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          const path = window.location.pathname;
          if (!path.startsWith('/auth') && !path.startsWith('/welcome') && path !== '/') {
             console.warn("[AUTH] Sessione scaduta. Logout.");
             logout();
          }
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  // --- API CALLS ---
  const requestOtp = async (contact, gasSlug) => {
    try {
      const res = await axios.post('/api/auth/login', { contact, gasSlug });
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || "Errore comunicazione server");
    }
  };

  const verifyOtp = async (contact, code) => {
    try {
      const res = await axios.post('/api/auth/verify', { contact, token: code });
      if (res.data.success) {
        login(res.data.token, res.data.user, res.data.profiles);
        return res.data;
      }
    } catch (err) {
      throw new Error(err.response?.data?.error || "Codice non valido");
    }
  };

  const login = (token, userData, userProfiles) => {
    localStorage.setItem('doliGAS_token', token);
    localStorage.setItem('doliGAS_user', JSON.stringify(userData));
    localStorage.setItem('doliGAS_profiles', JSON.stringify(userProfiles));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    setProfiles(userProfiles);
    if (userProfiles && userProfiles.length === 1) {
      switchProfile(userProfiles[0]);
    }
  };

  const switchProfile = (profile) => {
    if (!profile) {
      setActiveProfile(null);
      localStorage.removeItem('doliGAS_active_profile');
    } else {
      setActiveProfile(profile);
      localStorage.setItem('doliGAS_active_profile', JSON.stringify(profile));
    }
  };

  // --- SMART LOGOUT v11.0 ---
  const logout = () => {
    // 1. Full cleanup
    setUser(null);
    setActiveProfile(null);
    setProfiles([]);
    localStorage.clear(); // Thorough cleanup
    delete axios.defaults.headers.common['Authorization'];

    // 2. Work out the redirect
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // On a subdomain (e.g. demo.dolifarm.com) -> go to /auth/login
    // On the root or welcome (e.g. welcome.dolifarm.com) -> reload the page (which goes to Welcome)
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'welcome') {
        window.location.href = '/auth/login';
    } else {
        window.location.href = '/';
    }
  };

  // --- REHYDRATION ---
  useEffect(() => {
    const initAuth = () => {
      const token = localStorage.getItem('doliGAS_token');
      const savedUser = localStorage.getItem('doliGAS_user');
      const savedProfiles = localStorage.getItem('doliGAS_profiles');
      const savedActive = localStorage.getItem('doliGAS_active_profile');

      if (token && savedUser) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
            setUser(JSON.parse(savedUser));
            if (savedProfiles) setProfiles(JSON.parse(savedProfiles));
            if (savedActive) setActiveProfile(JSON.parse(savedActive));
        } catch (e) { logout(); }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profiles, activeProfile, loading, requestOtp, verifyOtp, login, logout, switchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);