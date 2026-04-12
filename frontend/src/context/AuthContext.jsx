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

  // --- INTERCETTORE PER SESSIONE SCADUTA ---
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

  // --- API CHIAMATE ---
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

  // --- LOGOUT INTELLIGENTE v11.0 ---
  const logout = () => {
    // 1. Pulizia Totale
    setUser(null);
    setActiveProfile(null);
    setProfiles([]);
    localStorage.clear(); // Pulizia radicale
    delete axios.defaults.headers.common['Authorization'];

    // 2. Calcolo Redirect
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // Se siamo su un sottodominio (es. demo.dolifarm.com) -> Vai a /auth/login
    // Se siamo su root o welcome (es. welcome.dolifarm.com) -> Ricarica la pagina (che andrà a Welcome)
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'welcome') {
        window.location.href = '/auth/login';
    } else {
        window.location.href = '/';
    }
  };

  // --- REIDRATAZIONE ---
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