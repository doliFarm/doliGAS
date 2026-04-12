/**
 * @file frontend/src/views/producer/ProducerProfileView.jsx
 * @version v1.0.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Company Profile. Read-only view of the producer's business data and contact information.
 * @status Stable
 * @date 2026-01-16
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Building2, Wallet, Phone, MapPin, Loader2, Mail, Info } from 'lucide-react';
import { Card } from '../../components/ui-kit';

export const ProducerProfileView = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get('/api/products/profile');
        setProfile(res.data);
      } catch (err) {
        console.error("Producer Profile Error:", err);
        setError("Impossibile caricare i dati aziendali.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-amber-500" size={32}/></div>;
  if (error) return <div className="p-6 text-center text-red-500 font-bold bg-red-50 rounded-xl">{error}</div>;
  if (!profile) return null;

  const InfoRow = ({ icon: Icon, label, value, sub }) => (
    <div className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-800 font-medium">{value || <span className="text-slate-300 italic">Non specificato</span>}</p>
        {sub && <p className="text-[10px] text-amber-600 font-medium mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      
      {/* HEADER AZIENDALE */}
      <div className="flex items-center gap-4 bg-amber-50 p-4 rounded-2xl border border-amber-100">
        <div className="w-16 h-16 rounded-full bg-white border-2 border-amber-200 shadow-sm flex items-center justify-center text-amber-600 text-2xl font-black">
          <Building2 size={32}/>
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-800 leading-tight">{profile.business_name}</h1>
          <p className="text-xs text-amber-800 font-medium mt-1">P.IVA: {profile.vat_number || 'ND'}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* DATI FINANZIARI & SEDE */}
        <Card className="p-4 shadow-sm border-slate-100">
          <h2 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
            <Building2 size={16} className="text-amber-500"/> Dati Aziendali
          </h2>
          <div className="space-y-1">
            <InfoRow icon={MapPin} label="Sede Legale" value={profile.business_address} />
            <InfoRow icon={Wallet} label="IBAN per bonifici" value={profile.iban} sub="Verifica che sia corretto prima di ogni ciclo" />
          </div>
        </Card>

        {/* CONTATTO RESPONSABILE */}
        <Card className="p-4 shadow-sm border-slate-100">
          <h2 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
            <User size={16} className="text-blue-500"/> Referente
          </h2>
          <div className="space-y-1">
            <InfoRow icon={User} label="Nome" value={profile.contact_name || `${profile.first_name} ${profile.last_name}`} />
            <InfoRow icon={Mail} label="Email" value={profile.contact_email || profile.user_email} />
            <InfoRow icon={Phone} label="Telefono" value={profile.contact_phone} />
          </div>
        </Card>
      </div>

      <div className="bg-slate-50 p-3 rounded-xl flex items-start gap-3 text-slate-500 text-xs leading-relaxed">
        <Info className="shrink-0 mt-0.5 text-slate-400" size={16}/>
        <p>Per modificare questi dati, contatta il Coordinatore del GAS.</p>
      </div>
    </div>
  );
};