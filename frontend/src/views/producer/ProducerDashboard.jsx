/**
 * @file frontend/src/views/producer/ProducerDashboard.jsx
 * @version v1.1.3
 * @description Dashboard Produttore. Fix segregazione messaggi e risoluzione ReferenceError 'data'.
 * STATUS: Integro, Completo, Robusto.
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  Package, ClipboardList, AlertCircle, Calendar, 
  CheckCircle2, Clock, Loader2, RefreshCcw, Info, ShoppingBag, MessageSquare, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, Button, Toast } from '../../components/ui-kit';

export const ProducerDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeProfile } = useAuth();
  
  // Utilizziamo 'status' come unica fonte di verità per coerenza con il resto del file
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchStatus = async () => {
    if (!activeProfile || activeProfile.type !== 'PRODUCER') {
        setLoading(false);
        return;
    }
    try {
      setLoading(true);
      setError(false);
      // La chiamata recupera 'messages' già filtrati per target_profile = 'producer'
      const res = await axios.get(`/api/products/dashboard-status?producerId=${activeProfile.context_id}`);
      setStatus(res.data);
    } catch (err) {
      console.error("Dashboard Producer Fetch Error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    try {
      if (!status?.cycleId) {
        setToast({ type: 'error', message: 'Errore: Ciclo non trovato' });
        return;
      }
      
      await axios.post('/api/products/validate-list', {
        producerId: activeProfile.context_id,
        cycleId: status.cycleId
      });
      
      setToast({ type: 'success', message: t('producer.validation_success', 'Listino validato con successo!') });
      fetchStatus(); // Ricarica i dati per mostrare il badge verde
    } catch (err) {
      console.error("Errore validazione:", err);
      setToast({ type: 'error', message: 'Impossibile validare il listino' });
    }
  };

  const handleDismissMessage = async (msgId) => {
    // 1. Optimistic UI Update: Rimuove istantaneamente il messaggio visivamente
    setStatus(prev => ({
      ...prev,
      messages: prev.messages.filter(m => m.id !== msgId)
    }));

    // 2. Chiamata API in background
    try {
      await axios.patch(`/api/products/messages/${msgId}/read`);
    } catch (err) {
      console.error("Errore chiusura messaggio:", err);
      // In caso di errore silente, al prossimo refresh riapparirà
    }
  };

  useEffect(() => { 
    fetchStatus(); 
  }, [activeProfile]);

  if (loading) {
    return (
      <div className="p-20 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-amber-500 mb-4" size={48} />
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest text-center">Sincronizzazione Azienda...</p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="p-10 flex justify-center">
        <Card className="max-w-md w-full p-8 text-center border-amber-100 bg-amber-50/30 rounded-[2rem]">
          <AlertCircle className="mx-auto text-amber-500 mb-4" size={40} />
          <h3 className="text-slate-800 font-bold mb-2 text-lg">Connessione Interrotta</h3>
          <p className="text-slate-500 text-sm mb-6">Impossibile recuperare lo stato del ciclo operativo.</p>
          <Button onClick={fetchStatus} className="bg-amber-600 text-white w-full flex justify-center items-center gap-2 rounded-xl py-3 font-bold">
            <RefreshCcw size={16}/> Riprova Caricamento
          </Button>
        </Card>
      </div>
    );
  }

  // --- LOGICA UI DINAMICA ---
  let HeroIcon = Clock; 
  let heroColor = 'bg-slate-100 text-slate-500';
  let actionBtn = null;

  const currentState = status.state || 'NO_CYCLE';

  switch (currentState) {
    case 'LIST_OPEN': 
      HeroIcon = Package;
      heroColor = 'bg-emerald-100 text-emerald-700';
      actionBtn = (
        <Button onClick={() => navigate('/producer/editor')} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 transition-all">
          <Package size={20}/> AGGIORNA LISTINO
        </Button>
      );
      break;
    case 'MARKET_OPEN':
      HeroIcon = ShoppingBag;
      heroColor = 'bg-blue-100 text-blue-700';
      // Nessun bottone: il produttore attende che i soci finiscano di comprare
      break;
    case 'WAITING':
    case 'MARKET_CLOSED':
      HeroIcon = Clock;
      heroColor = 'bg-amber-100 text-amber-700';
      // Nessun bottone: i soci hanno finito, il coordinatore sta per inviare gli ordini
      break;
    case 'ORDERS_RECEIVED': // FASE G5: Ordini inviati al fornitore
      HeroIcon = ClipboardList;
      heroColor = 'bg-emerald-100 text-emerald-700';
      actionBtn = (
        <Button onClick={() => navigate('/producer/orders')} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 transition-all animate-in zoom-in">
          <ClipboardList size={20}/> PREPARA ORDINI
        </Button>
      );
      break;
    default:
      HeroIcon = Clock;
      heroColor = 'bg-slate-100 text-slate-400';
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* 1. HERO STATUS CARD (Pannello Unificato) */}
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 relative overflow-hidden">
        <div className={`absolute top-0 right-0 p-32 ${heroColor.split(' ')[0]} rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 opacity-30`}></div>
        
        <div className="relative z-10 text-center flex flex-col items-center">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 ${heroColor} shadow-inner`}>
            <HeroIcon size={40} />
          </div>
          
          <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight uppercase">
            {t(`producer_dash.states.${status.state}`)}
          </h2>
          
          <p className="text-slate-500 font-medium text-base max-w-md mx-auto leading-relaxed text-center mb-6">
            {t(`producer_dash.messages.${status.state}`)}
          </p>
          
          {/* SCADENZA: Visibile SOLO durante il G1/G2 */}
          {currentState === 'LIST_OPEN' && status.deadline && (
            <div className="flex items-center gap-2 bg-slate-50 px-5 py-2.5 rounded-xl text-xs font-black text-slate-600 border border-slate-200 shadow-sm uppercase">
              <Calendar size={16} className="text-amber-500"/> 
              Scadenza Validazione: {new Date(status.deadline).toLocaleString('it-IT', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {/* TIMELINE FASI SUCCESSIVE: Visibile SOLO DOPO la chiusura listino */}
          {currentState !== 'LIST_OPEN' && currentState !== 'NO_CYCLE' && (
            <div className="w-full max-w-lg mt-2 bg-slate-50/50 rounded-2xl p-6 border border-slate-100/50">
              <div className="flex flex-col sm:flex-row justify-center gap-8 sm:gap-16 relative">
                {/* Linea di connessione orizzontale */}
                <div className="hidden sm:block absolute top-5 left-1/4 right-1/4 h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>

                {/* FASE G3: Ordini Soci */}
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border-4 border-white shadow-sm transition-all duration-500 ${
                    (currentState === 'WAITING' || currentState === 'MARKET_OPEN') 
                      ? 'bg-blue-500 text-white scale-110 shadow-blue-200' 
                      : 'bg-slate-200 text-slate-400'
                  }`}>
                    <ShoppingBag size={16} />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-slate-600">Ordini Soci</h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                    Fino al {status.marketCloseAt ? new Date(status.marketCloseAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/D'}
                  </p>
                </div>

                {/* FASE G4/G5: Consegna */}
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border-4 border-white shadow-sm transition-all duration-500 ${
                    currentState === 'ORDERS_RECEIVED' 
                      ? 'bg-emerald-500 text-white scale-110 shadow-emerald-200' 
                      : 'bg-slate-200 text-slate-400'
                  }`}>
                    <Package size={16} />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-slate-600">Consegna</h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                    {status.deliveryAt ? new Date(status.deliveryAt).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/D'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* BOTTONE AZIONE PRINCIPALE (Validazione, Prepara Ordini) */}
          {actionBtn && (
            <div className="mt-8 w-full max-w-sm">
              {actionBtn}
            </div>
          )}
        </div>
      </div>

      {/* 2. VALIDAZIONE LISTINO - Workflow G1->G2 (Scompare in automatico quando scade) */}
      {currentState === 'LIST_OPEN' && (
        <div className={`p-6 rounded-[2rem] border transition-all duration-500 ${status.isValidated ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-200 shadow-lg shadow-amber-100/20 animate-in zoom-in-95'}`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl shadow-sm ${status.isValidated ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white animate-pulse'}`}>
                {status.isValidated ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}
              </div>
              <div>
                <h4 className="font-black text-slate-800 uppercase text-sm tracking-tight leading-none mb-1">
                  {status.isValidated ? 'Listino Validato' : 'Conferma Listino Richiesta'}
                </h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {status.isValidated 
                    ? `Listino confermato il ${new Date(status.validatedAt).toLocaleDateString('it-IT')}. I soci vedranno i tuoi prodotti.` 
                    : 'Attenzione: i soci non potranno acquistare i tuoi prodotti finché non clicchi su valida.'}
                </p>
              </div>
            </div>
            {!status.isValidated && (
              <Button 
                onClick={handleValidate} 
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.15em] shadow-xl shadow-amber-200 transition-all hover:scale-105 active:scale-95"
              >
                Valida Listino Ora
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 3. MESSAGGI DI SERVIZIO */}
      {status.messages && status.messages.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.15em] px-2 flex items-center gap-2">
            <MessageSquare size={16} className="text-amber-500" /> 
            {t('producer.dashboard.admin_notices', 'Comunicazioni dal Coordinatore')}
          </h3>
          
          <div className="grid grid-cols-1 gap-3">
            {status.messages.map((msg) => (
              <div 
                key={msg.id} // <-- Usiamo l'ID reale del DB
                className="bg-white p-5 rounded-[2rem] border border-amber-100 shadow-sm shadow-amber-50/50 flex items-start gap-4 hover:shadow-md transition-all duration-300 group relative"
              >
                {/* BOTTONE X PER CHIUDERE */}
                <button 
                  onClick={() => handleDismissMessage(msg.id)}
                  className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  title="Segna come letto"
                >
                  <X size={18} strokeWidth={3} />
                </button>

                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0 group-hover:scale-110 transition-transform">
                  <AlertCircle size={20} />
                </div>
                <div className="flex-1 min-w-0 pr-6"> {/* pr-6 per non sormontare la X */}
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-black text-slate-800 text-sm leading-tight">{msg.title || msg.subject}</h4>
                    <span className="text-[9px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-tighter shrink-0">Azienda</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-2 leading-relaxed font-medium">{msg.message}</p>
                  <div className="mt-3 pt-3 border-t border-slate-50 flex justify-start">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{new Date(msg.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ASSISTENZA */}
      <div className="bg-emerald-50 rounded-[2rem] p-6 flex items-start gap-4 border border-emerald-100 shadow-sm">
        <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600 shrink-0">
          <Info size={24} />
        </div>
        <div>
          <h4 className="font-black text-emerald-900 text-base">Assistenza Tecnica</h4>
          <p className="text-sm text-emerald-800/70 mt-1">Contatta il coordinatore del GAS per supporto tecnico.</p>
        </div>
      </div>
    </div>
  );
};