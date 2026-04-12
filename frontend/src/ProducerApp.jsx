/**
 * @file frontend/src/ProducerApp.jsx
 * @version v1.1.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Main Layout for Producers. Updated with User Dropdown improvements (Badge + Legal links).
 * @status Integro, Completo, Robusto.
 * @date 2026-02-24
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { 
  LayoutDashboard, Package, ClipboardList, LogOut, 
  Store, Tractor, Shield, FileText, Heart, X, RefreshCw, ChevronRight, ChevronDown, User, Info,
  Loader2 
} from 'lucide-react';
import { Modal, Button, Badge } from './components/ui-kit'; 
import { PrivacyContent, TermsContent } from './views/LegalViews';
import { ProducerProfileView } from './views/producer/ProducerProfileView'; 
import { LanguageSelector } from './components/LanguageSelector';

export const ProducerApp = () => {
  const { user, activeProfile, profiles, switchProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  
  // STATI MODALI
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  const [cycleStatus, setCycleStatus] = useState(null);
  
  // Stato Menu Dropdown
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Chiusura menu al click esterno
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Carica lo stato del ciclo per i pallini di notifica
  useEffect(() => {
    const fetchStatus = async () => {
      if (!activeProfile || activeProfile.type !== 'PRODUCER') return;
      try {
        const res = await axios.get(`/api/products/dashboard-status?producerId=${activeProfile.context_id}`);
        setCycleStatus(res.data.state);
      } catch (err) { console.warn("Status Check Failed"); }
    };
    fetchStatus();
  }, [activeProfile]);

  const getStatusDot = (menuKey) => {
    if (!cycleStatus || cycleStatus === 'NO_CYCLE') return 'bg-slate-300';
    switch (menuKey) {
      case 'editor':
        if (cycleStatus === 'LIST_OPEN') return 'bg-emerald-500 shadow-glow';
        if (['WAITING', 'ORDERS_RECEIVED'].includes(cycleStatus)) return 'bg-red-500'; 
        return 'bg-slate-300';
      case 'orders':
        if (cycleStatus === 'ORDERS_RECEIVED') return 'bg-emerald-500 shadow-glow';
        return 'bg-slate-300';
      default: return null;
    }
  };

  const handleSwitchContext = () => {
    setIsUserMenuOpen(false);
    switchProfile(null);
    navigate('/');
  };

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logout();
  };

  const navItems = [
    { label: 'Dashboard', path: '/producer/dashboard', icon: LayoutDashboard, id: 'dash' },
    { label: 'Gestione Listino', path: '/producer/editor', icon: Package, id: 'editor' },
    { label: 'Ordini Ricevuti', path: '/producer/orders', icon: ClipboardList, id: 'orders' },
  ];

  const getPageTitle = () => {
    const p = location.pathname;
    if (p.includes('editor')) return 'Gestione Listino';
    if (p.includes('orders')) return 'Ordini da Preparare';
    return `${t('common.greeting')} ${user?.first_name || t('common.user')}`;
  };

  return (
    <div className="flex h-screen bg-amber-50/30 overflow-hidden font-sans">
      
     {/* --- DESKTOP SIDEBAR (Uniformata al nuovo design compatto) --- */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-100 h-[100dvh] z-20">
        
        {/* HEADER LOGO CON SWITCHER INCORPORATO */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-1.5 bg-amber-500 rounded-lg text-white shadow-md shadow-amber-200 shrink-0">
              <Tractor size={18} />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-800 text-lg tracking-tighter italic leading-none">
                  doliGAS
                </span>
                {/* Switcher: Aggiunto shrink-0 per evitare che venga compresso */}
                {profiles?.length > 1 && (
                  <button 
                    onClick={handleSwitchContext}
                    className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-500 text-indigo-600 hover:text-white px-1.5 py-0.5 rounded transition-colors group shrink-0"
                    title={t('common.switch_profile', 'Cambia Profilo')}
                  >
                    <RefreshCw size={8} className="group-hover:rotate-180 transition-transform duration-500" />
                    <span className="text-[7.5px] font-black uppercase tracking-widest leading-none pt-[1px]">
                      {t('common.switch', 'Cambia')}
                    </span>
                  </button>
                )}
              </div>
              <span className="text-[8.5px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1.5 truncate">
                {activeProfile?.producer_area || 'PRODUTTORE'}
              </span>
            </div>
          </div>
        </div>

        {/* NAVIGAZIONE CONTESTUALE */}
        <nav className="flex-1 px-4 space-y-2 py-4 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => {
            const dotClass = getStatusDot(item.id);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  relative flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 font-bold group
                  ${isActive ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}
                `}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 transition-colors'}`} /> 
                    <span className="text-sm truncate">{item.label}</span>
                    {dotClass && <span className={`absolute right-4 w-2 h-2 rounded-full border border-white/50 ${dotClass}`} />}
                  </>
                )}
              </NavLink>
            );
          })}
          
          <div className="pt-6 mt-6 border-t border-slate-100">
              <p className="px-4 text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Supporto Legale</p>
              <button onClick={() => setShowPrivacy(true)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs text-slate-400 hover:text-amber-600 hover:bg-slate-50 font-bold transition-all text-left"><Shield size={16}/> Privacy Policy</button>
              <button onClick={() => setShowTerms(true)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs text-slate-400 hover:text-amber-600 hover:bg-slate-50 font-bold transition-all text-left"><FileText size={16}/> Condizioni d'uso</button>
          </div>
        </nav>

        {/* FOOTER: LOGOUT */}
        <div className="p-4 border-t border-slate-100 shrink-0 bg-white">
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-3.5 bg-red-50 hover:bg-red-500 text-red-600 hover:text-white rounded-xl transition-all group border border-red-100/50 shadow-sm"
            title={t('common.logout')}
          >
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[11px] font-black uppercase tracking-tight truncate">
              {t('common.logout') || 'Esci'}
            </span>
          </button>
        </div>
      </aside>

      {/* --- MAIN AREA --- */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* HEADER */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100 px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between shrink-0">
          <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-tight">{getPageTitle()}</h2>
             {activeProfile?.gas_slug && <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">  {activeProfile.context_name} -  {activeProfile.gas_slug}</p>}
          </div>
          
          <div className="flex items-center gap-3">
             
             {/* USER MENU DROPDOWN */}
             <div className="relative" ref={menuRef}>
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} 
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors focus:outline-none border border-transparent hover:border-slate-200"
                >
                    <div className="w-10 h-10 rounded-full bg-amber-100 border-2 border-white shadow-sm flex items-center justify-center text-amber-700 font-black text-lg">
                       {user?.first_name?.charAt(0).toUpperCase()}
                    </div>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isUserMenuOpen && (
                   <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                       <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                           <div className="flex items-center justify-between mb-1">
                               <p className="text-sm font-bold text-slate-800">{user?.first_name} {user?.last_name}</p>
                               {/* BADGE PRODUTTORE RICHIESTO */}
                               <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter border border-amber-200">
                                   Produttore
                               </span>
                           </div>
                           <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                       </div>
                       
                       {/* LINGUA */}
                       <div className="px-2 pt-2 border-b border-slate-50 pb-2">
                          <LanguageSelector />
                       </div>

                       <div className="p-2 space-y-1">
                           {profiles.length > 1 && (
                            <button onClick={handleSwitchContext} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors text-left">
                                <RefreshCw size={18} /> Cambia Profilo
                            </button>
                           )}

                           <button onClick={() => { setIsUserMenuOpen(false); setShowProfile(true); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-amber-600 rounded-xl transition-colors text-left">
                               <User size={18}/> Scheda Aziendale
                           </button>

                           {/* VOCI LEGALI (Uniformate al Socio) */}
                           <div className="md:hidden border-t border-slate-50 mt-1 pt-1">
                              <button onClick={() => { setIsUserMenuOpen(false); setShowPrivacy(true); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors text-left">
                                  <Shield size={16}/> Privacy Policy
                              </button>
                              <button onClick={() => { setIsUserMenuOpen(false); setShowTerms(true); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors text-left">
                                  <FileText size={16}/> Utilizzo del sito
                              </button>
                           </div>

                           <div className="pt-1 mt-1 border-t border-slate-50">
                               <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors text-left">
                                   <LogOut size={18}/> Esci
                               </button>
                           </div>
                       </div>
                   </div>
                )}
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 pb-32 sm:pb-8">
            <Outlet />
            <footer className="mt-20 py-8 border-t border-slate-200/60 text-center shrink-0">
               <a href="https://dolifarm.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-slate-300 hover:text-amber-600 transition-colors text-[9px] font-black uppercase tracking-[0.2em] opacity-80">
                   Powered by doliFarm.com
               </a>
            </footer>
        </main>

        {/* --- MOBILE NAV (Aggiornata con Logout) --- */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="flex justify-around items-center h-16">
            {navItems.map((item) => {
              const dotClass = getStatusDot(item.id);
              return (
                <NavLink 
                  key={item.path} 
                  to={item.path} 
                  className={({ isActive }) => `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? 'text-amber-600' : 'text-slate-400'}`}
                >
                  {({ isActive }) => (
                    <>
                      <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-amber-50 translate-y-[-2px]' : ''} relative`}>
                        <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                        {dotClass && <span className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${dotClass}`} />}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-tight">{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
            {/* Tasto Esci Mobile richiesto per simmetria con Socio */}
            <button onClick={logout} className="flex flex-col items-center justify-center w-full h-full space-y-1 text-slate-400 hover:text-red-500 transition-colors">
              <div className="p-1.5 rounded-xl">
                <LogOut size={24} strokeWidth={2} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-tight">Esci</span>
            </button>
          </div>
        </nav>
      </div>

      {/* --- MODALI DI SISTEMA --- */}
      <Modal isOpen={showProfile} onClose={() => setShowProfile(false)} title="Scheda Aziendale">
          <div className="p-6">
            <ProducerProfileView />
            <div className="mt-6 pt-4 border-t border-slate-100">
              <Button onClick={() => setShowProfile(false)} className="w-full">Chiudi</Button>
            </div>
          </div>
      </Modal>

      <Modal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} title="Privacy Policy">
        <div className="p-6">
          <PrivacyContent />
          <div className="mt-6 pt-4 border-t border-slate-100">
            <Button onClick={() => setShowPrivacy(false)} className="w-full">Chiudi</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showTerms} onClose={() => setShowTerms(false)} title="Condizioni d'Uso">
        <div className="p-6">
          <TermsContent />
          <div className="mt-6 pt-4 border-t border-slate-100">
            <Button onClick={() => setShowTerms(true)} className="w-full">Chiudi</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};