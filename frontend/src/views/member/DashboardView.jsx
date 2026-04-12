/* =============================================================================
   FILE: frontend/src/views/member/DashboardView.jsx - v6.1
   STATUS: Integro, Completo, Robusto.
   DESC: Dashboard Socio con supporto Multi-Context.
   FIX: Iniezione gasId per recuperare dati del GAS corretto.
   ============================================================================= */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  Wallet, ShoppingBag, Truck, CheckCircle2, Clock, Loader2,
  ChevronRight, AlertCircle, MessageSquare
} from 'lucide-react';
import { Card, Button } from '../../components/ui-kit';
import { useAuth } from '../../context/AuthContext'; // Context

export const DashboardView = () => {
  const { activeProfile } = useAuth(); // Recupero profilo
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!activeProfile?.context_id) return;
      
      try {
        const gasId = activeProfile.context_id;
        // Passiamo gasId alla nuova rotta backend
        const res = await axios.get(`/api/members/dashboard?gasId=${gasId}`);
        setData(res.data);
      } catch (err) { 
        console.error("Dashboard error:", err); 
      } finally { 
        setLoading(false); 
      }
    };
    loadData();
  }, [activeProfile]);

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;
  if (!data) return <div className="p-6 text-center text-slate-400">Impossibile caricare i dati.</div>;

  const isMarketOpen = data.marketStatus === 'OPEN';
  const statusColor = isMarketOpen ? 'bg-emerald-500' : (data.marketStatus === 'COMING_SOON' ? 'bg-orange-400' : 'bg-slate-400');
  const statusText = isMarketOpen ? 'APERTO' : (data.marketStatus === 'COMING_SOON' ? 'IN ARRIVO' : 'CHIUSO');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* 1. WALLET CARD */}
      <div onClick={() => navigate('/member/wallet')} className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl shadow-slate-200 cursor-pointer relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -translate-y-16 translate-x-16 group-hover:translate-x-10 transition-transform duration-700"></div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm"><Wallet className="text-emerald-400" size={24} /></div>
            <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{activeProfile.context_name}</p>
                <ChevronRight className="text-slate-500 group-hover:text-white transition-colors ml-auto mt-1" />
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-widest mb-1">Il tuo saldo</p>
          <h2 className="text-4xl font-black tracking-tight">{parseFloat(data.balance).toFixed(2)} <span className="text-xl text-slate-500">€</span></h2>
        </div>
      </div>

      {/* 2. MESSAGGI */}
      {data.messages && data.messages.length > 0 && (
          <div className="space-y-3">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider px-2 flex items-center gap-2"><MessageSquare size={14}/> Avvisi dal Coordinatore</h3>
              {data.messages.map((msg, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0"><AlertCircle size={18}/></div>
                      <div>
                          <h4 className="font-bold text-slate-800 text-sm">{msg.subject}</h4>
                          <p className="text-slate-500 text-xs mt-1 leading-relaxed">{msg.message}</p>
                          <p className="text-[10px] text-slate-300 mt-2 text-right">{new Date(msg.created_at).toLocaleDateString()}</p>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* 3. MARKET STATUS */}
      <Card className="p-6 border-none shadow-lg shadow-slate-100 flex flex-col items-center text-center space-y-4">
        <div className={`w-3 h-3 rounded-full ${statusColor} shadow-[0_0_15px_rgba(0,0,0,0.3)] animate-pulse`}></div>
        <div>
          <h3 className="text-lg font-black text-slate-800">Il Mercato è {statusText}</h3>
          {data.marketClosesAt && isMarketOpen && (<p className="text-xs text-slate-500 font-medium mt-1">Chiude il {new Date(data.marketClosesAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' })}</p>)}
        </div>
        <Button onClick={() => navigate('/member/shop')} className={`w-full py-4 rounded-2xl font-bold shadow-lg text-lg flex justify-center items-center gap-2 ${isMarketOpen ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
           <ShoppingBag size={20} /> {isMarketOpen ? 'Fai la Spesa' : 'Sfoglia Listino (Chiuso)'}
        </Button>
      </Card>

      {/* 4. INFO GRID */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 flex flex-col justify-between h-32 border-l-4 border-l-blue-500">
          <Truck className="text-blue-500 mb-2" size={24} />
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Prossima Consegna</p>
            <p className="text-sm font-bold text-slate-800 leading-tight mt-1">{data.nextDelivery ? new Date(data.nextDelivery).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : '-- / --'}</p>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between h-32 border-l-4 border-l-purple-500">
          {data.lastOrder ? (data.lastOrder.status === 'delivered' ? <CheckCircle2 className="text-emerald-500" size={24}/> : <Clock className="text-purple-500" size={24}/>) : <ShoppingBag className="text-slate-300" size={24}/>}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Ultimo Ordine</p>
            {data.lastOrder ? (<p className="text-sm font-bold text-slate-800 leading-tight mt-1">{data.lastOrder.items_count} prodotti <br/><span className="text-slate-500 text-xs">{parseFloat(data.lastOrder.total_amount).toFixed(2)} €</span></p>) : (<p className="text-xs text-slate-400 italic mt-1">Nessun ordine recente</p>)}
          </div>
        </Card>
      </div>
    </div>
  );
};