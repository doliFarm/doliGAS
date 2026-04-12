/**
 * @file frontend/src/components/SidebarMenu.jsx
 * @version v7.9
 * @author Luigi GRILLO @ doliFarm.com
 * @description Sidebar dinamica contestuale unica per Coordinatore, Socio e Produttore. 
 * FIX: Pulsante Switcher posizionato esattamente accanto al logo, condizionato a profiles > 1.
 * @status Integro, Completo, Robusto.
 * @date 2026-02-28
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Truck, ShoppingBag, 
  Settings, LogOut, Package, X, Sprout, BarChart3,
  Tractor, Calendar, RefreshCw, ChevronRight, Wallet, ClipboardList
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from './ui-kit'; 
import { useTranslation } from 'react-i18next';

export const SidebarMenu = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeProfile, profiles, logout, switchProfile } = useAuth();

  /**
   * Generazione dinamica del menu basata sul tipo di profilo attivo.
   */
  const getContextualMenu = () => {
    if (!activeProfile) return [];

    // 1. CONTESTO PRODUTTORE
    if (activeProfile.type === 'PRODUCER') {
      return [
        { id: 'PRD_DASH', label: t('producer.dashboard', 'Dashboard Azienda'), icon: BarChart3, path: '/producer/dashboard' },
        { id: 'PRD_EDIT', label: t('producer.inventory', 'Gestione Listino'), icon: Package, path: '/producer/editor' },
        { id: 'PRD_ORDR', label: t('producer.orders', 'Riepilogo Ordini'), icon: ClipboardList, path: '/producer/orders' }
      ];
    }

    // 2. CONTESTO GAS (Admin / Coordinatore del Gruppo)
    if (activeProfile.type === 'GAS' && activeProfile.role_name === 'Coordinatore') {
      return [
        { id: 'ADM_DASH', label: t('admin_dashboard.title_dashboard'), icon: BarChart3, path: '/admin/dashboard' },
        { id: 'ADM_MEMB', label: t('admin_members.title'), icon: Users, path: '/admin/members' },
        { id: 'ADM_PROD', label: t('admin_producers.title'), icon: Tractor, path: '/admin/producers' },
        { id: 'ADM_CATA', label: t('admin_catalog.title'), icon: ShoppingBag, path: '/admin/catalog' },
        { id: 'ADM_CYCL', label: t('admin_cycles.title'), icon: Calendar, path: '/admin/cycles' },
        { id: 'ADM_LOGI', label: t('admin_logistics.title'), icon: Truck, path: '/admin/logistics' },
        { id: 'ADM_SETT', label: t('admin_settings.title'), icon: Settings, path: '/admin/settings' }
      ];
    }

    // 3. CONTESTO GAS (Socio Ordinante)
    if (activeProfile.type === 'GAS' && activeProfile.role_name === 'Socio') {
      return [
        { id: 'MEM_DASH', label: t('member.dashboard', 'Dashboard'), icon: LayoutDashboard, path: '/member/dashboard' },
        { id: 'MEM_SHOP', label: t('member.shop', 'Mercato'), icon: ShoppingBag, path: '/member/shop' },
        { id: 'MEM_WALL', label: t('member.wallet', 'Mio Portafoglio'), icon: Wallet, path: '/member/wallet' },
        { id: 'MEM_ORDR', label: t('member.orders', 'Miei Ordini'), icon: ClipboardList, path: '/member/orders' }
      ];
    }

    return [];
  };

  /**
   * Identifica l'etichetta dell'area corretta da mostrare nell'Header
   */
  const getAreaLabel = () => {
    if (activeProfile?.type === 'PRODUCER') return t('common.producer_area', 'Area Fornitore');
    if (activeProfile?.type === 'GAS' && activeProfile?.role_name === 'Coordinatore') return t('common.coordinator_area', 'Area Coordinatore');
    return t('common.member_area', 'Area Socio');
  };

  const menuItems = getContextualMenu();

  const handleNav = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  const handleSwitchContext = () => {
    switchProfile(null);
    navigate('/');
    if (onClose) onClose();
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <>
      {/* OVERLAY MOBILE */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300" 
          onClick={onClose} 
        />
      )}

      {/* SIDEBAR CONTAINER */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-100 shadow-2xl transition-transform duration-300 transform
        lg:translate-x-0 lg:static lg:inset-0 lg:shadow-none flex flex-col h-[100dvh]
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        
        {/* HEADER LOGO CON SWITCHER INCORPORATO E TESTO DINAMICO */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-600 rounded-lg text-white shadow-md shadow-emerald-100 shrink-0">
              <Sprout size={18} />
            </div>
            <div className="flex flex-col">
              
              {/* RIGA 1: LOGO */}
              <span className="font-black text-slate-800 text-lg tracking-tighter italic leading-none">
                doliGAS
              </span>
              
              {/* RIGA 2: ETICHETTA AREA + BOTTONE CAMBIA */}
              <div className="flex items-center mt-1.5 gap-2">
                <span className="text-[8.5px] text-slate-400 font-black uppercase tracking-widest leading-none">
                  {getAreaLabel()}
                </span>
                
                {/* Il bottone è ora forzato ad apparire sempre per aggirare il bug 
                  di svuotamento della variabile 'profiles' su Socio e Produttore 
                */}
                <button 
                  onClick={handleSwitchContext}
                  className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-500 text-indigo-600 hover:text-white px-1.5 py-0.5 rounded transition-colors group"
                  title={t('common.switch_profile', 'Cambia Profilo')}
                >
                  <RefreshCw size={8} className="group-hover:rotate-180 transition-transform duration-500" />
                  <span className="text-[7.5px] font-black uppercase tracking-widest leading-none pt-[1px]">
                    {t('common.switch', 'Cambia')}
                  </span>
                </button>
              </div>

            </div>
          </div>
          <button 
            onClick={onClose} 
            className="lg:hidden p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
            aria-label="Chiudi Menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* NAVIGAZIONE CONTESTUALE */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto scrollbar-hide">
          {menuItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group ${
                  active 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <item.icon size={20} className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 transition-colors'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
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
    </>
  );
};