/**
 * @file frontend/src/views/admin/CoordLogistics.jsx
 * @version v1.0.1
 * @author Luigi GRILLO @ doliFarm.com
 * @description Logistics Interface. Frontend for G6 (Check-in/Weight Reconciliation) and G7 (Distribution), calculating price variations automatically.
 * @status Stable - Fixed Translation Scoping
 * @date 2026-01-16
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { 
  Truck, Search, Save, Loader2, Package, CheckCircle, 
  AlertTriangle, User, Calendar, DollarSign, Scale
} from 'lucide-react';
import { Card, Button, Badge, Toast, Modal } from '../../components/ui-kit';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

const formatQty = (qty, isDiscrete) => {
    const val = parseFloat(qty);
    if (isNaN(val)) return '0';
    return isDiscrete ? Math.round(val).toString() : val.toFixed(2);
};

export const CoordLogistics = () => {
  const { activeProfile } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('CHECKIN'); 
  const [activeCycle, setActiveCycle] = useState(null);
  const [loadingCycle, setLoadingCycle] = useState(true);

  useEffect(() => {
    const fetchCycle = async () => {
      if (!activeProfile?.context_id) return;
      try {
        const gasId = activeProfile.context_id;
        const res = await axios.get(`${API_URL}/api/admin/cycles/history?gasId=${gasId}`);
        const current = res.data.find(c => c.is_active) || res.data[0];
        setActiveCycle(current);
      } catch (err) { console.error("Logistics Cycle Fetch Error:", err); } 
      finally { setLoadingCycle(false); }
    };
    fetchCycle();
  }, [activeProfile]);

  if (loadingCycle) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-emerald-600" /></div>;

  return (
    <div className="max-w-screen-2xl mx-auto pb-20 px-2 sm:px-4 space-y-6 flex flex-col h-[calc(100vh-100px)]">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 shrink-0 no-print">
        <div className="w-full lg:w-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="text-emerald-600"/> {t('admin_logistics.subtitle')}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 flex items-center gap-2">
             {t('admin_logistics.active_phase')}: {activeCycle ? <Badge color="emerald">{activeCycle.name}</Badge> : <Badge color="slate">{t('admin_logistics.no_active_cycle')}</Badge>}
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
             <button onClick={() => setActiveTab('CHECKIN')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'CHECKIN' ? 'bg-white shadow text-emerald-700' : 'text-slate-500'}`}>{t('admin_logistics.tab_checkin')}</button>
             <button onClick={() => setActiveTab('CHECKOUT')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'CHECKOUT' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}>{t('admin_logistics.tab_checkout')}</button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeCycle ? (
          activeTab === 'CHECKIN' ? 
            <CheckInView cycleId={activeCycle.id} gasId={activeProfile.context_id} /> : 
            <CheckOutView cycleId={activeCycle.id} gasId={activeProfile.context_id} />
        ) : (
          <div className="p-20 text-center text-slate-400 font-bold border-2 border-dashed rounded-3xl m-4">{t('admin_logistics.no_active_cycle')}</div>
        )}
      </div>
    </div>
  );
};

// --- RICEZIONE MERCE (CHECK-IN) ---
const CheckInView = ({ cycleId, gasId }) => {
  const { t } = useTranslation(); // <-- FIX: Hook aggiunto per risolvere ReferenceError
  const [products, setProducts] = useState([]);
  const [localQtys, setLocalQtys] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);

  const fetchData = async () => {
    try {
        const res = await axios.get(`${API_URL}/api/admin/logistics/checkin/${cycleId}?gasId=${gasId}`);
        setProducts(res.data);
        const qtys = {}; 
        res.data.forEach(p => { qtys[p.product_id] = p.qty_received_total; });
        setLocalQtys(qtys);
    } catch(e) { setToast({ type:'error', message: 'Errore caricamento checkin' }); }
  };
  
  useEffect(() => { fetchData(); }, [cycleId, gasId]);

  const filtered = products.filter(p => p.product_name.toLowerCase().includes(searchTerm.toLowerCase()));
  
  // Identifica i prodotti modificati
  const getChanged = () => products.filter(p => parseFloat(localQtys[p.product_id]) !== parseFloat(p.qty_received_total)).map(p => ({ productId: p.product_id, totalReceived: parseFloat(localQtys[p.product_id]) }));

  const handleSave = async () => {
    const changed = getChanged();
    if (changed.length === 0) return;
    
    if(!window.confirm(`Stai per aggiornare ${changed.length} prodotti. Il sistema ricalcolerà i prezzi e i wallet dei soci. Procedere?`)) return;

    setIsSaving(true);
    try {
      await axios.post(`${API_URL}/api/admin/logistics/checkin/bulk-update`, { 
          cycleId, 
          items: changed,
          gasId
      });
      setToast({ type: 'success', message: t('admin_logistics.save_success') }); 
      fetchData(); // Ricarica per allineare i dati
    } catch (err) { setToast({ type: 'error', message: t('common.error') }); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <Card className="p-4 bg-white shadow-sm border-slate-200 shrink-0">
        <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 relative w-full">
                <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                <input placeholder={t('admin_logistics.search_item')} className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-100 bg-slate-50 rounded-xl outline-none focus:border-indigo-500 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="text-xs text-slate-400 hidden md:block">
                    Modifica la colonna "Ricevuto" per ricalcolare i pesi.
                </div>
                <Button onClick={handleSave} isLoading={isSaving} disabled={getChanged().length === 0} className="bg-orange-500 text-white font-bold w-full md:w-auto">
                    <Scale size={18} className="mr-2"/> {t('common.save')} ({getChanged().length})
                </Button>
            </div>
        </div>
      </Card>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-y-auto flex-1 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b sticky top-0 z-10">
            <tr>
                <th className="px-6 py-4">Articolo / Produttore</th>
                <th className="text-center py-4 w-32">Ordinato</th>
                <th className="text-center py-4 w-40">Ricevuto Reale</th>
                <th className="text-center py-4 w-32">Differenza</th>
                <th className="text-center py-4 w-24">Stato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(p => {
              const currentVal = parseFloat(localQtys[p.product_id] || 0);
              const originalVal = parseFloat(p.qty_ordered); // Confronto con l'ordinato originale
              const dbVal = parseFloat(p.qty_received_total); // Confronto con l'ultimo salvataggio
              
              const isModified = currentVal !== dbVal;
              const diff = currentVal - originalVal;
              const diffColor = diff < 0 ? 'text-red-500' : (diff > 0 ? 'text-emerald-500' : 'text-slate-300');

              return (
                <tr key={p.product_id} className={isModified ? 'bg-orange-50/30' : 'hover:bg-slate-50/50'}>
                  <td className="px-6 py-4">
                      <p className="font-bold text-slate-700">{p.product_name}</p>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1"><Package size={10}/> {p.producer_name}</p>
                  </td>
                  <td className="text-center font-mono font-bold text-slate-400 bg-slate-50/50">
                      {formatQty(p.qty_ordered, p.is_discrete)} {p.unit}
                  </td>
                  <td className="text-center px-4">
                      <input 
                        type="number" 
                        step={p.is_discrete ? "1" : "0.01"} 
                        className={`w-full text-center py-2 border-2 rounded-xl font-black outline-none transition-colors ${isModified ? 'border-orange-300 bg-white text-orange-600' : 'border-slate-100 bg-slate-50 focus:border-indigo-500'}`} 
                        value={localQtys[p.product_id] || ''} 
                        onChange={e => setLocalQtys({...localQtys, [p.product_id]: e.target.value})} 
                      />
                  </td>
                  <td className={`text-center font-mono font-bold ${diffColor}`}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(2)} {p.unit}
                  </td>
                  <td className="text-center">
                      {isModified ? <Badge color="orange">DA SALVARE</Badge> : <Badge color="slate">OK</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- CONSEGNA (CHECK-OUT) ---
const CheckOutView = ({ cycleId, gasId }) => {
  const { t } = useTranslation(); // <-- FIX: Hook aggiunto per risolvere ReferenceError
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewOrderId, setPreviewOrderId] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchList = async () => {
    try {
        const res = await axios.get(`${API_URL}/api/admin/logistics/checkout-list/${cycleId}?gasId=${gasId}`);
        setMembers(res.data);
    } catch(e) { setToast({ type:'error', message: 'Errore lista checkout' }); }
    finally { setLoading(false); }
  };
  
  useEffect(() => { fetchList(); }, [cycleId, gasId]);

  const handleOpenPreview = async (orderId) => {
    setPreviewOrderId(orderId);
    try {
        const res = await axios.get(`${API_URL}/api/admin/logistics/receipt/${orderId}?gasId=${gasId}`);
        setPreviewData(res.data);
    } catch(e) { 
        setToast({ type:'error', message: 'Errore caricamento ricevuta' }); 
        setPreviewOrderId(null);
    }
  };

  const handleDeliver = async () => {
    setIsConfirming(true);
    try {
      await axios.post(`${API_URL}/api/admin/logistics/checkout/deliver`, { 
          orderId: previewOrderId,
          gasId
      });
      setToast({ type: 'success', message: t('admin_logistics.delivery_success') });
      setPreviewOrderId(null); fetchList();
    } catch (err) { setToast({ type: 'error', message: t('common.error') }); }
    finally { setIsConfirming(false); }
  };

  const filtered = members.filter(m => `${m.first_name} ${m.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-full flex flex-col space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <Card className="p-4 bg-white shadow-sm border-slate-200 shrink-0">
        <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
            <input placeholder={t('admin_logistics.search_member')} className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
        {filtered.map(m => (
          <Card key={m.order_id} className={`p-4 border-l-4 ${m.status === 'delivered' ? 'border-l-emerald-500 bg-emerald-50/10' : 'border-l-blue-500 bg-white'}`}>
            <div className="flex justify-between items-center">
                <div>
                    <p className="font-black text-slate-800 uppercase text-xs">{m.last_name} {m.first_name}</p>
                    <p className="font-mono font-bold text-slate-500">Totale: € {parseFloat(m.real_total).toFixed(2)}</p>
                </div>
                <Button size="sm" variant={m.status === 'delivered' ? 'outline' : 'primary'} onClick={() => handleOpenPreview(m.order_id)} className="rounded-xl px-4">
                    {m.status === 'delivered' ? 'VEDI' : 'CONSEGNA'}
                </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={!!previewOrderId} onClose={() => setPreviewOrderId(null)} title="Dettaglio Consegna">
        {previewData ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase">Socio Ordinante</p>
                <p className="font-bold text-lg text-slate-800">{previewData.order.first_name} {previewData.order.last_name}</p>
            </div>
            
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {previewData.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-xs border-b border-slate-50 pb-2 last:border-none">
                  <div className="flex-1">
                      <p className="font-bold text-slate-700">{it.product_name}</p>
                      <p className="text-[10px] text-slate-400 uppercase">{it.producer_name}</p>
                  </div>
                  <div className="text-right">
                      <p className="font-mono font-bold text-slate-800">{formatQty(it.qty_received ?? it.quantity, it.is_discrete)} {it.unit}</p>
                      <p className="text-[10px] text-slate-400">€ {it.price_at_order}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-blue-50 rounded-2xl flex justify-between items-center">
                <span className="text-xs font-bold text-blue-600 uppercase">Totale Definitivo</span>
                <span className="text-2xl font-black text-blue-900">€ {parseFloat(previewData.order.total_amount).toFixed(2)}</span>
            </div>
            
            {previewData.order.status !== 'delivered' && (
              <Button onClick={handleDeliver} isLoading={isConfirming} className="w-full bg-emerald-600 py-4 text-white text-lg rounded-2xl shadow-xl hover:bg-emerald-700">
                  <CheckCircle size={20} className="mr-2"/> CONSEGNA MERCE
              </Button>
            )}
          </div>
        ) : <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-500" size={32}/></div>}
      </Modal>
    </div>
  );
};