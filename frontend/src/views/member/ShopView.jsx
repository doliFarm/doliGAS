/**
 * @file frontend/src/views/member/ShopView.jsx
 * @version v1.0.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Member Shop. Full-featured e-commerce interface with isolated cart, stock checks, and conditional Wallet logic (Prepaid/Trust).
 * @status Stable
 * @date 2026-01-16
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Filter, ShoppingCart, Plus, Minus, X, Store, Loader2, Trash2, 
  LayoutGrid, List, Ban, ArrowUpDown 
} from 'lucide-react';
import { Card, Button, Toast } from '../../components/ui-kit';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

export const ShopView = () => {
  const { activeProfile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [shopData, setShopData] = useState({ isOpen: false, products: [], cycleId: null });
  
  // STATO CARRELLO: Inizializzato lazy per GAS specifico
  const [cart, setCart] = useState({});
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  
  // UI States
  const [viewMode, setViewMode] = useState('GRID'); 
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('ALL');
  const [filterProd, setFilterProd] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  // --- CARICAMENTO DATI ---
  useEffect(() => {
    const fetchShop = async () => {
      if (!activeProfile?.context_id) return;
      const gasId = activeProfile.context_id;

      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/api/members/shop?gasId=${gasId}`);
        setShopData(res.data);

        const savedCart = localStorage.getItem(`doliGAS_cart_${gasId}`);
        if (savedCart) setCart(JSON.parse(savedCart));
        else setCart({});

      } catch (err) { 
        setToast({ type: 'error', message: t('common.error') }); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchShop();
  }, [activeProfile]);

  // --- SALVATAGGIO CARRELLO ---
  useEffect(() => {
    if (activeProfile?.context_id) {
      localStorage.setItem(`doliGAS_cart_${activeProfile.context_id}`, JSON.stringify(cart));
    }
  }, [cart, activeProfile]);

  const updateQty = (productId, delta, maxStock) => {
    if (!shopData.isOpen) return; 
    setCart(prev => {
      const current = prev[productId] || 0;
      const newVal = Math.max(0, current + delta);
      if (maxStock !== null && newVal > maxStock) {
          // Nota: qui potremmo aggiungere una chiave i18n per "Max stock raggiunto"
          return prev;
      }
      const newCart = { ...prev };
      if (newVal === 0) delete newCart[productId];
      else newCart[productId] = newVal;
      return newCart;
    });
  };

  const clearCart = () => setCart({});

  const cartTotalInfo = useMemo(() => {
    let count = 0;
    let total = 0;
    shopData.products.forEach(p => {
      const qty = cart[p.id];
      if (qty) { count += qty; total += qty * parseFloat(p.price); }
    });
    return { count, total };
  }, [cart, shopData.products]);

  // Logica Sort
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredProducts = useMemo(() => {
    const s = search.toLowerCase();
    let result = shopData.products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(s) || p.producer.toLowerCase().includes(s);
      const matchCat = filterCat === 'ALL' || p.category === filterCat;
      const matchProd = filterProd === 'ALL' || p.producer === filterProd;
      return matchSearch && matchCat && matchProd;
    });

    result.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      if (sortConfig.key === 'price') {
         valA = parseFloat(valA);
         valB = parseFloat(valB);
      } else {
         valA = String(valA).toLowerCase();
         valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [shopData.products, search, filterCat, filterProd, sortConfig]);

  const categories = useMemo(() => [...new Set(shopData.products.map(p => p.category).filter(Boolean))].sort(), [shopData.products]);
  const producers = useMemo(() => [...new Set(shopData.products.map(p => p.producer).filter(Boolean))].sort(), [shopData.products]);

  const handleCheckout = async () => {
    setIsSubmitting(true);
    const gasId = activeProfile.context_id;
    try {
      const items = Object.entries(cart).map(([productId, qty]) => ({ productId: parseInt(productId), qty }));
      
      await axios.post(`${API_URL}/api/members/order`, { 
          cycleId: shopData.cycleId, 
          items,
          gasId
      });
      
      setToast({ type: 'success', message: t('member_shop.order_success') });
      clearCart();
      setIsCartOpen(false);
      setTimeout(() => navigate('/member/dashboard'), 1500);
    } catch (err) { 
      // GESTIONE ERRORE i18n
      const errorMsg = err.response?.data?.error;
      if (errorMsg === 'INSUFFICIENT_FUNDS') {
          setToast({ type: 'error', message: t('member_shop.error_insufficient_funds') });
      } else {
          setToast({ type: 'error', message: t('common.error') });
      }
    } finally { 
      setIsSubmitting(false); 
    }
  };

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-emerald-600" size={40}/></div>;

  return (
    <div className="pb-24 relative min-h-full">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER + FILTRI */}
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur py-2 px-1 space-y-2 mb-4 border-b border-slate-200 shadow-sm">
         {!shopData.isOpen && (
             <div className="bg-orange-100 text-orange-800 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 mb-2 border border-orange-200">
                 <Ban size={14}/> {t('member_shop.label_unavailable')}
             </div>
         )}
         
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
            <input type="text" placeholder={t('common.search')} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-medium shadow-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-xl border transition-colors ${showFilters ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}><Filter size={20} /></button>
          <div className="flex bg-white border border-slate-200 rounded-xl p-1">
             <button onClick={() => setViewMode('GRID')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400'}`}><LayoutGrid size={18}/></button>
             <button onClick={() => setViewMode('TABLE')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400'}`}><List size={18}/></button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
            <select className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none" value={filterCat} onChange={e => setFilterCat(e.target.value)}><option value="ALL">Tutte le Categorie</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none" value={filterProd} onChange={e => setFilterProd(e.target.value)}><option value="ALL">Tutti i Produttori</option>{producers.map(p => <option key={p} value={p}>{p}</option>)}</select>
          </div>
        )}
      </div>

      {/* RENDER PRODOTTI */}
      {viewMode === 'GRID' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(p => {
            const qty = cart[p.id] || 0;
            return (
              <Card key={p.id} className="p-4 flex flex-col justify-between border-slate-100 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{p.category}</span>
                    <h3 className="font-bold text-slate-800 leading-tight mb-1 mt-1">{p.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1"><Store size={10}/> {p.producer}</p>
                  </div>
                  <div className="text-right">
                    <span className="block font-black text-emerald-600 text-lg">{parseFloat(p.price).toFixed(2)}€</span>
                    <span className="text-[10px] text-slate-400 font-medium">/{p.unit}</span>
                  </div>
                </div>
                <div className="mt-auto pt-2 flex items-center justify-between border-t border-slate-50">
                   {shopData.isOpen ? (
                       qty > 0 ? (
                         <div className="flex items-center bg-emerald-50 rounded-xl p-1 gap-3 shadow-inner">
                            <button onClick={() => updateQty(p.id, -1, p.stock)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow text-emerald-700"><Minus size={16}/></button>
                            <span className="font-black text-emerald-800 w-6 text-center">{qty}</span>
                            <button onClick={() => updateQty(p.id, 1, p.stock)} className="w-8 h-8 flex items-center justify-center bg-emerald-600 rounded-lg shadow text-white"><Plus size={16}/></button>
                         </div>
                       ) : (
                         <Button onClick={() => updateQty(p.id, 1, p.stock)} variant="outline" className="w-full border-slate-200 text-slate-600 hover:text-emerald-600 font-bold">{t('member_shop.btn_add')}</Button>
                       )
                   ) : (
                       <div className="w-full text-center text-xs text-slate-400 italic py-2 bg-slate-50 rounded-lg">{t('member_shop.label_unavailable')}</div>
                   )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest cursor-pointer select-none">
                        <tr>
                            <th className="p-3 hover:text-emerald-600" onClick={() => handleSort('name')}>
                                <div className="flex items-center gap-1">Prodotto <ArrowUpDown size={10}/></div>
                            </th>
                            <th className="p-3 hover:text-emerald-600" onClick={() => handleSort('producer')}>
                                <div className="flex items-center gap-1">Produttore <ArrowUpDown size={10}/></div>
                            </th>
                            <th className="p-3 text-right hover:text-emerald-600" onClick={() => handleSort('price')}>
                                <div className="flex items-center justify-end gap-1">Prezzo <ArrowUpDown size={10}/></div>
                            </th>
                            <th className="p-3 text-center">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map(p => {
                            const qty = cart[p.id] || 0;
                            return (
                                <tr key={p.id}>
                                    <td className="p-3 font-bold text-slate-700">{p.name}<br/><span className="text-[10px] text-slate-400 font-normal">{p.category}</span></td>
                                    <td className="p-3 text-xs text-slate-500">{p.producer}</td>
                                    <td className="p-3 text-right font-mono text-emerald-600 font-bold">{parseFloat(p.price).toFixed(2)}€<br/><span className="text-[9px] text-slate-400">/{p.unit}</span></td>
                                    <td className="p-3 text-center w-32">
                                        {shopData.isOpen ? (
                                            qty > 0 ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => updateQty(p.id, -1, p.stock)} className="w-6 h-6 bg-slate-100 rounded text-slate-600"><Minus size={12}/></button>
                                                    <span className="font-bold text-sm w-4">{qty}</span>
                                                    <button onClick={() => updateQty(p.id, 1, p.stock)} className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded"><Plus size={12}/></button>
                                                </div>
                                            ) : <button onClick={() => updateQty(p.id, 1, p.stock)} className="text-emerald-600 text-xs font-bold border border-emerald-200 px-2 py-1 rounded hover:bg-emerald-50">{t('member_shop.btn_add')}</button>
                                        ) : <span className="text-[10px] text-slate-300 italic">{t('member_shop.label_unavailable')}</span>}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* FLOATING CART */}
      {cartTotalInfo.count > 0 && shopData.isOpen && !isCartOpen && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-8 md:w-96 z-30 animate-in slide-in-from-bottom-4">
          <div onClick={() => setIsCartOpen(true)} className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between cursor-pointer border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500 text-white w-10 h-10 rounded-xl flex items-center justify-center font-black">{cartTotalInfo.count}</div>
              <div className="flex flex-col"><span className="text-xs text-slate-400 font-bold uppercase">{t('common.total')}</span><span className="font-bold text-lg leading-none">{cartTotalInfo.total.toFixed(2)} €</span></div>
            </div>
            <div className="flex items-center gap-2 font-bold text-sm bg-white/10 px-3 py-1.5 rounded-lg">Vedi <ShoppingCart size={16} /></div>
          </div>
        </div>
      )}

      {/* CART MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 md:bg-black/50 md:backdrop-blur-sm md:items-center md:justify-center">
          <div className="flex-1 bg-white md:max-w-lg md:w-full md:flex-none md:rounded-3xl md:h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><ShoppingCart className="text-emerald-600" /> Carrello</h2><button onClick={() => setIsCartOpen(false)}><X size={24}/></button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {Object.entries(cart).map(([id, qty]) => {
                const product = shopData.products.find(p => p.id === parseInt(id));
                if (!product) return null;
                return (
                  <div key={id} className="flex justify-between items-center bg-white border border-slate-100 p-3 rounded-xl shadow-sm">
                    <div className="flex-1"><p className="font-bold text-slate-800 text-sm">{product.name}</p><p className="text-xs text-emerald-600 font-bold">{parseFloat(product.price).toFixed(2)}€ / {product.unit}</p></div>
                    <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1">
                       <button onClick={() => updateQty(product.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm"><Minus size={16}/></button>
                       <span className="font-bold w-4 text-center text-sm">{qty}</span>
                       <button onClick={() => updateQty(product.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm"><Plus size={16}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-6 bg-slate-900 text-white border-t border-slate-800">
               <div className="flex justify-between items-end mb-6"><div><p className="text-slate-400 text-xs font-bold uppercase mb-1">{t('common.total')}</p><p className="text-3xl font-black">{cartTotalInfo.total.toFixed(2)} €</p></div></div>
               <div className="flex gap-3"><Button variant="secondary" className="flex-1 bg-slate-700 border-none" onClick={() => { if(window.confirm(t('member_shop.confirm_empty'))) clearCart(); }}><Trash2 size={18} /></Button><Button className="flex-[2] bg-emerald-500 hover:bg-emerald-400 border-none text-lg font-bold" onClick={handleCheckout} disabled={cartTotalInfo.count === 0 || isSubmitting} isLoading={isSubmitting}>{t('common.confirm_title') || 'CONFERMA ORDINE'}</Button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};