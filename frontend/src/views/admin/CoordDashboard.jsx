/**
 * @file frontend/src/views/admin/CoordDashboard.jsx
 * @version v1.1.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Admin Dashboard interattiva. KPI cliccabili per navigazione rapida.
 * @status Integro, Completo, Robusto.
 * @date 2026-02-24
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom'; // <--- Import per navigazione
import axios from 'axios';
import { 
  TrendingUp, Users, Calendar, Loader2, Calendar as CalendarIcon, 
  ShoppingBag, Sprout, Leaf, Tractor, AlertCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Card, Button } from '../../components/ui-kit';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || ''; 
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export const CoordDashboard = () => {
  const { activeProfile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate(); // <--- Hook navigazione
  
  const [data, setData] = useState({ 
    stats: null, 
    analytics: null,
    currentCycle: null 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    if (!activeProfile || activeProfile.type !== 'GAS') {
        setLoading(false);
        return;
    }

    setLoading(true);
    try {
      const gasId = activeProfile.context_id;
      
      const [statsRes, analyticsRes, cyclesRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/stats?gasId=${gasId}`),
        axios.get(`${API_URL}/api/admin/analytics?gasId=${gasId}&startDate=${dateRange.start}&endDate=${dateRange.end}`),
        axios.get(`${API_URL}/api/admin/cycles/history?gasId=${gasId}`) 
      ]);

      const activeCycle = (cyclesRes.data || []).find(c => c.is_active === 1) || null;

      setData({ 
        stats: statsRes.data.stats || {}, 
        analytics: analyticsRes.data || {},
        currentCycle: activeCycle
      });
      setError(null);
    } catch (err) { 
      console.error("[DASHBOARD] Fetch Error:", err);
      setError(t('common.error_loading') || "Errore nel caricamento dei dati");
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, [dateRange, activeProfile]);

  if (loading && !data.stats) {
    return (
      <div className="p-20 text-center flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} />
        <p className="text-slate-400 font-medium tracking-widest uppercase text-xs">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10">
        <Card className="border-red-100 bg-red-50 p-8 text-center">
            <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
            <h3 className="text-red-800 font-bold">{error}</h3>
            <Button onClick={fetchData} className="mt-4 bg-red-600 text-white">Riprova</Button>
        </Card>
      </div>
    );
  }

  const stats = data.stats || {};
  const analytics = data.analytics || {};
  const cycleName = data.currentCycle ? data.currentCycle.name : t('admin_dashboard.no_active_cycle');

  return (
    <div className="max-w-full overflow-hidden space-y-4 sm:space-y-8 pb-10 animate-in fade-in duration-500 px-4">
      
      {/* HEADER CON FILTRI */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
            <Sprout size={24}/>
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-800 leading-tight">
              {t('admin_dashboard.title')}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm">
              {activeProfile?.context_name} — {t('admin_dashboard.subtitle')}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <CalendarIcon size={16} className="text-slate-400 ml-1"/>
            <input 
              type="date" value={dateRange.start} 
              onChange={e => setDateRange({...dateRange, start: e.target.value})}
              className="text-[10px] sm:text-xs font-bold bg-transparent outline-none text-slate-600 w-full sm:w-auto"
            />
            <span className="text-slate-300">→</span>
            <input 
              type="date" value={dateRange.end} 
              onChange={e => setDateRange({...dateRange, end: e.target.value})}
              className="text-[10px] sm:text-xs font-bold bg-transparent outline-none text-slate-600 w-full sm:w-auto"
            />
          </div>
          <Button onClick={fetchData} className="bg-indigo-600 h-10 text-xs font-black px-6 shadow-md shadow-indigo-50">
            {t('common.update_data')}
          </Button>
        </div>
      </div>

      {/* KPI GRID - CLICCABILI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard 
          title="VOLUME ORDINI" 
          value={`${stats.totalOrdersAmount || 0} €`} 
          icon={TrendingUp} color="emerald" 
          desc="Vai alla Logistica"
          action={() => navigate('/admin/logistics')} 
        />
        <StatsCard 
          title="CICLO ATTIVO" 
          value={cycleName} 
          icon={Calendar} color="blue" 
          desc="Gestisci Cicli"
          action={() => navigate('/admin/cycles')}
        />
        <StatsCard 
          title="SOCI ATTIVI" 
          value={stats.activeMembers || 0} 
          icon={Users} color="orange" 
          desc="Anagrafica Soci"
          action={() => navigate('/admin/members')} 
        />
        <StatsCard 
          title="PRODUTTORI" 
          value={stats.activeProducers || 0} 
          icon={Tractor} color="purple" 
          desc="Elenco Partner"
          action={() => navigate('/admin/producers')} 
        />
      </div>

      {/* GRAFICI ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <ChartCard title="DISTRIBUZIONE PER PRODUTTORE" icon={Leaf}>
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={analytics.byProducer || []} 
                  dataKey="value" nameKey="name" 
                  cx="50%" cy="50%" outerRadius="80%" 
                  label={{ fontSize: 9, fontWeight: 'bold' }}
                >
                  {(analytics.byProducer || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${parseFloat(v).toFixed(2)} €`} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="VENDITE PER CATEGORIA" icon={ShoppingBag}>
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.byCategory || []} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} fontSize={9} fontWeight="bold" />
                <Tooltip cursor={{fill: '#f8fafc'}} formatter={(v) => `${parseFloat(v).toFixed(2)} €`} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={15} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* CLASSIFICA PRODOTTI TOP */}
      <Card className="overflow-hidden border-none shadow-sm bg-white">
        <div className="p-4 sm:p-5 bg-emerald-600 flex justify-between items-center text-white">
          <h3 className="font-bold flex items-center gap-2 uppercase text-[10px] sm:text-xs tracking-widest">
            <Sprout size={18}/> PRODOTTI PIÙ VENDUTI
          </h3>
        </div>
        <div className="divide-y divide-slate-50">
          {(analytics.byProduct || []).length > 0 ? (
            (analytics.byProduct || []).map((p, idx) => (
              <div key={idx} className="p-3 sm:p-4 flex justify-between items-center hover:bg-slate-50 transition-all group">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-slate-700 text-xs sm:text-sm truncate group-hover:text-emerald-700 transition-colors">{p.name}</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase truncate">{p.producer || '---'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                    <div className="bg-emerald-50 text-emerald-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-mono text-[10px] sm:text-xs font-black whitespace-nowrap">
                       {parseFloat(p.value).toFixed(2)} €
                    </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-10 text-center text-slate-300 italic text-xs">Nessun dato disponibile nel periodo selezionato</div>
          )}
        </div>
      </Card>
    </div>
  );
};

// --- SOTTO-COMPONENTI UI ---
const StatsCard = ({ title, value, icon: Icon, color, action, desc }) => {
  const colorVariants = {
    emerald: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    orange: 'text-orange-600 bg-orange-50',
    purple: 'text-purple-600 bg-purple-50'
  };

  return (
    <Card 
      className={`p-4 sm:p-5 flex items-center justify-between border-none shadow-sm transition-all duration-300 ${action ? 'cursor-pointer hover:shadow-md hover:-translate-y-1 active:scale-95' : ''}`} 
      onClick={action}
    >
      <div className="space-y-0.5 sm:space-y-1 min-w-0">
        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{title}</p>
        <p className={`text-lg sm:text-2xl font-black ${colorVariants[color].split(' ')[0]} tracking-tighter truncate`}>{value}</p>
        {desc && <p className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase leading-tight truncate">{desc}</p>}
      </div>
      <div className={`p-2.5 sm:p-3 rounded-2xl ${colorVariants[color].split(' ')[1]} ${colorVariants[color].split(' ')[0]} shrink-0`}>
        <Icon size={20} />
      </div>
    </Card>
  );
};

const ChartCard = ({ title, icon: Icon, children }) => (
  <Card className="p-4 sm:p-6 space-y-4 shadow-sm border-none bg-white relative overflow-hidden">
    <div className="flex items-center gap-2 border-b border-slate-50 pb-3 sm:pb-4">
      <div className="p-2 bg-slate-50 text-slate-400 rounded-lg shrink-0">
        <Icon size={16}/>
      </div>
      <h3 className="font-black text-slate-600 text-[10px] sm:text-xs uppercase tracking-tight truncate">{title}</h3>
    </div>
    <div className="pt-2">
      {children}
    </div>
  </Card>
);