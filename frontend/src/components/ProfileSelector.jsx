/**
 * @file frontend/src/components/ProfileSelector.jsx
 * @version v1.0.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Identity Gate Component. Allows users with multiple roles/contexts to select the active profile before entering the dashboard.
 * @status Stable
 * @date 2026-01-16
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Badge } from './ui-kit';
import { ShieldCheck, ShoppingCart, Tractor, LogOut } from 'lucide-react';

export const ProfileSelector = () => {
  const { profiles, switchProfile, user, logout } = useAuth();
  
  // Debug log per confermare i dati (puoi rimuoverlo dopo)
  console.log("PROFILI RENDER:", profiles);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <h2 className="text-4xl font-black text-white mb-2 tracking-tight">Bentornato, {user?.first_name}</h2>
           <p className="text-slate-400 font-medium text-lg">Seleziona con quale profilo vuoi operare oggi</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {profiles.map((p, idx) => (
            <Card 
              key={p.id || idx} 
              onClick={() => switchProfile(p)}
              // FIX COLORI: Card Bianca (bg-white), bordo e ombreggiatura
              className="group relative p-8 bg-white border-none cursor-pointer transition-all hover:-translate-y-2 shadow-2xl hover:shadow-emerald-500/20 overflow-hidden"
            >
              {/* Sfondo decorativo sfumato (opzionale) */}
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
                {/* FIX COLORI: Testo Scuro (text-slate-800) */}
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
                <LogOut size={16}/> Esci e torna alla home
            </button>
        </div>
      </div>
    </div>
  );
};