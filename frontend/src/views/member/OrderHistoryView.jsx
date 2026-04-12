/* =============================================================================
   FILE: frontend/src/views/member/OrderHistoryView.jsx - v6.1
   STATUS: Integro, Completo, Robusto.
   DESC: Storico Ordini con supporto Multi-Context e Modalità Tabella/Grid.
   FIX: Iniezione gasId per recuperare solo gli ordini del GAS attivo.
   ============================================================================= */
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { 
  ClipboardList, ChevronRight, Printer, X, ShoppingBag, 
  Calendar, CheckCircle2, Clock, Loader2, LayoutGrid, List, ArrowUpDown 
} from 'lucide-react';
import { Card, Button, Badge } from '../../components/ui-kit';
import { useAuth } from '../../context/AuthContext'; // Import Context

const API_URL = import.meta.env.VITE_API_URL || '';

export const OrderHistoryView = () => {
  const { t } = useTranslation();
  const { activeProfile } = useAuth(); // Recupero Profilo
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  // UX States
  const [viewMode, setViewMode] = useState('TABLE'); // 'GRID' | 'TABLE'
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  // 1. Fetch Dati
  useEffect(() => {
    const fetchOrders = async () => {
      if (!activeProfile?.context_id) return;
      const gasId = activeProfile.context_id;

      try {
        setLoading(true);
        // Iniezione gasId
        const res = await axios.get(`${API_URL}/api/members/orders?gasId=${gasId}`);
        setOrders(res.data);
      } catch (err) { 
        console.error("Orders Error:", err); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchOrders();
  }, [activeProfile]);

  const handleOpenDetail = async (orderId) => {
    if (!activeProfile?.context_id) return;
    const gasId = activeProfile.context_id;

    setDetailsLoading(true);
    setSelectedOrder({ id: orderId }); 
    try {
      // Iniezione gasId anche per il dettaglio
      const res = await axios.get(`${API_URL}/api/members/orders/${orderId}?gasId=${gasId}`);
      setSelectedOrder(res.data);
    } catch (err) { 
      console.error("Detail Error:", err); 
    } finally { 
      setDetailsLoading(false); 
    }
  };

  const printOrder = () => window.print();

  // 2. Logica Ordinamento
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      if (sortConfig.key === 'total_amount') {
         valA = parseFloat(valA);
         valB = parseFloat(valB);
      } else if (sortConfig.key === 'created_at') {
         valA = new Date(valA).getTime();
         valB = new Date(valB).getTime();
      } else {
         valA = String(valA).toLowerCase();
         valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [orders, sortConfig]);

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-emerald-500" size={40}/></div>;

  return (
    <div className="pb-24 space-y-4 animate-in fade-in">
      
      {/* HEADER E CONTROLLI */}
      <div className="flex items-center justify-between px-2">
        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <ClipboardList className="text-emerald-600"/> {t('member_orders.title')}
        </h2>
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
           <button onClick={() => setViewMode('GRID')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400'}`}><LayoutGrid size={18}/></button>
           <button onClick={() => setViewMode('TABLE')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400'}`}><List size={18}/></button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="p-10 text-center text-slate-400 flex flex-col items-center">
          <ShoppingBag size={48} className="mb-4 opacity-20"/>
          <p>{t('member_orders.empty')}</p>
        </div>
      ) : (
        <>
          {/* VISTA GRIGLIA */}
          {viewMode === 'GRID' && (
            <div className="space-y-3">
              {sortedOrders.map(order => (
                <Card 
                  key={order.id} 
                  className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer border-l-4 border-l-transparent hover:border-l-emerald-500"
                  onClick={() => handleOpenDetail(order.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${order.status === 'delivered' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                       {order.status === 'delivered' ? <CheckCircle2 size={20}/> : <Clock size={20}/>}
                    </div>
                    <div>
                      <p className="font-bold text-slate-700 text-sm">{order.cycle_name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <Calendar size={12}/> {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-800">{parseFloat(order.total_amount).toFixed(2)} €</p>
                    <Badge color={order.status === 'pending' ? 'yellow' : 'green'} className="mt-1 text-[9px]">
                      {t(`member_orders.status_${order.status}`) || order.status}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* VISTA TABELLA SORTABLE */}
          {viewMode === 'TABLE' && (
             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest cursor-pointer select-none">
                            <tr>
                                <th className="p-3 hover:text-emerald-600" onClick={() => handleSort('cycle_name')}>
                                    <div className="flex items-center gap-1">{t('member_orders.cycle')} <ArrowUpDown size={10}/></div>
                                </th>
                                <th className="p-3 hover:text-emerald-600" onClick={() => handleSort('created_at')}>
                                    <div className="flex items-center gap-1">{t('member_orders.date')} <ArrowUpDown size={10}/></div>
                                </th>
                                <th className="p-3 hover:text-emerald-600" onClick={() => handleSort('status')}>
                                    <div className="flex items-center gap-1">{t('member_orders.status')} <ArrowUpDown size={10}/></div>
                                </th>
                                <th className="p-3 text-right hover:text-emerald-600" onClick={() => handleSort('total_amount')}>
                                    <div className="flex items-center justify-end gap-1">{t('member_orders.amount')} <ArrowUpDown size={10}/></div>
                                </th>
                                <th className="p-3 text-center">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedOrders.map(order => (
                                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-3 font-bold text-slate-700">{order.cycle_name}</td>
                                    <td className="p-3 text-slate-500">{new Date(order.created_at).toLocaleDateString()}</td>
                                    <td className="p-3">
                                        <Badge color={order.status === 'pending' ? 'yellow' : 'green'}>
                                            {t(`member_orders.status_${order.status}`) || order.status}
                                        </Badge>
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-slate-800">
                                        {parseFloat(order.total_amount).toFixed(2)} €
                                    </td>
                                    <td className="p-3 text-center">
                                        <Button size="sm" variant="ghost" onClick={() => handleOpenDetail(order.id)}>
                                            <ChevronRight size={16}/>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
          )}
        </>
      )}

      {/* MODALE DETTAGLIO */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:w-full print:max-w-none">
            
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 print:hidden">
              <h3 className="font-bold text-lg">{t('member_orders.view_detail')} #{selectedOrder.id}</h3>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-slate-200 rounded-full"><X size={20}/></button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto bg-white" id="printable-area">
              {detailsLoading ? (
                <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-emerald-500"/></div>
              ) : (
                <>
                  <div className="text-center mb-6 border-b border-dashed border-slate-300 pb-6">
                    <h2 className="font-black text-xl text-slate-800 uppercase tracking-widest">{activeProfile.context_name}</h2>
                    <p className="text-xs text-slate-400 uppercase mt-1">Ricevuta Ordine</p>
                    <div className="mt-4 text-sm font-medium text-slate-600">
                      <p>{selectedOrder.cycle_name}</p>
                      <p>{new Date(selectedOrder.created_at).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm py-1 border-b border-slate-50 last:border-none">
                        <div>
                          <span className="font-bold text-slate-700">{item.product_name}</span>
                          <div className="text-xs text-slate-400">{item.quantity} {item.unit} x {parseFloat(item.price_at_order).toFixed(2)}€</div>
                        </div>
                        <div className="font-mono font-bold text-slate-800">
                          {(item.quantity * item.price_at_order).toFixed(2)} €
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-800 pt-4 flex justify-between items-end">
                    <span className="font-bold text-slate-600 uppercase text-xs">{t('member_orders.amount')}</span>
                    <span className="font-black text-2xl text-slate-800">{parseFloat(selectedOrder.total_amount).toFixed(2)} €</span>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 print:hidden">
              <Button onClick={printOrder} className="w-full bg-slate-800 text-white flex justify-center items-center gap-2">
                <Printer size={18}/> Stampa Ricevuta
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body > *:not(#root) { display: none; }
          #root > *:not(.fixed) { display: none; }
          .fixed { position: absolute; top: 0; left: 0; width: 100%; height: auto; background: white; }
          .print\\:hidden { display: none !important; }
          .print\\:w-full { width: 100% !important; max-width: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:static { position: static !important; }
        }
      `}</style>
    </div>
  );
};