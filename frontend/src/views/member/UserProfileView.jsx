/**
 * @file frontend/src/views/member/UserProfileView.jsx
 * @version v2.2.1
 * @author Luigi GRILLO @ doliFarm.com
 * @description Componente Profilo Utente. 
 * STATUS: Integro, Completo, Robusto.
 * FIX: Ripristinata logica gasId (Anti-400) e visualizzazione Wallet.
 * CHANGES: Aggiunto footer con versione applicazione (doliGas Version).
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { 
  User, Mail, Phone, MapPin, Shield, Info, 
  Loader2, Cpu, Wallet, RefreshCcw, AlertCircle 
} from 'lucide-react';
import { Card, Button, Badge } from '../../components/ui-kit';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.1.0-stable';

export const UserProfileView = () => {
  const { t } = useTranslation();
  const { activeProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = async () => {
    // Protezione contro caricamento asincrono del profilo
    if (!activeProfile?.context_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('doliGAS_token');
      
      // Passiamo gasId per evitare l'errore 400 riscontrato in precedenza
      const res = await axios.get(
        `${API_URL}/api/members/profile?gasId=${activeProfile.context_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile(res.data);
    } catch (err) {
      console.error("Profile Fetch Error:", err);
      setError("Impossibile caricare i dati del profilo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [activeProfile?.context_id]);

  if (loading) return (
    <div className="p-20 flex flex-col items-center justify-center space-y-4">
      <Loader2 className="animate-spin text-emerald-500" size={40}/>
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{t('common.loading')}</p>
    </div>
  );

  if (error || !profile) return (
    <div className="p-10 text-center">
      <AlertCircle className="mx-auto text-red-500 mb-4" size={40} />
      <p className="text-red-500 font-bold mb-6">{error}</p>
      <Button onClick={fetchProfile} variant="outline" className="gap-2">
        <RefreshCcw size={16} /> Riprova
      </Button>
    </div>
  );

  const InfoRow = ({ icon: Icon, label, value }) => (
    <div className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-800 font-bold truncate">
          {value || <span className="text-slate-300 italic font-normal">Non specificato</span>}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* 1. HEADER COMPATTO CON BADGE */}
      <div className="flex items-center gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-emerald-100">
          {profile.first_name?.charAt(0)}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-black text-slate-800 truncate">{profile.first_name} {profile.last_name}</h1>
          <div className="flex gap-2 mt-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wider">
              <Shield size={10}/> {profile.role_name}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider">
              {profile.gas_name}
            </span>
          </div>
        </div>
      </div>

      {/* 2. WALLET BALANCE (Integrità: Ripristinato) */}
      <Card className="p-6 border-none bg-indigo-600 text-white shadow-xl shadow-indigo-100 rounded-[2rem] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-16 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={16} className="text-indigo-200" />
            <p className="text-[10px] font-black text-indigo-100 uppercase tracking-[0.2em]">Disponibilità Wallet</p>
          </div>
          <p className="text-4xl font-black italic tracking-tighter">
            € {Number(profile.balance).toFixed(2)}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* INFO PERSONALI */}
        <Card className="p-4 shadow-sm border-slate-100">
          <h2 className="text-[11px] font-black text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-[0.1em]">
            <User size={14} className="text-emerald-500"/> Dati Utente
          </h2>
          <div className="space-y-1">
            <InfoRow icon={Mail} label="Email Primaria" value={profile.email} />
            <InfoRow icon={Phone} label="Telefono / WhatsApp" value={profile.phone} />
          </div>
        </Card>

        {/* LOGISTICA */}
        <Card className="p-4 shadow-sm border-slate-100">
          <h2 className="text-[11px] font-black text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-[0.1em]">
            <MapPin size={14} className="text-blue-500"/> Logistica
          </h2>
          <div className="space-y-1">
            <InfoRow icon={MapPin} label="Indirizzo Consegna" value={profile.address} />
          </div>
        </Card>
      </div>

      {/* INFO MESSAGE & VERSION FOOTER (La tua richiesta) */}
      <div className="bg-slate-100/50 p-4 rounded-2xl space-y-4">
        <div className="flex items-start gap-3 text-slate-500 text-xs leading-relaxed">
            <Info className="shrink-0 mt-0.5 text-slate-400" size={16}/>
            <p>I dati mostrati in questa pagina sono gestiti dal coordinatore del tuo GAS. In caso di errori, contatta l'amministratore.</p>
        </div>
        
        {/* VERSION INFO LINE */}
        <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-slate-300"/>
              <span>doliGAS Platform Engine</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-500 shadow-sm">
                v{APP_VERSION}
              </span>
            </div>
        </div>
      </div>

    </div>
  );
};