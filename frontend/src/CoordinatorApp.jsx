/**
 * @file frontend/src/CoordinatorApp.jsx
 * @version v1.2.4
 * @author Luigi GRILLO @ doliFarm.com
 * @description Layout principale Coordinatore. Header ottimizzato (GAS [Nome]) e Ruolo nel menu a tendina.
 * @status Integro, Completo, Robusto.
 * @date 2026-02-24
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, NavLink, useNavigate } from 'react-router-dom';
import { SidebarMenu } from './components/SidebarMenu';
import { useAuth } from './context/AuthContext';
import { 
  Menu, Bell, LayoutDashboard, Users, ShoppingBag, 
  Truck, LogOut, ChevronDown, User, Shield, FileText, RefreshCw,
  Tractor // <-- Icona aggiunta per i Produttori
} from 'lucide-react';
import { Modal, Button } from './components/ui-kit';
import { PrivacyContent, TermsContent } from './views/LegalViews';
import { UserProfileView } from './views/member/UserProfileView';
import { LanguageSelector } from './components/LanguageSelector';

export const CoordinatorApp = () => {
  const { user, logout, activeProfile, profiles, switchProfile } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // STATI UI
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  const menuRef = useRef(null);

  // Chiusura automatica del menu al click esterno
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

  const formatGasName = (name) => {
    if (!name) return '';
    const cleaned = name.replace(/GAS\s+DOLIFARM/i, '').trim();
    return `GAS ${cleaned}`;
  };

  const getPageTitle = () => {
    const p = location.pathname;
    if (p.includes('dashboard')) return t('admin_dashboard.title_dashboard');
    if (p.includes('members')) return t('admin_members.title');
    if (p.includes('producers')) return t('admin_producers.title'); 
    if (p.includes('catalog')) return t('admin_catalog.title');
    if (p.includes('logistics')) return t('admin_logistics.title');
    if (p.includes('cycles')) return t('admin_cycles.title');
    if (p.includes('settings')) return t('admin_settings.title');
    return 'GASHUB ADMIN';
  };

  // NavItems per la Bottom Bar Mobile - Inserito ADM_PROD
  const navItems = [
    { label: t('common.nav.dashboard'), path: '/admin/dashboard', icon: LayoutDashboard },
    { label: t('common.nav.members'), path: '/admin/members', icon: Users },
    { label: t('admin_producers.title'), path: '/admin/producers', icon: Tractor }, 
    { label: t('common.nav.catalog'), path: '/admin/catalog', icon: ShoppingBag },
    { label: t('common.nav.logistics'), path: '/admin/logistics', icon: Truck },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* SIDEBAR DESKTOP / DRAWER MOBILE */}
      <SidebarMenu 
        user={user} 
        onLogout={logout} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* HEADER */}
        <header className="bg-white/80 backdrop-blur-md border-b px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between shrink-0 z-30 sticky top-0">
          
          <div className="flex flex-col">
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-tight">
              {getPageTitle()}
            </h2>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">
              {formatGasName(activeProfile?.context_name)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="lg:hidden p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Menu size={24} />
            </button>

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
                        {/* Nome con Ruolo accanto in Badge */}
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-slate-800 truncate">{user?.first_name} {user?.last_name}</p>
                          <span className="shrink-0 text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md uppercase border border-emerald-200/50">
                            {activeProfile?.role_name}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                    </div>
                    
                    <div className="px-2 pt-2 pb-1">
                      <LanguageSelector />
                    </div>
                    
                    <div className="p-2 border-t border-slate-50">
                        {profiles.length > 1 && (
                          <button onClick={handleSwitchContext} className="w-full mb-1 flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors text-left">
                              <RefreshCw size={18} /> {t('common.switch_profile')}
                          </button>
                        )}

                        <button onClick={() => { setIsUserMenuOpen(false); setShowProfile(true); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-emerald-600 rounded-xl transition-colors text-left">
                            <User size={18}/> {t('common.my_profile')}
                        </button>
                        
                        <div className="border-t border-slate-50 mt-1 pt-1">
                          <button onClick={() => { setIsUserMenuOpen(false); setShowPrivacy(true); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors text-left">
                              <Shield size={16}/> {t('common.privacy')}
                          </button>
                          <button onClick={() => { setIsUserMenuOpen(false); setShowTerms(true); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors text-left">
                              <FileText size={16}/> {t('common.terms')}
                          </button>
                        </div>

                        <button onClick={logout} className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors text-left">
                            <LogOut size={18}/> {t('common.logout')}
                        </button>
                    </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 pb-24 lg:pb-8 flex flex-col">
          <div className="flex-1">
            <Outlet />
          </div>
          
          <footer className="mt-auto py-8 border-t border-slate-200/50 text-center shrink-0">
            <a href="https://dolifarm.com" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-emerald-500 transition-colors text-[9px] font-black uppercase tracking-[0.2em] opacity-80">
              Powered by doliFarm.com
            </a>
          </footer>
        </main>

        {/* BOTTOM NAVIGATION MOBILE */}
        <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="flex justify-around items-center h-16">
            {navItems.map((item) => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
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

            <button onClick={logout} className="flex flex-col items-center justify-center w-full h-full space-y-1 text-slate-400 hover:text-red-500 transition-colors">
              <div className="p-1.5 rounded-xl"><LogOut size={24} /></div>
              <span className="text-[10px] font-black uppercase tracking-tight">{t('common.logout')}</span>
            </button>
          </div>
        </nav>
      </div>

      {/* MODALI DI SISTEMA */}
      <Modal isOpen={showProfile} onClose={() => setShowProfile(false)} title={t('common.my_profile')}>
         <div className="p-6">
            <UserProfileView />
            <div className="mt-6 pt-4 border-t border-slate-100"><Button onClick={() => setShowProfile(false)} className="w-full">{t('common.close')}</Button></div>
         </div>
      </Modal>
      <Modal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} title={t('common.privacy')}><div className="p-6"><PrivacyContent /><div className="mt-6 pt-4 border-t border-slate-100"><Button onClick={() => setShowPrivacy(false)} className="w-full">{t('common.close')}</Button></div></div></Modal>
      <Modal isOpen={showTerms} onClose={() => setShowTerms(false)} title={t('common.terms')}><div className="p-6"><TermsContent /><div className="mt-6 pt-4 border-t border-slate-100"><Button onClick={() => setShowTerms(false)} className="w-full">{t('common.close')}</Button></div></div></Modal>
    </div>
  );
};