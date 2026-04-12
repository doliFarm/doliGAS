/**
 * @file frontend/src/MemberApp.jsx
 * @version v1.1.3
 * @author Luigi GRILLO @ doliFarm.com
 * @description Main Layout for Members. Updated with Logout button in bottom fixed navigation.
 * @status Integro, Completo, Robusto.
 * @date 2026-02-23
 */

import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './context/AuthContext';
import { 
  LayoutGrid, ShoppingBag, Wallet, LogOut, 
  Store, Shield, FileText, ClipboardList, User, ChevronDown, RefreshCw 
} from 'lucide-react';
import { Modal, Button } from './components/ui-kit'; 
import { PrivacyContent, TermsContent } from './views/LegalViews'; 
import { UserProfileView } from './views/member/UserProfileView'; 
import { LanguageSelector } from './components/LanguageSelector';

export const MemberApp = () => {
  const { user, logout, profiles, switchProfile, activeProfile } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  
  // STATI MODALI
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  // STATO MENU UTENTE
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Gestione chiusura menu al click esterno
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitchContext = () => {
    setIsUserMenuOpen(false);
    switchProfile(null);
    navigate('/');
  };

  const navItems = [
    { label: t('member.nav.home', 'Home'), path: '/member/dashboard', icon: LayoutGrid },
    { label: t('member.nav.shop', 'Bottega'), path: '/member/shop', icon: ShoppingBag },
    { label: t('member.nav.orders', 'Ordini'), path: '/member/orders', icon: ClipboardList },
    { label: t('member.nav.wallet', 'Wallet'), path: '/member/wallet', icon: Wallet },
  ];

  const getPageTitle = () => {
    const p = location.pathname;
    if (p.includes('shop')) return t('member.titles.shop', 'La Bottega');
    if (p.includes('wallet')) return t('member.titles.wallet', 'Il mio Portafoglio');
    if (p.includes('orders')) return t('member.titles.orders', 'I miei Ordini');
    return `${t('common.greeting', 'Ciao')}, ${user?.first_name || 'Socio'}`;
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* SIDEBAR DESKTOP (Uniformata con il nuovo design compatto) */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-100 h-[100dvh] z-20">
        
        {/* HEADER LOGO CON SWITCHER INCORPORATO */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-1.5 bg-emerald-600 rounded-lg text-white shadow-md shadow-emerald-100 shrink-0">
              <Store size={18} />
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
                {t('common.member_area', 'Area Socio')}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => (
            <NavLink 
              key={item.path} 
              to={item.path} 
              className={({ isActive }) => `flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 font-bold group ${isActive ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 transition-colors'}`} /> 
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          
          <div className="pt-6 mt-6 border-t border-slate-100">
              <p className="px-4 text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Legale</p>
              <button onClick={() => setShowPrivacy(true)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs text-slate-400 hover:text-emerald-600 hover:bg-slate-50 font-bold transition-all text-left"><Shield size={16}/> {t('common.privacy', 'Privacy Policy')}</button>
              <button onClick={() => setShowTerms(true)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs text-slate-400 hover:text-emerald-600 hover:bg-slate-50 font-bold transition-all text-left"><FileText size={16}/> {t('common.terms', 'Condizioni d\'uso')}</button>
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
              {t('common.logout', 'Esci')}
            </span>
          </button>
        </div>
      </aside>

      {/* CONTENUTO PRINCIPALE */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* HEADER */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100 px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between shrink-0">
          <div>
             <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-tight">{getPageTitle()}</h2>
             <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">{activeProfile?.context_name}</p>
          </div>
          
          <div className="flex items-center gap-3">
              <div className="relative" ref={menuRef}>
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} 
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors focus:outline-none border border-transparent hover:border-slate-200"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-white shadow-sm flex items-center justify-center text-emerald-700 font-black text-lg">
                      {user?.first_name?.charAt(0).toUpperCase()}
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                          <p className="text-sm font-bold text-slate-800">{user?.first_name} {user?.last_name}</p>
                          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                      </div>
                      
                      <div className="px-2 pt-2 pb-1">
                        <LanguageSelector />
                      </div>
                      
                      <div className="p-2 border-t border-slate-50">
                          {profiles.length > 1 && (
                            <button onClick={handleSwitchContext} className="w-full mb-1 flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors text-left">
                                <RefreshCw size={18} /> {t('common.switch_profile', 'Cambia Profilo')}
                            </button>
                          )}

                          <button onClick={() => { setIsUserMenuOpen(false); setShowProfile(true); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-emerald-600 rounded-xl transition-colors text-left">
                              <User size={18}/> {t('common.my_profile', 'Il mio Profilo')}
                          </button>
                          
                          <div className="md:hidden border-t border-slate-50 mt-1 pt-1">
                            <button onClick={() => { setIsUserMenuOpen(false); setShowPrivacy(true); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors text-left">
                                <Shield size={16}/> {t('common.privacy', 'Privacy Policy')}
                            </button>
                            <button onClick={() => { setIsUserMenuOpen(false); setShowTerms(true); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors text-left">
                                <FileText size={16}/> {t('common.terms', 'Termini di Utilizzo')}
                            </button>
                          </div>

                          <button onClick={logout} className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors text-left">
                              <LogOut size={18}/> {t('common.logout', 'Esci')}
                          </button>
                      </div>
                  </div>
                )}
              </div>
          </div>
        </header>

        {/* VIEWPORT PRINCIPALE */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 pb-24 flex flex-col">
          <div className="flex-1">
              <Outlet />
          </div>
          
          <footer className="mt-auto py-8 border-t border-slate-200/50 text-center shrink-0">
              <a 
                href="https://dolifarm.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-slate-300 hover:text-emerald-500 transition-colors text-[9px] font-black uppercase tracking-[0.2em] opacity-80"
              >
                Powered by doliFarm.com
              </a>
          </footer>
        </main>

        {/* BOTTOM NAVIGATION MOBILE (Aggiornata con tasto Esci) */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="flex justify-around items-center h-16">
            {/* Rotte NavItems */}
            {navItems.map((item) => (
              <NavLink 
                key={item.path} 
                to={item.path} 
                className={({ isActive }) => `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-emerald-50 translate-y-[-2px]' : ''}`}>
                      <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-tight">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}

            {/* PULSANTE ESCI (Azione Logout) */}
            <button 
              onClick={logout}
              className="flex flex-col items-center justify-center w-full h-full space-y-1 text-slate-400 hover:text-red-500 transition-colors"
            >
              <div className="p-1.5 rounded-xl">
                <LogOut size={24} strokeWidth={2} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-tight">{t('common.logout', 'Esci')}</span>
            </button>
          </div>
        </nav>
      </div>

      {/* MODALI DI SISTEMA */}
      <Modal isOpen={showProfile} onClose={() => setShowProfile(false)} title={t('common.my_profile', 'Il mio Profilo')}>
         <div className="p-6">
            <UserProfileView />
            <div className="mt-6 pt-4 border-t border-slate-100"><Button onClick={() => setShowProfile(false)} className="w-full">{t('common.close', 'Chiudi')}</Button></div>
         </div>
      </Modal>
      
      <Modal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} title={t('common.privacy', 'Privacy Policy')}>
        <div className="p-6">
          <PrivacyContent />
          <div className="mt-6 pt-4 border-t border-slate-100"><Button onClick={() => setShowPrivacy(false)} className="w-full">{t('common.close', 'Chiudi')}</Button></div>
        </div>
      </Modal>
      
      <Modal isOpen={showTerms} onClose={() => setShowTerms(false)} title={t('common.terms', 'Termini e Condizioni')}>
        <div className="p-6">
          <TermsContent />
          <div className="mt-6 pt-4 border-t border-slate-100"><Button onClick={() => setShowTerms(false)} className="w-full">{t('common.close', 'Chiudi')}</Button></div>
        </div>
      </Modal>
    </div>
  );
};