/**
 * @file frontend/src/views/Welcome.jsx
 * @version v4.3.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Landing Page Strategica "Civic Tech".
 * INTEGRAZIONE: Aggiunta logica di invio form contatti a NocoDB/Email.
 * @status Stable - Production Ready
 * @date 2026-02-18
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Sprout, ArrowRight, Globe, Users, LogIn, 
  Tractor, ShoppingBasket, Heart, ExternalLink,
  Link2, QrCode, LayoutDashboard, 
  ChevronLeft, ChevronRight, ShieldCheck, ClipboardList, Leaf,
  Lock, Code2, Database, 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Toast } from '../components/ui-kit';
import { LanguageSelector } from '../components/LanguageSelector';

export const Welcome = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { requestOtp } = useAuth();
  
  // --- STATE ---
  const [formData, setFormData] = useState({ gasSlug: '', contact: '' });
  const [isGasLocked, setIsGasLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Showcase State (Carosello)
  const [activeTab, setActiveTab] = useState('member');
  const [currentSlide, setCurrentSlide] = useState(0);

  // --- NUOVO STATO PER FORM CONTATTI (FOOTER) ---
  const [contactData, setContactData] = useState({ name: '', email: '', location: '', message: '' });
  const [isContactLoading, setIsContactLoading] = useState(false);

  // --- LOGICA INTEGRATA: SUBDOMAIN + WP BRIDGE ---
  useEffect(() => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    let detectedGas = '';
    let locked = false;

    // 1. Rilevamento automatico dal Sottodominio
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'welcome') {
        detectedGas = parts[0];
        locked = true;
    }

    // 2. Lettura parametri da URL
    const params = new URLSearchParams(window.location.search);
    const gasParam = params.get('gas');
    const contactParam = params.get('contact');

    // 3. Popolamento Stato
    setFormData(prev => ({
        gasSlug: gasParam || detectedGas || prev.gasSlug,
        contact: contactParam || prev.contact
    }));

    if (locked || gasParam) {
        setIsGasLocked(true);
    }
  }, []);

  useEffect(() => { 
    setCurrentSlide(0); 
  }, [activeTab]);
  
// --- TRACKING ANONIMO E VELOCE ---
  useEffect(() => {
    // Evitiamo di tracciare le visite se stiamo sviluppando in localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return;
    }

    const trackVisit = async () => {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      try {
        // Chiamata in background, nessuna gestione dell'errore bloccante
        await fetch(`${apiUrl}/api/public/track`, { method: 'POST',signal: AbortSignal.timeout(3000) });
      } catch (e) {
        console.debug("Tracking bypass");
        // Fail silently: se il tracciamento fallisce (es. AdBlocker), non blocchiamo il sito
      }
    };

    trackVisit();
  }, []); // L'array vuoto garantisce che scatti solo 1 volta all'apertura della landing
  // --- HANDLERS LOGIN ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setToast(null);
    try {
      const res = await requestOtp(formData.contact, formData.gasSlug);
      if (res.success) {
        setToast({ type: 'success', message: t('auth_login.code_sent') });
        setTimeout(() => {
            navigate('/auth/verify', { 
                state: { contact: formData.contact, gasSlug: formData.gasSlug } 
            });
        }, 1000);
      } else { 
        setToast({ type: 'info', message: res.message }); 
      }
    } catch (err) { 
      setToast({ type: 'error', message: err.message || t('common.error') }); 
    } finally { 
      setIsLoading(false); 
    }
  };

  // --- HANDLER CONTATTI (API / NOCODB) ---
  const handleContactSubmit = async (e) => {
      e.preventDefault();
      setIsContactLoading(true);
      
      // Costruiamo l'URL. 
      // Se siamo su doligas.com, '/api' viene gestito da Nginx che lo gira al backend.
      // Usiamo una variabile d'ambiente o un path relativo se servito dallo stesso dominio.
      const apiUrl = import.meta.env.VITE_API_URL || 'https://doligas.com/api'; 

      try {
        const response = await fetch(`${apiUrl}/public/contact`, { // Nota: /public/contact
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contactData),
        });
        
        const result = await response.json();

        if (response.ok && result.success) {
          setToast({ type: 'success', message: 'Richiesta inviata! Ti risponderemo presto.' });
          setContactData({ name: '', email: '', message: '' }); // Reset form
        } else {
          throw new Error(result.message || 'Errore invio');
        }
      } catch (err) {
        console.error(err);
        setToast({ type: 'error', message: 'Impossibile inviare la richiesta al momento.' });
      } finally {
        setIsContactLoading(false);
      }
  };

  // --- CONFIGURAZIONE SLIDESHOW DINAMICO (MANTENUTA INTEGRALE) ---
  const generateSlides = (roleName, count = 2) => {
    return Array.from({ length: count }, (_, i) => `/img/screenshot_${roleName}_${i + 1}.png`);
  };

  const showcaseData = useMemo(() => ({
    member: {
        id: 'member',
        label: t('welcome_page.role_member'),
        icon: ShoppingBasket,
        desc: t('welcome_page.view_shop_desc'),
        slides: generateSlides('member')
    },
    admin: {
        id: 'admin',
        label: t('welcome_page.role_coordinator'),
        icon: LayoutDashboard,
        desc: t('welcome_page.view_admin_desc'),
        slides: generateSlides('coordinator')
    },
    producer: {
        id: 'producer',
        label: t('welcome_page.role_producer'),
        icon: Tractor,
        desc: t('welcome_page.role_producer_desc'),
        slides: generateSlides('producer')
    }
  }), [t]);

  const activeData = showcaseData[activeTab];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % activeData.slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + activeData.slides.length) % activeData.slides.length);
  };

  if (!activeData) return null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-emerald-100 selection:text-emerald-800 overflow-x-hidden relative">
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* === NAVBAR === */}
      <nav className="absolute top-0 left-0 w-full z-[100] px-6 py-6 pointer-events-auto">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="bg-white/90 backdrop-blur-sm p-2 rounded-xl shadow-sm border border-emerald-100/50 text-emerald-600">
              <Sprout size={24} />
            </div>
            <span className="font-black text-xl text-white tracking-tight drop-shadow-md">doliGAS</span>
          </div>
          <LanguageSelector variant="minimal" />
        </div>
      </nav>

      {/* === HERO SECTION === */}
      <section className="relative min-h-[85vh] flex items-center pt-24 pb-20 lg:pt-32">
        <div className="absolute inset-0 z-0">
            <img src="/img/hero_bg_community.jpg" alt="Comunità GAS" className="w-full h-full object-cover"/>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/90 via-slate-900/80 to-emerald-900/60 mix-blend-multiply"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full grid lg:grid-cols-2 gap-16 items-center">
          
          <div className="text-white space-y-8 text-center lg:text-left animate-in slide-in-from-left duration-700">
            <div>
                <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-4">
                    {t('welcome_page.hero_badge')}
                </span>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
                {t('welcome_page.hero_title')}
                </h1>
            </div>
            <p className="text-lg md:text-xl text-emerald-100/90 font-medium max-w-xl mx-auto lg:mx-0 leading-relaxed">
              {t('welcome_page.hero_subtitle')}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
                <Button className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-emerald-900/20" onClick={() => document.getElementById('footer').scrollIntoView({behavior: 'smooth'})}>
                    {t('welcome_page.btn_discover_ecosystem')}
                </Button>
                
                <div className="flex flex-col justify-center gap-1 text-xs text-emerald-200 font-bold uppercase tracking-wide px-2">
                    <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-400"/> {t('welcome_page.hero_trust_label')}</div>
                    <div className="flex items-center gap-2"><Lock size={14} className="text-emerald-400"/> {t('welcome_page.hero_privacy_badge')}</div>
                </div>
            </div>
          </div>

          {/* Login Card */}
          <div className="w-full max-w-md mx-auto lg:ml-auto animate-in zoom-in-95 duration-700 delay-200">
            <Card className="p-8 sm:p-10 border-white/10 bg-white/10 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-black/20">
                <div className="mb-8 text-center">
                  <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-300 mx-auto mb-4 border border-emerald-500/30">
                    <LogIn size={28} />
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight mb-2">{t('welcome_page.login_card_title')}</h2>
                  <p className="text-emerald-100/70 text-sm font-medium">
                    {isGasLocked ? (
                        <span className="flex items-center justify-center gap-2">
                            {t('auth_login.access_to')}: <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider border border-emerald-500/30">{formData.gasSlug}</span>
                        </span>
                    ) : t('welcome_page.login_card_subtitle')}
                  </p>
                </div>
                
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  {!isGasLocked && (
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-emerald-300/80 uppercase ml-1">{t('auth_login.label_gas')}</label>
                        <div className="relative group">
                          <Globe className="absolute left-4 top-3.5 text-emerald-300/50 group-focus-within:text-emerald-300 transition-colors" size={18} />
                          <input 
                            type="text" 
                            placeholder={t('auth_login.placeholder_gas')} 
                            className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border-2 border-emerald-500/20 rounded-xl outline-none focus:border-emerald-500/60 focus:bg-slate-900/70 font-bold text-white transition-all" 
                            value={formData.gasSlug} 
                            onChange={(e) => setFormData({...formData, gasSlug: e.target.value.toLowerCase().replace(/\s/g, '')})} 
                            required
                          />
                        </div>
                    </div>
                  )}
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-emerald-300/80 uppercase ml-1">{t('auth_login.label_email')}</label>
                    <div className="relative group">
                      <Users className="absolute left-4 top-3.5 text-emerald-300/50 group-focus-within:text-emerald-300 transition-colors" size={18} />
                      <input 
                        type="text" 
                        placeholder={t('auth_login.placeholder_email')} 
                        className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border-2 border-emerald-500/20 rounded-xl outline-none focus:border-emerald-500/60 focus:bg-slate-900/70 font-bold text-white transition-all" 
                        value={formData.contact} 
                        onChange={(e) => setFormData({...formData, contact: e.target.value})} 
                        required 
                        autoFocus={isGasLocked} 
                      />
                    </div>
                  </div>

                  <Button type="submit" isLoading={isLoading} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-xl font-black text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 mt-4 border border-emerald-400/20">
                    {t('auth_login.btn_send_code')} <ArrowRight size={18}/>
                  </Button>
                </form>

                <div className="mt-8 pt-6 border-t border-white/10 text-center">
                    <p className="text-xs text-emerald-100/60 font-medium leading-relaxed">
                        {t('auth_login.request_demo_text')} <br/>
                        <a href="mailto:info@dolifarm.com" className="text-emerald-300 hover:text-white transition-colors font-black tracking-wide hover:underline">info@dolifarm.com</a>
                    </p>
                </div>
            </Card>
          </div>
        </div>
      </section>
{/* === ECOSYSTEM SECTION (ULTRA COMPACT & NEUTRAL) === */}
<section id="ecosystem" className="py-16 bg-slate-50 relative overflow-hidden z-20">
  <div className="max-w-3xl mx-auto px-6 relative z-10">
    
    <div className="text-center mb-10">
      <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mb-2">
        {t('welcome_page.ecosystem_title')}
      </h2>
      <p className="text-slate-500 text-sm max-w-lg mx-auto">
        {t('welcome_page.ecosystem_subtitle')}
      </p>
    </div>
    
    {/* GRID: Gap ridotto a 3, Padding ridotto a 4 */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 auto-rows-fr">
      
      {/* 1. doliGAS (Principale) */}
      <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm hover:shadow-lg hover:border-emerald-500/30 transition-all duration-300 group flex flex-col items-start justify-between h-full">
          <div>
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 mb-3 group-hover:scale-105 transition-transform">
                <Sprout size={16} />
            </div>
            <h3 className="font-black text-lg text-slate-800 mb-1">{t('welcome_page.mod_doligas')}</h3>
            <p className="text-slate-500 text-xs font-medium leading-relaxed">
              {t('welcome_page.mod_doligas_desc')}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 w-full flex justify-between items-center">
             <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">{t('welcome_page.doligas_gas')}</span>
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
      </div>

      {/* 2. doliFARM */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:bg-white transition-all duration-300 group flex flex-col items-start justify-between h-full">
          <div>
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-3 group-hover:scale-105 transition-transform">
                <Tractor size={16} />
            </div>
            <h3 className="font-black text-lg text-slate-800 mb-1">{t('welcome_page.mod_dolifarm')}</h3>
            <p className="text-slate-500 text-xs font-medium leading-relaxed">
              {t('welcome_page.mod_dolifarm_desc')}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 w-full">
             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('welcome_page.core_system')}</span>
          </div>
      </div>

      {/* 3. doliTRACE */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:bg-white transition-all duration-300 group flex flex-col items-start justify-between h-full">
          <div>
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 mb-3 group-hover:scale-105 transition-transform">
                <ClipboardList size={16} />
            </div>
            <h3 className="font-black text-lg text-slate-800 mb-1">{t('welcome_page.mod_dolitrace')}</h3>
            <p className="text-slate-500 text-xs font-medium leading-relaxed">
              {t('welcome_page.mod_dolitrace_desc')}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 w-full">
             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('welcome_page.integrated_module')}</span>
          </div>
      </div>

       {/* 4. doliAgroPass (ORA NEUTRO) */}
       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:bg-white transition-all duration-300 group flex flex-col items-start justify-between h-full relative overflow-hidden">
          {/* Effetto sfumato verde molto leggero per distinguerlo appena */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl -mr-5 -mt-5 group-hover:bg-emerald-500/10 transition-colors"></div>

          <div className="relative z-10">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 mb-3 group-hover:scale-105 transition-transform border border-emerald-100">
                <ShieldCheck size={16} />
            </div>
            <h3 className="font-black text-lg text-slate-800 mb-1">{t('welcome_page.mod_agropass')}</h3>
            <p className="text-slate-500 text-xs font-medium leading-relaxed">
              {t('welcome_page.mod_agropass_desc')}
            </p>
          </div>
          <div className="relative z-10 mt-3 pt-3 border-t border-slate-200 w-full flex items-center gap-1.5">
             <Leaf size={10} className="text-emerald-500"/>
             <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">{t('welcome_page.future_ready')}</span>
          </div>
      </div>

    </div>
  </div>
</section>

      {/* === TECNOLOGIA CIVICA === */}
      <section className="py-24 bg-slate-900 relative overflow-hidden z-20">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/circuit-board.png')] opacity-5"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center mb-16">
                 <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4">{t('welcome_page.ethics_title')}</h2>
                 <p className="text-emerald-100/70 text-lg max-w-2xl mx-auto">{t('welcome_page.ethics_subtitle')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-12">
                <div className="text-left group">
                     <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-emerald-400 mb-4 group-hover:border-emerald-500 transition-colors">
                        <Code2 size={24}/>
                     </div>
                     <h3 className="text-white font-bold text-xl mb-3">{t('welcome_page.feat_opensource_title')}</h3>
                     <p className="text-slate-400 leading-relaxed">{t('welcome_page.feat_opensource_desc')}</p>
                </div>

                <div className="text-left group">
                     <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-emerald-400 mb-4 group-hover:border-emerald-500 transition-colors">
                        <Lock size={24}/>
                     </div>
                     <h3 className="text-white font-bold text-xl mb-3">{t('welcome_page.feat_privacy_title')}</h3>
                     <p className="text-slate-400 leading-relaxed">{t('welcome_page.feat_privacy_desc')}</p>
                </div>

                <div className="text-left group">
                     <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-emerald-400 mb-4 group-hover:border-emerald-500 transition-colors">
                        <Globe size={24}/>
                     </div>
                     <h3 className="text-white font-bold text-xl mb-3">{t('welcome_page.feat_ownership_title')}</h3>
                     <p className="text-slate-400 leading-relaxed">{t('welcome_page.feat_ownership_desc')}</p>
                </div>
            </div>
        </div>
      </section>

      {/* === APP SHOWCASE === */}
      <section className="py-24 bg-slate-50 border-y border-slate-200 relative z-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight mb-4">{t('welcome_page.showcase_title')}</h2>
            <p className="text-slate-500 text-lg max-w-3xl mx-auto mb-12">{t('welcome_page.showcase_subtitle')}</p>

            <div className="flex justify-center gap-4 mb-10 overflow-x-auto pb-4">
                {Object.keys(showcaseData).map((key) => {
                    const data = showcaseData[key];
                    const Icon = data.icon;
                    return (
                        <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all whitespace-nowrap ${activeTab === key ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                            <Icon size={18} /> {data.label}
                        </button>
                    )
                })}
            </div>

            <div className="relative max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-500">
                <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
                    <div className="bg-slate-100 px-4 py-3 flex items-center gap-4 border-b border-slate-200">
                        <div className="flex gap-2 opacity-50"><div className="w-3 h-3 rounded-full bg-slate-400"></div><div className="w-3 h-3 rounded-full bg-slate-400"></div><div className="w-3 h-3 rounded-full bg-slate-400"></div></div>
                        <div className="flex-1 bg-white h-6 rounded border border-slate-200 flex items-center px-4 text-[10px] text-emerald-600 font-bold tracking-widest uppercase truncate"><span className="text-slate-400 mr-2">GAS:</span> {formData.gasSlug || 'comunita'}.dolifarm.com</div>
                    </div>
                    <div className="aspect-video bg-slate-50 relative group overflow-hidden">
                        <img 
                          key={`${activeTab}-${currentSlide}`} 
                          src={activeData.slides[currentSlide]} 
                          alt={`${activeTab} view`} 
                          className="absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-300" 
                          onError={(e) => e.target.style.opacity = 0} 
                        />
                        <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={prevSlide} className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all hover:scale-110"><ChevronLeft size={24}/></button>
                            <button onClick={nextSlide} className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all hover:scale-110"><ChevronRight size={24}/></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* === FOOTER A DUE COLONNE === */}
     {/* === FOOTER A DUE COLONNE === */}
      <footer id="footer" className="py-20 bg-slate-900 px-6 z-20 relative border-t border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            
            {/* COLONNA SINISTRA: VISIONE */}
            <div className="text-left space-y-8">
              <div>
                
                <h3 className="text-3xl font-black text-white tracking-tight mb-4">
                  {t('welcome_page.cta_dolifarm_title')}
                </h3>
                <p className="text-slate-400 text-lg font-medium leading-relaxed">
                  {t('welcome_page.cta_dolifarm_desc')}
                </p>
              </div>

              <div className="p-8 bg-slate-800/30 rounded-3xl border border-slate-700/50 backdrop-blur-sm relative overflow-hidden group">
                {/* Effetto luce soffusa al passaggio del mouse */}
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <h4 className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-3 relative z-10">
                  {t('welcome_page.sustainability_title')}
                </h4>
                <p className="text-slate-500 text-sm leading-relaxed italic relative z-10">
                  "{t('welcome_page.sustainability_text')}"
                </p>
              </div>

              <div className="flex gap-6 items-center pt-4">
                <a 
                  href="https://dolifarm.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="group text-slate-500 hover:text-white transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-widest"
                >
                  {t('welcome_page.visit_dolifarm')} 
                  <ExternalLink size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </a>
              </div>
            </div>

            {/* COLONNA DESTRA: FORM + BADGE PIONIERI */}
            <div className="relative">
              
              {/* BADGE PIONIERI - Posizionato a cavallo del bordo superiore */}
              <div className="absolute -top-6 left-8 z-30 transform hover:scale-105 transition-transform duration-300 pointer-events-none sm:pointer-events-auto">
                <div className="bg-emerald-600 text-white px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(5,150,105,0.4)] flex items-center gap-3 border border-emerald-400/50 backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  <span>{t('welcome_page.program_pioneer')}</span>
                </div>
              </div>

              <div className="bg-white/[0.02] p-8 rounded-3xl border border-white/5 shadow-2xl relative backdrop-blur-md">
                <h4 className="text-xl font-bold text-white mb-2">{t('welcome_page.form_title')}</h4>
                <form className="space-y-4" onSubmit={handleContactSubmit}>
                  {/* Aumentato a grid-cols-3 per far spazio ai 3 campi principali (o gestito in due righe) */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Campo NOME */}
                      <input 
                        type="text" 
                        required 
                        placeholder={t('welcome_page.form_name_placeholder')}
                        value={contactData.name} 
                        onChange={(e) => setContactData({...contactData, name: e.target.value})}
                        className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all w-full"
                      />
                      {/* Campo LOCALITA' */}
                      <input 
                        type="text" 
                        required 
                        placeholder={t('welcome_page.form_location_placeholder', 'Città o Provincia')} // Ricordati di aggiungere la traduzione
                        value={contactData.location} // <-- Assicurati che lo stato iniziale contenga location: ''
                        onChange={(e) => setContactData({...contactData, location: e.target.value})}
                        className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all w-full"
                      />
                    </div>
                    
                    {/* Campo EMAIL (A tutta larghezza sotto nome e località) */}
                    <input 
                      type="email" 
                      required 
                      placeholder={t('welcome_page.form_email_placeholder')}
                      value={contactData.email} 
                      onChange={(e) => setContactData({...contactData, email: e.target.value})}
                      className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all w-full"
                    />
                  </div>
                  
                  {/* Campo MESSAGGIO */}
                  <textarea 
                    required 
                    placeholder={t('welcome_page.form_message_placeholder')}
                    value={contactData.message} 
                    onChange={(e) => setContactData({...contactData, message: e.target.value})}
                    className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder:text-slate-600 h-32 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none w-full"
                  />

                  {/* CHECKBOX PRIVACY */}
                  <div className="flex items-start gap-3 py-2">
                    <input 
                      type="checkbox" 
                      id="privacy_consent" 
                      required 
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                    />
                    <label htmlFor="privacy_consent" className="text-[11px] text-slate-500 leading-tight cursor-pointer">
                      {t('welcome_page.form_privacy_checkbox')}
                    </label>
                  </div>

                  {/* BOTTONE SUBMIT */}
                  <button 
                    type="submit" 
                    disabled={isContactLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-950/50 transition-all active:scale-[0.98] uppercase tracking-widest text-xs flex justify-center items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isContactLoading ? (
                      <span className="animate-pulse">{t('common.loading')}</span>
                    ) : (
                      <>
                        {t('welcome_page.form_submit')}
                        <Sprout size={16} className="group-hover:rotate-12 transition-transform" />
                      </>
                    )}
                  </button>
                </form> 
              </div>
            </div>
          </div>

          {/* SEZIONE INFERIORE: DISCLAIMER E COPYRIGHT */}
          <div className="mt-20 pt-8 border-t border-slate-800 text-center">
            {/*<p className="max-w-2xl mx-auto text-[9px] text-slate-700 leading-relaxed uppercase tracking-[0.2em] mb-6">
              {t('welcome_page.eco_footer')}
            </p>*/}
            <div className="flex flex-col md:flex-row justify-center items-center gap-4 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
              <span>&copy; 2026 doliGAS Powered by <a href="https://www.dolifarm.com" target="_blank">doliFarm.com</a></span>
              <span className="hidden md:block text-slate-800">•</span>
              <span>{t('welcome_page.footer_opensource')}</span>
              <span className="hidden md:block text-slate-800">•</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

