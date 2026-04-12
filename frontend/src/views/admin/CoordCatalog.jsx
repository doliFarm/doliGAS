/**
 * @file frontend/src/views/admin/CoordCatalog.jsx
 * @version v1.4.5
 * @author Luigi GRILLO @ doliFarm.com
 * @description Catalogo Globale Coordinatore. Gestione articoli, categorie e import CSV. 
 * FIX: Ordinamento colonne (Stock, Min Qty, Stato, Prezzo), rimozione decimali Min Qty.
 * STATUS: Integro, Completo, Robusto.
 * @date 2026-02-28
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { 
    Package, Plus, Edit, UploadCloud, Check, AlertTriangle, 
    Loader2, X, HelpCircle, ArrowUpDown, Search, Tractor, Tag, Ruler, 
    Info, CheckSquare, Trash2, Ban, CheckCircle, XCircle, Square,
    Layers, ArrowDown 
} from 'lucide-react';
import { Card, Button, Input, Select, Badge, Toast, Modal } from '../../components/ui-kit';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

export const CoordCatalog = () => {
    const { activeProfile } = useAuth();
    const { t } = useTranslation();
    
    // --- STATE DATI ---
    const [products, setProducts] = useState([]);
    const [producers, setProducers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [units, setUnits] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    // --- STATE SELEZIONE & BULK ---
    const [selectedIds, setSelectedIds] = useState([]);
    const [isBulkOperating, setIsBulkOperating] = useState(false);

    // --- STATE FILTRI & ORDINAMENTO ---
    const [filters, setFilters] = useState({ name: '', producer: '', category: '', validationStatus: 'all' });
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    // --- STATE MODALI ---
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({ 
        name: '', unit_id: '', price: '', producer_id: '', category_id: '', 
        stock: '', min_order_qty: 1, is_active: true 
    });
    
    // --- STATE CSV ---
    const fileInputRef = useRef(null);
    const [dragActive, setDragActive] = useState(false);
    const [importReport, setImportReport] = useState(null);
    const [importing, setImporting] = useState(false);

    // --- FETCH DATI ---
    const fetchData = async () => {
        if (!activeProfile?.context_id) return;
        setLoading(true);
        const gasId = activeProfile.context_id;

        try {
            const token = localStorage.getItem('doliGAS_token');
            const headers = { Authorization: `Bearer ${token}` };
            
            const [prodRes, prodrsRes, catRes, unitRes] = await Promise.all([
                axios.get(`${API_URL}/api/admin/catalog?gasId=${gasId}`, { headers }),
                axios.get(`${API_URL}/api/admin/producers?gasId=${gasId}`, { headers }),
                axios.get(`${API_URL}/api/admin/catalog/categories?gasId=${gasId}`, { headers }),
                axios.get(`${API_URL}/api/admin/catalog/units?gasId=${gasId}`, { headers })
            ]);
            setProducts(prodRes.data);
            setProducers(prodrsRes.data);
            setCategories(catRes.data);
            setUnits(unitRes.data);
            setSelectedIds([]); 
        } catch (err) { 
            setToast({ message: t('admin_catalog.error_loading'), type: 'error' }); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { fetchData(); }, [activeProfile]);

    // --- FILTRAGGIO & ORDINAMENTO ROBUSTO ---
    const sortedAndFilteredProducts = useMemo(() => {
        let result = products.filter(p => {
            const matchName = (p.name || '').toLowerCase().includes(filters.name.toLowerCase());
            const matchProducer = (p.producer_name || '').toLowerCase().includes(filters.producer.toLowerCase());
            const matchCategory = (p.category_name || '').toLowerCase().includes(filters.category.toLowerCase());
            const isProdValidated = (p.is_validated === 1 || p.is_validated === '1' || p.is_validated === true);
            let matchValidation = true;
            if (filters.validationStatus === 'validated') {
                matchValidation = isProdValidated; // Mostra solo se true
            } else if (filters.validationStatus === 'pending') {
                matchValidation = !isProdValidated; // Mostra solo se false
            }
            return matchName && matchProducer && matchCategory && matchValidation;        });
        if (sortConfig.key) {
            result.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];

                // Gestione specifica per tipi numerici o nulli
                if (valA === null || valA === undefined) valA = -1;
                if (valB === null || valB === undefined) valB = -1;

                if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toString().toLowerCase();
                    return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                }

                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            });
        }
        return result;
    }, [products, filters, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    // --- AZIONI MASSIVE ---
    const handleBulkAction = async (action) => {
        if (selectedIds.length === 0) return;
        const gasId = activeProfile.context_id;
        const token = localStorage.getItem('doliGAS_token');
        const headers = { Authorization: `Bearer ${token}` };

        if (action === 'delete') {
            if (!window.confirm(t('common.confirm_delete_multiple'))) return;
        }

        setIsBulkOperating(true);
        try {
            if (action === 'delete') {
                for (const id of selectedIds) {
                    await axios.delete(`${API_URL}/api/admin/catalog/${id}?gasId=${gasId}`, { headers });
                }
                setToast({ message: t('common.deleted'), type: 'success' });
            } else {
                const status = action === 'activate' ? 1 : 0;
                await axios.patch(`${API_URL}/api/admin/catalog/bulk-status`, { 
                    ids: selectedIds, is_active: status, gasId: gasId 
                }, { headers });
                setToast({ message: t('common.saved'), type: 'success' });
            }
            fetchData();
        } catch (err) {
            setToast({ message: err.response?.data?.error || t('common.error'), type: 'error' });
        } finally {
            setIsBulkOperating(false);
        }
    };

    // --- CRUD HANDLERS ---
    const handleOpenProductModal = (product = null) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name, 
                unit_id: product.unit_id, 
                price: product.price,
                producer_id: product.producer_id, 
                category_id: product.category_id || '', 
                stock: product.stock !== null ? product.stock : '', 
                min_order_qty: Math.floor(product.min_order_qty || 1),
                is_active: product.is_active === 1
            });
        } else {
            setEditingProduct(null);
            setFormData({ name: '', unit_id: '', price: '', producer_id: '', category_id: '', stock: '', min_order_qty: 1, is_active: true });
        }
        setIsProductModalOpen(true);
    };

    const handleSaveProduct = async () => {
        if (!formData.name || !formData.producer_id || !formData.unit_id) {
            setToast({ message: t('admin_catalog.warning_select_producer_unit'), type: "warning" });
            return;
        }

        try {
            const token = localStorage.getItem('doliGAS_token');
            const payload = {
                id: editingProduct?.id,
                name: formData.name.trim(),
                producer_id: parseInt(formData.producer_id),
                unit_id: parseInt(formData.unit_id),
                category_id: formData.category_id ? parseInt(formData.category_id) : null,
                price: parseFloat(formData.price) || 0,
                stock: formData.stock === '' ? null : parseFloat(formData.stock), 
                min_order_qty: parseInt(formData.min_order_qty) || 1, // Garantisce intero
                is_active: formData.is_active ? 1 : 0,
                gasId: activeProfile.context_id 
            };

            await axios.post(`${API_URL}/api/admin/catalog/products`, payload, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            
            setToast({ message: t('common.saved'), type: 'success' });
            setIsProductModalOpen(false);
            fetchData();
        } catch (err) { 
            setToast({ message: err.response?.data?.error || t('common.error'), type: 'error' }); 
        }
    };

    // --- CSV IMPORT LOGIC ---
    const processFile = (file) => {
        if (!file.name.endsWith('.csv')) { setToast({ message: t('admin_catalog.error_invalid_file'), type: 'error' }); return; }
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const token = localStorage.getItem('doliGAS_token');
                const res = await axios.post(`${API_URL}/api/admin/catalog/validate`, { 
                    csvData: evt.target.result, gasId: activeProfile.context_id
                }, { headers: { Authorization: `Bearer ${token}` } });
                setImportReport(res.data);
            } catch (err) { setToast({ message: t('common.error'), type: 'error' }); }
        };
        reader.readAsText(file);
    };

    const handleExecuteImport = async () => {
        setImporting(true);
        try {
            const token = localStorage.getItem('doliGAS_token');
            await axios.post(`${API_URL}/api/admin/catalog/bulk-import`, { 
                products: importReport.validRows, gasId: activeProfile.context_id
            }, { headers: { Authorization: `Bearer ${token}` } });
            setToast({ message: t('common.success'), type: 'success' });
            setIsImportModalOpen(false);
            fetchData();
        } catch (err) { setToast({ message: t('common.error'), type: 'error' }); }
        finally { setImporting(false); }
    };

    if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-emerald-500" size={40}/></div>;

    return (
        <div className="max-w-screen-2xl mx-auto pb-24 px-2 sm:px-4 space-y-6 flex flex-col min-h-screen relative overflow-x-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 shrink-0">
                <div className="w-full lg:w-auto">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl"><Package size={24}/></div>
                        {t('admin_catalog.title')}
                    </h1>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                    <Button variant="outline" onClick={() => { setImportReport(null); setIsImportModalOpen(true); }} className="h-10 border-slate-200 uppercase text-[10px] font-black">
                        <UploadCloud size={16} className="mr-2"/> {t('admin_catalog.btn_import')}
                    </Button>
                    <Button onClick={() => handleOpenProductModal()} className="bg-emerald-600 shadow-md h-10 font-bold text-white uppercase text-[10px] font-black">
                        <Plus size={16} className="mr-1 sm:mr-2"/> {t('admin_catalog.btn_new')}
                    </Button>
                </div>
            </div>
            {/* SEARCH BAR (Ricerca, Filtri e Toggle Validazione Inline) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 shrink-0">
                
                {/* 1. Ricerca Prodotto */}
                <Input 
                    placeholder={t('admin_catalog.search_product', 'Cerca prodotto...')}
                    value={filters.name}
                    onChange={e => setFilters({...filters, name: e.target.value})}
                    icon={Search}
                    className="bg-slate-50 border-none h-11"
                />

                {/* 2. Ricerca Produttore + Toggle Validazione Integrati */}
                <div className="flex bg-slate-50 rounded-xl border border-transparent focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-200 transition-all h-11 overflow-hidden">
                    <div className="flex items-center pl-3 text-slate-400">
                        <Tractor size={16} />
                    </div>
                    <input 
                        type="text"
                        placeholder={t('admin_catalog.search_producer', 'Cerca produttore...')}
                        value={filters.producer}
                        onChange={e => setFilters({...filters, producer: e.target.value})}
                        className="flex-1 bg-transparent border-none focus:outline-none px-2 text-sm font-medium w-full min-w-0"
                    />
                    <div className="flex items-center px-1 border-l border-slate-200 gap-1 bg-slate-100/50">
                        <button 
                            onClick={() => setFilters({...filters, validationStatus: filters.validationStatus === 'validated' ? 'all' : 'validated'})}
                            className={`p-1.5 rounded-lg transition-all ${filters.validationStatus === 'validated' ? 'bg-emerald-100 text-emerald-600 scale-110 shadow-sm' : 'text-slate-300 hover:text-emerald-500 hover:bg-slate-200'}`}
                            title={t('admin_catalog.filter_validated', 'Mostra solo Validati')}
                        >
                            <CheckCircle size={16} strokeWidth={2.5}/>
                        </button>
                        <button 
                            onClick={() => setFilters({...filters, validationStatus: filters.validationStatus === 'pending' ? 'all' : 'pending'})}
                            className={`p-1.5 rounded-lg transition-all ${filters.validationStatus === 'pending' ? 'bg-amber-100 text-amber-600 scale-110 shadow-sm' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-200'}`}
                            title={t('admin_catalog.filter_pending', 'Mostra solo In Attesa')}
                        >
                            <AlertTriangle size={16} strokeWidth={2.5}/>
                        </button>
                    </div>
                </div>

                {/* 3. Filtro Categoria */}
                <div className="relative">
                    <Select 
                        value={filters.category}
                        onChange={e => setFilters({...filters, category: e.target.value})}
                        className="bg-slate-50 border-none h-11 pl-10"
                    >
                        <option value="">{t('admin_catalog.all_categories', 'Tutte le categorie')}</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                    </Select>
                    <Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* TABELLA CON ORDINAMENTO ATTIVO */}
            <Card className="flex-1 shadow-md bg-white border-none relative overflow-visible pb-16">
                <div className="overflow-x-auto">
                    <table className="w-full text-[11px] sm:text-sm text-left border-collapse">
                        <thead className="bg-slate-50 border-b">
                            <tr className="text-slate-400 uppercase text-[9px] font-black tracking-widest">
                                <th className="px-4 py-3 w-10 text-center">
                                    <button onClick={() => setSelectedIds(selectedIds.length === sortedAndFilteredProducts.length ? [] : sortedAndFilteredProducts.map(p => p.id))}>
                                        {selectedIds.length === sortedAndFilteredProducts.length && sortedAndFilteredProducts.length > 0 
                                            ? <CheckSquare className="text-emerald-600" size={18}/> 
                                            : <Square className="text-slate-300" size={18}/>}
                                    </button>
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:text-emerald-600" onClick={() => requestSort('name')}>
                                    <div className="flex items-center gap-1">{t('admin_catalog.col_product')} <ArrowUpDown size={12} className="opacity-40"/></div>
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:text-emerald-600" onClick={() => requestSort('producer_name')}>
                                    <div className="flex items-center gap-1">{t('admin_catalog.col_producer')} <ArrowUpDown size={12} className="opacity-40"/></div>
                                </th>
                                
                                {/* COLONNE ORDINABILI AGGIUNTE */}
                                <th className="px-4 py-3 hidden xl:table-cell text-center cursor-pointer hover:text-emerald-600" onClick={() => requestSort('stock')}>
                                    <div className="flex items-center justify-center gap-1">Giacenza <ArrowUpDown size={12} className="opacity-40"/></div>
                                </th>
                                <th className="px-4 py-3 hidden lg:table-cell text-center cursor-pointer hover:text-emerald-600" onClick={() => requestSort('min_order_qty')}>
                                    <div className="flex items-center justify-center gap-1">Ord. Min. <ArrowUpDown size={12} className="opacity-40"/></div>
                                </th>
                                <th className="px-4 py-3 text-center cursor-pointer hover:text-emerald-600" onClick={() => requestSort('is_active')}>
                                    <div className="flex items-center justify-center gap-1">{t('common.status')} <ArrowUpDown size={12} className="opacity-40"/></div>
                                </th>
                                <th className="px-4 py-3 text-right cursor-pointer hover:text-emerald-600" onClick={() => requestSort('price')}>
                                    <div className="flex items-center justify-end gap-1">{t('admin_catalog.col_price')} <ArrowUpDown size={12} className="opacity-40"/></div>
                                </th>
                                
                                <th className="px-4 py-3 text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white">
                            {sortedAndFilteredProducts.map(p => (
                                <tr key={p.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.includes(p.id) ? 'bg-indigo-50/30' : ''}`}>
                                    <td className="px-4 py-4 text-center cursor-pointer" onClick={() => setSelectedIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}>
                                        {selectedIds.includes(p.id) ? <CheckSquare className="text-indigo-600" size={18}/> : <Square className="text-slate-200" size={18}/>}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700">{p.name}</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">{p.unit_symbol} • {p.category_name || 'Generico'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-700 uppercase">{p.producer_name}</span>
                                            {p.is_validated ? (
                                                <div 
                                                title={t('admin_catalog.status_validated', 'Listino Validato')} 
                                                className="p-1 rounded-full bg-emerald-100 text-emerald-600 shadow-sm"
                                                >
                                                    <CheckCircle size={14} strokeWidth={3}/>
                                                </div>
                                            ) : (
                                                <div 
                                                title={t('admin_catalog.status_pending', 'In attesa di validazione')} 
                                                className="p-1 rounded-full bg-amber-100 text-amber-600 shadow-sm animate-pulse"
                                                >
                                                    <AlertTriangle size={14} strokeWidth={3}/>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    
                                    <td className="px-4 py-4 hidden xl:table-cell text-center">
                                        {p.stock !== null ? (
                                            <Badge color={p.stock <= 5 ? 'red' : 'slate'} className="font-mono">{p.stock}</Badge>
                                        ) : (
                                            <span className="text-slate-300 text-lg">∞</span>
                                        )}
                                    </td>

                                    <td className="px-4 py-4 hidden lg:table-cell text-center font-medium text-slate-500">
                                        {Math.floor(p.min_order_qty || 1)} <span className="text-[9px] uppercase">{p.unit_symbol}</span>
                                    </td>

                                    <td className="px-4 py-4 text-center">
                                        <div className={`h-3 w-3 rounded-full shadow-sm mx-auto ${p.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    </td>
                                    <td className="px-4 py-4 text-right font-mono font-black text-slate-800">€ {Number(p.price).toFixed(2)}</td>
                                    <td className="px-4 py-4 text-right whitespace-nowrap">
                                        <button onClick={() => handleOpenProductModal(p)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Edit size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* BARRA AZIONI MASSIVE */}
                {selectedIds.length > 0 && (
                    <div className="fixed bottom-20 lg:bottom-10 left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-max bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between lg:gap-8 z-50 border border-slate-700 animate-in slide-in-from-bottom-10">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-500 text-white px-2 py-0.5 rounded-md text-[10px] font-black">{selectedIds.length}</div>
                            <span className="hidden sm:inline font-bold text-xs uppercase tracking-wider text-slate-400">{t('common.selected')}</span>
                        </div>
                        <div className="flex gap-1 items-center border-l border-slate-700 pl-4">
                            <button onClick={() => handleBulkAction('activate')} className="p-2 lg:px-4 lg:py-2 rounded-xl hover:bg-slate-800 text-emerald-400 flex items-center gap-2 transition-all">
                                <CheckCircle size={18}/> <span className="hidden lg:inline text-[10px] font-black uppercase">{t('common.activate')}</span>
                            </button>
                            <button onClick={() => handleBulkAction('deactivate')} className="p-2 lg:px-4 lg:py-2 rounded-xl hover:bg-slate-800 text-orange-400 flex items-center gap-2 transition-all">
                                <Ban size={18}/> <span className="hidden lg:inline text-[10px] font-black uppercase">{t('common.deactivate')}</span>
                            </button>
                            <button onClick={() => handleBulkAction('delete')} className="p-2 lg:px-4 lg:py-2 rounded-xl hover:bg-slate-800 text-red-400 flex items-center gap-2 transition-all">
                                <Trash2 size={18}/> <span className="hidden lg:inline text-[10px] font-black uppercase">{t('common.delete')}</span>
                            </button>
                        </div>
                        <button onClick={() => setSelectedIds([])} className="p-2 text-slate-500 hover:text-white transition-colors"><XCircle size={20}/></button>
                    </div>
                )}
            </Card>

            {/* MODALE CRUD */}
            <Modal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} title={editingProduct ? t('admin_catalog.modal_edit_title') : t('admin_catalog.modal_new_title')}>
                <div className="space-y-4">
                    <Input label={t('admin_catalog.field_name')} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Select label={t('admin_catalog.field_producer')} value={formData.producer_id} onChange={e => setFormData({...formData, producer_id: e.target.value})} required>
                            <option value="">{t('common.select')}...</option>
                            {producers.map(pr => <option key={pr.id} value={pr.id}>{pr.business_name}</option>)}
                        </Select>
                        <Select label={t('admin_catalog.field_unit')} value={formData.unit_id} onChange={e => setFormData({...formData, unit_id: e.target.value})} required>
                            <option value="">{t('common.select')}...</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.symbol} ({u.name})</option>)}
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input label={t('admin_catalog.field_price')} type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required />
                        <Select label={t('admin_catalog.field_category')} value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                            <option value="">{t('admin_catalog.no_category')}</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <Input 
                            label="Giacenza (Stock)" 
                            type="number" 
                            placeholder="∞ Illimitata" 
                            icon={Layers}
                            value={formData.stock} 
                            onChange={e => setFormData({...formData, stock: e.target.value})} 
                        />
                        <Input 
                            label="Min. Ordinabile" 
                            type="number" 
                            step="1" 
                            icon={ArrowDown}
                            value={formData.min_order_qty} 
                            onChange={e => setFormData({...formData, min_order_qty: e.target.value})} 
                        />
                    </div>

                    <div className="flex items-center gap-2 py-2">
                        <input type="checkbox" id="is_active_chk" className="w-4 h-4 text-emerald-600 rounded" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                        <label htmlFor="is_active_chk" className="text-xs font-bold text-slate-600 uppercase cursor-pointer">{t('common.active')}</label>
                    </div>

                    <div className="pt-4 flex gap-3 border-t">
                        <Button variant="outline" className="flex-1" onClick={() => setIsProductModalOpen(false)}>{t('common.cancel')}</Button>
                        <Button onClick={handleSaveProduct} className="flex-1 bg-indigo-600 text-white shadow-lg font-bold uppercase text-[10px] tracking-widest">
                            {t('common.save')}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* MODALE IMPORT CSV */}
            <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title={t('admin_catalog.modal_import_title')}>
                {!importReport ? (
                    <div className="space-y-6">
                        <div 
                            className={`p-12 border-2 border-dashed rounded-3xl text-center transition-all ${dragActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
                            onDragOver={(e)=>{e.preventDefault(); setDragActive(true);}}
                            onDragLeave={()=>setDragActive(false)}
                            onDrop={(e)=>{e.preventDefault(); setDragActive(false); processFile(e.dataTransfer.files[0]);}}
                        >
                            <UploadCloud size={48} className="mx-auto mb-4 text-slate-300" />
                            <p className="font-bold text-slate-600 mb-2">{t('admin_catalog.import_drag_label')}</p>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={(e)=>processFile(e.target.files[0])} />
                            <Button variant="outline" onClick={()=>fileInputRef.current.click()}>{t('common.search_file')}</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl text-center"><p className="text-2xl font-black">{importReport.summary.total}</p><p className="text-[10px] uppercase font-bold text-slate-400">{t('common.total')}</p></div>
                            <div className="p-4 bg-emerald-50 rounded-2xl text-center"><p className="text-2xl font-black text-emerald-600">{importReport.summary.valid}</p><p className="text-[10px] uppercase font-bold text-emerald-500">{t('common.valid')}</p></div>
                        </div>
                        <Button className="w-full bg-emerald-600 text-white font-bold" disabled={importing || importReport.summary.valid === 0} onClick={handleExecuteImport}>
                            {importing ? <Loader2 className="animate-spin"/> : <Check className="mr-2"/>} {t('common.confirm_import')}
                        </Button>
                    </div>
                )}
            </Modal>
        </div>
    );
};