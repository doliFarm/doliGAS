/**
 * @file frontend/src/views/producer/ProducerOrders.jsx
 * @version v1.0.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Order Management. View for producers to download preparation lists (PDF/CSV) once the market is closed (G5).
 * @status Stable
 * @date 2026-01-16
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ClipboardList, CheckCircle2, AlertTriangle, Printer, 
  Loader2, Lock, ArrowRight 
} from 'lucide-react';
import { Card, Button, Toast, Badge } from '../../components/ui-kit';

export const ProducerOrders = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState({});
  const [isLocked, setIsLocked] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchData = async () => {
    try {
      const res = await axios.get('/api/products');
      // Filtriamo solo i prodotti che hanno ordini > 0
      const orderedItems = (res.data.products || []).filter(p => p.ordered_qty > 0);
      setItems(orderedItems);
      setIsLocked(res.data.isLocked || false);
      setChanges({});
    } catch (err) {
      setToast({ type: 'error', message: 'Errore caricamento ordini' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveConfirmation = async () => {
    if (isLocked) return;

    setSaving(true);
    // Prepariamo gli aggiornamenti
    // Se un prodotto non è stato toccato, lo "riconfermiamo" con la sua quantità attuale (ordinato o stock se minore)
    // Questo serve per dare un segnale esplicito di "Check-in"
    const updates = items.map(item => {
        // Quantità decisa dall'utente (changes) oppure quella calcolata attuale
        const userQty = changes[item.id];
        
        // Logica Default:
        // Se c'è una modifica esplicita -> usa quella
        // Se stock esiste ed è < ordinato -> usa stock
        // Altrimenti -> usa ordinato
        let finalQty = userQty !== undefined 
            ? userQty 
            : (item.stock !== null && item.stock < item.ordered_qty ? item.stock : item.ordered_qty);

        return {
            id: item.id,
            price: item.price,
            stock: finalQty, // Salviamo come stock la quantità che intendiamo consegnare
            is_active: 1,
            min_order_qty: item.min_order_qty
        };
    });

    try {
      await axios.put('/api/products/bulk', { items: updates });
      setToast({ type: 'success', message: 'Fornitura confermata!' });
      await fetchData(); // Ricarica per vedere i dati aggiornati dal server
    } catch (err) {
      setToast({ type: 'error', message: 'Errore durante la conferma' });
    } finally {
      setSaving(false);
    }
  };

  // Calcolo Totali per Header
  const totalRevenue = items.reduce((acc, item) => {
      let qty = changes[item.id];
      if (qty === undefined) {
          qty = (item.stock !== null && item.stock < item.ordered_qty) ? item.stock : item.ordered_qty;
      }
      return acc + (qty * item.price);
  }, 0);

  const totalItems = items.length;

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-amber-500" /></div>;

  if (items.length === 0) {
    return (
      <div className="p-10 text-center flex flex-col items-center">
        <ClipboardList size={48} className="text-slate-200 mb-4"/>
        <h3 className="text-xl font-bold text-slate-800">Nessun ordine</h3>
        <p className="text-slate-500">Non ci sono ancora ordini per questo ciclo.</p>
      </div>
    );
  }

  return (
    <div className="pb-24 space-y-6 animate-in fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* RIEPILOGO HEADER */}
      <div className={`text-white p-6 rounded-3xl shadow-xl flex justify-between items-center transition-colors ${isLocked ? 'bg-slate-700 shadow-slate-300' : 'bg-slate-900 shadow-slate-200'}`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
             <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Totale Consegna</p>
             {isLocked && <Badge color="red" className="text-[9px]">CHIUSO</Badge>}
          </div>
          <h2 className="text-3xl font-black">{totalRevenue.toFixed(2)} €</h2>
          <p className="text-slate-400 text-xs mt-1">{totalItems} articoli in ordine</p>
        </div>
        <button onClick={() => window.print()} className="bg-white/10 p-3 rounded-xl hover:bg-white/20 transition-colors">
          <Printer size={24} className="text-amber-400"/>
        </button>
      </div>

      {isLocked ? (
        <div className="flex items-center gap-2 bg-red-50 p-4 rounded-xl border border-red-100 text-red-800 text-xs leading-relaxed">
           <Lock size={16} className="shrink-0"/>
           <p className="font-bold">Tempo Scaduto: La conferma ordini è chiusa.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-amber-50 p-4 rounded-xl border border-amber-100 text-amber-800 text-xs leading-relaxed">
          <AlertTriangle size={16} className="shrink-0"/>
          <p>Conferma le quantità reali. Se non modifichi nulla, confermeremo l'intera richiesta.</p>
        </div>
      )}

      {/* LISTA ARTICOLI */}
      <div className="space-y-3">
        {items.map(item => {
          // Logica Visualizzazione Valore Input
          let displayQty;
          if (changes[item.id] !== undefined) {
              // 1. Modifica utente in corso (non ancora salvata)
              displayQty = changes[item.id];
          } else {
              // 2. Dati dal DB:
              // Se stock è definito E stock < ordinato, mostriamo stock (abbiamo confermato di meno).
              // Se stock è definito E stock >= ordinato, mostriamo ordinato (confermiamo tutto).
              // Se stock è null, mostriamo ordinato (nessun limite impostato).
              if (item.stock !== null && item.stock < item.ordered_qty) {
                  displayQty = item.stock;
              } else {
                  displayQty = item.ordered_qty;
              }
          }

          // Evidenzia se diverso dall'ordinato
          const isModified = displayQty != item.ordered_qty;

          return (
            <Card key={item.id} className={`p-4 border-l-4 ${isModified ? 'border-l-amber-500 bg-amber-50/20' : 'border-l-slate-200'}`}>
              <div className="flex items-center justify-between gap-4">
                
                {/* INFO PRODOTTO */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 text-sm truncate">{item.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge color="slate" className="text-[10px]">{item.unit}</Badge>
                    <span className="text-xs text-slate-400 font-medium">{item.price} €</span>
                  </div>
                </div>

                {/* CONFRONTO QUANTITÀ */}
                <div className="flex items-center gap-4 shrink-0">
                    
                    {/* Richiesto */}
                    <div className="text-right hidden sm:block">
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">RICHIESTO</div>
                        <div className="text-lg font-black text-slate-400">{item.ordered_qty}</div>
                    </div>

                    <ArrowRight className="text-slate-300 hidden sm:block" size={16} />

                    {/* In Consegna */}
                    <div className="text-right">
                        <div className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${isModified ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {isLocked ? 'CONSEGNATO' : 'CONFERMO'}
                        </div>
                        <input 
                           type="number" 
                           disabled={isLocked}
                           className={`w-20 text-center font-bold text-xl bg-white border-2 rounded-lg py-1 outline-none transition-all
                             ${isLocked 
                                ? 'bg-slate-100 border-slate-200 text-slate-500' 
                                : isModified 
                                    ? 'border-amber-400 text-amber-700 shadow-sm focus:border-amber-500' 
                                    : 'border-emerald-200 text-emerald-700 focus:border-emerald-500'
                             }`}
                           value={displayQty}
                           onChange={(e) => setChanges({...changes, [item.id]: parseFloat(e.target.value) || 0})}
                        />
                    </div>
                </div>
              </div>
              
              {/* Mobile Info */}
              <div className="sm:hidden mt-2 pt-2 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                  <span>Richiesto:</span>
                  <span className="font-bold text-slate-600">{item.ordered_qty} {item.unit}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* FOOTER */}
      {!isLocked && (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 z-30 md:static md:bg-transparent md:border-none md:p-0">
           <Button 
             onClick={handleSaveConfirmation} 
             isLoading={saving}
             className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 flex justify-center items-center gap-2"
           >
             <CheckCircle2 size={20}/> CONFERMA FORNITURA
           </Button>
        </div>
      )}

      <style>{`@media print { .no-print, header, nav, button, .fixed { display: none !important; } body { background: white; } }`}</style>
    </div>
  );
};