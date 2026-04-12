/**
 * @file frontend/src/views/auth/Login.jsx
 * @version v1.1.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Login View. Gestione OTP con auto-rilevamento sottodominio e supporto Debug Console.
 * @status Integro, Completo, Robusto.
 * @date 2026-02-23
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  LogIn, ArrowRight, Globe, Users, Sprout, Heart 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Toast } from '../../components/ui-kit';
import { LanguageSelector } from '../../components/LanguageSelector';

export const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { requestOtp } = useAuth();
  
  const [formData, setFormData] = useState({ gasSlug: '', contact: '' });
  const [isGasLocked, setIsGasLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // --- AUTO-DETECT SUBDOMAIN ---
  useEffect(() => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // Logica Subdomain: se siamo su [slug].dolifarm.com
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'welcome') {
        setFormData(prev => ({ ...prev, gasSlug: parts[0] }));
        setIsGasLocked(true); 
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setToast(null);

    try {
      // Chiamata al backend
      const res = await requestOtp(formData.contact, formData.gasSlug);
      
      if (res.success) {
        // --- LOGICA ROBUSTA DEBUG OTP ---
        // Se il backend ha inviato il codice (solo in DEV), lo "spariamo" alla console di debug
        if (res.debug_code) {
            window.dispatchEvent(new CustomEvent('doliGAS_debug_otp', { 
                detail: { 
                    code: res.debug_code, 
                    contact: formData.contact,
                    timestamp: new Date().toISOString()
                } 
            }));
        }
        // --------------------------------

        setToast({ type: 'success', message: t('auth_login.code_sent') });
        
        // Navigazione ritardata per permettere la visione del toast
        setTimeout(() => {
            navigate('/auth/verify', { 
                state: { contact: formData.contact, gasSlug: formData.gasSlug } 
            });
        }, 1000);
      } else {
        // Messaggio civetta: non confermiamo se l'utente esiste per sicurezza
        setToast({ type: 'info', message: res.message });
      }
    } catch (err) {
      setToast({ type: 'error', message: err.message || t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-800 relative overflow-hidden">
      
      {/* BACKGROUND DECORATIONS */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-emerald-50 to-transparent -z-10"></div>
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl -z-10"></div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* NAVBAR */}
      <nav className="w-full max-w-5xl mx-auto px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/')}>
          <div className="bg-white p-1.5 rounded-lg shadow-sm border border-emerald-100 text-emerald-600 group-hover:scale-110 transition-transform">
            <Sprout size={20} />
          </div>
          <span className="font-bold text-slate-700 tracking-tight group-hover:text-emerald-700 transition-colors">doliGAS</span>
        </div>
        <LanguageSelector variant="minimal" />
      </nav>

      {/* MAIN LOGIN CARD */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-20">
        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
          <Card className="p-8 sm:p-10 shadow-2xl shadow-slate-200/50 border-white bg-white/80 backdrop-blur-xl rounded-[2rem]">
            
            <div className="mb-8 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4 shadow-inner">
                <LogIn size={32} />
              </div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
                {t('auth_login.title')}
              </h1>
              
              <p className="text-slate-500 text-sm font-medium">
                {isGasLocked 
                    ? <span className="flex items-center justify-center gap-2">
                        {t('auth_login.access_to', 'Accesso a')}: <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider">{formData.gasSlug}</span>
                      </span> 
                    : t('auth_login.subtitle')
                }
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {!isGasLocked && (
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex justify-between">
                        <span>{t('auth_login.label_gas')}</span>
                    </label>
                    <div className="relative group">
                      <Globe className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                      <input 
                          type="text" 
                          placeholder={t('auth_login.placeholder_gas')}
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-emerald-500 focus:bg-white font-bold text-slate-700 transition-all placeholder:text-slate-300 placeholder:font-medium"
                          value={formData.gasSlug}
                          onChange={(e) => setFormData({...formData, gasSlug: e.target.value.toLowerCase().replace(/\s/g, '')})}
                          required
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 ml-1 text-right italic">{t('auth_login.hint_gas')}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                    {t('auth_login.label_email')}
                </label>
                <div className="relative group">
                  <Users className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                  <input 
                    type="text" 
                    placeholder={t('auth_login.placeholder_email')}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-emerald-500 focus:bg-white font-bold text-slate-700 transition-all placeholder:text-slate-300 placeholder:font-medium"
                    value={formData.contact}
                    onChange={(e) => setFormData({...formData, contact: e.target.value})}
                    required
                    autoFocus={isGasLocked} 
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                isLoading={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black text-sm shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 mt-4 transition-transform active:scale-[0.98]"
              >
                {t('auth_login.btn_send_code')} <ArrowRight size={18}/>
              </Button>
            </form>
          </Card>
        </div>
      </main>

      <footer className="py-6 text-center">
        <a 
            href="https://dolifarm.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-emerald-600 transition-colors opacity-80"
        >
            Powered by doliFarm Ecosystem
        </a>
      </footer>
    </div>
  );
};