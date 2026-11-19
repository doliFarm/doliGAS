/**
 * @file frontend/src/components/ProfileSelector.jsx
 * @version v1.1.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Identity Gate Component. Permette agli utenti con ruoli/contesti multipli di selezionare il profilo attivo.
 *              Include un popup informativo iniziale per la modalità DEMO ad attivazione singola per sessione.
 * @status Integro, Completo, Robusto.
 * @date 2026-06-04
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { APP_CONFIG } from '../config';
import { Card, Badge, Modal, Button } from './ui-kit';
import { ShieldCheck, ShoppingCart, Tractor, LogOut, Info } from 'lucide-react';

export const ProfileSelector = () => {
  const { profiles, switchProfile, user, logout } = useAuth();
  const { t } = useTranslation();
  
  // Stato per il controllo di visibilità del popup demo
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  useEffect(() => {
    // L'avviso riguarda SOLO l'istanza dimostrativa: su un'installazione reale di un GAS
    // non deve comparire. Si attiva con VITE_DEMO_MODE=true nel .env.
    if (!APP_CONFIG.DEMO_MODE) return;
    // sessionStorage: mostrato una volta per sessione del browser
    try {
      if (!sessionStorage.getItem('doliGAS_demo_notice_seen')) setIsDemoModalOpen(true);
    } catch (e) {
      setIsDemoModalOpen(true); // sessionStorage non disponibile: mostra comunque l'avviso
    }
  }, []);

  const handleCloseModal = () => {
    setIsDemoModalOpen(false);
    // Memorizza lo stato per non riproporlo fino alla chiusura della sessione del browser
    try {
      sessionStorage.setItem('doliGAS_demo_notice_seen', 'true');
    } catch (e) { /* ignorato: l'avviso ricomparirà al prossimo accesso */ }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <h2 className="text-4xl font-black text-white mb-2 tracking-tight">{t('profile_selector.welcome_back', 'Bentornato')}, {user?.first_name}</h2>
           <p className="text-slate-400 font-medium text-lg">{t('profile_selector.select_profile_subtitle', 'Seleziona con quale profilo vuoi operare oggi')}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {profiles.map((p, idx) => (
            <Card 
              key={p.id || idx} 
              onClick={() => switchProfile(p)}
              className="group relative p-8 bg-white border-none cursor-pointer transition-all hover:-translate-y-2 shadow-2xl hover:shadow-emerald-500/20 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="mb-8 flex justify-center relative z-10">
                <div className={`p-6 rounded-[2rem] transition-colors duration-300 shadow-sm ${
                    p.type === 'PRODUCER' ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white' :
                    p.role_name === 'Coordinatore' ? 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white' :
                    'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white'
                }`}>
                  {p.type === 'GAS' && p.role_name === 'Coordinatore' && <ShieldCheck size={48}/>}
                  {p.type === 'GAS' && p.role_name === 'Socio' && <ShoppingCart size={48}/>}
                  {p.type === 'PRODUCER' && <Tractor size={48}/>}
                </div>
              </div>
              
              <div className="text-center relative z-10">
                <h3 className="text-slate-800 font-black text-xl mb-3 leading-tight group-hover:text-slate-900">
                    {p.context_name || 'Nome non disponibile'}
                </h3>
                
                <Badge color={p.type === 'PRODUCER' ? 'orange' : (p.role_name === 'Coordinatore' ? 'indigo' : 'emerald')} className="uppercase font-black tracking-widest text-[10px] px-3 py-1">
                  {p.role_name}
                </Badge>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
            <button onClick={logout} className="text-slate-500 hover:text-white flex items-center gap-2 mx-auto text-sm font-bold transition-colors">
                <LogOut size={16}/> {t('profile_selector.back_home', 'Esci e torna alla home')}
            </button>
        </div>
      </div>

      {/* MODALE DI AVVISO DEMO (Attivato all'accesso immediato post-login) */}
  <Modal 
        isOpen={isDemoModalOpen} 
        onClose={handleCloseModal} 
        title={t('demo_popup.title')}
      >
        <div className="p-2 text-center font-sans">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
            <Info size={28} />
          </div>
          
          {/* CORREZIONE ROBUSTA: dangerouslySetInnerHTML interpreta i tag <b> e whitespace-pre-line mantiene i ritorni a capo \n */}
          <div 
            className="text-sm text-slate-600 bg-slate-50 border border-slate-100 p-5 rounded-2xl text-left leading-relaxed shadow-inner whitespace-pre-line"
            dangerouslySetInnerHTML={{ __html: t('demo_popup.message') }}
          />

          <div className="mt-6">
            <Button 
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl py-3 border-none shadow-md"
              onClick={handleCloseModal}
            >
              {t('demo_popup.btn_continue')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
