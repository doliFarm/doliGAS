/*
 * doliGAS - Solidarity purchasing group (GAS) management platform
 * Copyright (C) 2026 Luigi Grillo (doliFarm)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

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
      // Keep only the products with orders > 0
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

  // Proposed quantity for a product: the one already confirmed in this cycle
  // (producer_cycle_supply), otherwise everything the members ordered.
  // The price list stock is not involved: it caps the orders, it is not the supply.
  const defaultQty = (item) =>
    (item.confirmed_qty !== null && item.confirmed_qty !== undefined) ? Number(item.confirmed_qty) : Number(item.ordered_qty);

  const handleSaveConfirmation = async () => {
    if (isLocked) return;

    setSaving(true);
    // Prepare the updates
    // If a product was not touched, "reconfirm" it with its current quantity (saved confirmation or ordered)
    // This gives an explicit "check-in" signal
    const updates = items.map(item => {
        // Quantity chosen by the user (changes) or the current computed one
        const userQty = changes[item.id];
        
        // Default logic:
        // If there is an explicit change -> use it
        // Otherwise -> the confirmation already saved for the cycle, or else the ordered quantity
        let finalQty = userQty !== undefined 
            ? userQty 
            : defaultQty(item);

        return {
            id: item.id,
            price: item.price,
            stock: finalQty, // Quantity we intend to deliver (stored in producer_cycle_supply)
            is_active: 1,
            min_order_qty: item.min_order_qty
        };
    });

    try {
      // Dedicated endpoint: the supply confirmation happens after the market closes,
      // when the price list is locked, so it does not go through /api/products/bulk
      await axios.post('/api/products/confirm-supply', {
        items: updates.map(u => ({ id: u.id, qty: u.stock }))
      });
      setToast({ type: 'success', message: 'Fornitura confermata!' });
      await fetchData(); // Reload to see the updated data from the server
    } catch (err) {
      setToast({ type: 'error', message: 'Errore durante la conferma' });
    } finally {
      setSaving(false);
    }
  };

  // Totals for the header
  const totalRevenue = items.reduce((acc, item) => {
      let qty = changes[item.id];
      if (qty === undefined) {
          qty = defaultQty(item);
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

      {/* SUMMARY HEADER */}
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

      {/* ITEM LIST */}
      <div className="space-y-3">
        {items.map(item => {
          // Input value display logic
          let displayQty;
          if (changes[item.id] !== undefined) {
              // 1. User change in progress (not saved yet)
              displayQty = changes[item.id];
          } else {
              // 2. Data from the DB: the confirmation already saved for the cycle, otherwise the ordered quantity
              displayQty = defaultQty(item);
          }

          // Highlight if different from the ordered quantity
          const isModified = displayQty != item.ordered_qty;

          return (
            <Card key={item.id} className={`p-4 border-l-4 ${isModified ? 'border-l-amber-500 bg-amber-50/20' : 'border-l-slate-200'}`}>
              <div className="flex items-center justify-between gap-4">
                
                {/* PRODUCT INFO */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 text-sm truncate">{item.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge color="slate" className="text-[10px]">{item.unit}</Badge>
                    <span className="text-xs text-slate-400 font-medium">{item.price} €</span>
                  </div>
                </div>

                {/* QUANTITY COMPARISON */}
                <div className="flex items-center gap-4 shrink-0">
                    
                    {/* Requested */}
                    <div className="text-right hidden sm:block">
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">RICHIESTO</div>
                        <div className="text-lg font-black text-slate-400">{item.ordered_qty}</div>
                    </div>

                    <ArrowRight className="text-slate-300 hidden sm:block" size={16} />

                    {/* To be delivered */}
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