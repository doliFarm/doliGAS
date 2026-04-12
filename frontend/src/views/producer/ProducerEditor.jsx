/**
 * @file frontend/src/views/producer/ProducerEditor.jsx
 * @version v1.0.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Price List Editor. Interface for producers to update prices and stock availability during the "List Open" (G1) phase.
 * @status Stable
 * @date 2026-01-16
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Save, Search, Plus, Edit2, Trash2, Lock, 
  DollarSign, Package, Layers, Loader2, Info,
  CheckCircle2, AlertTriangle, MessageSquare 
} from 'lucide-react';
import { Card, Button, Toast, Modal } from '../../components/ui-kit';
import { ProducerProductForm } from './ProducerProductForm';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export const ProducerEditor = () => {
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const { t } = useTranslation();
  const { activeProfile } = useAuth();
  // Stati UI
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false); // Bulk Save
  const [changes, setChanges] = useState({}); // Bulk Changes
  const [toast, setToast] = useState(null);
  
  // Stati Modale CRUD
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null = new
  const [modalLoading, setModalLoading] = useState(false);

  // Stati validazione listino 
  const [isValidated, setIsValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [cycleId, setCycleId] = useState(null); // Necessario per la validazione

  // --- FETCH DATI ---
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/products');
      
      // MAPPIAMO I DATI DAL BACKEND
      setProducts(res.data.products || []);
      setUnits(res.data.units || []);
      setCategories(res.data.categories || []);
      
      // IMPORTANTE: Questi tre devono esserci per far apparire il bottone
      setIsLocked(res.data.isListLocked || false);
      setIsValidated(res.data.isValidated || false);
      setCycleId(res.data.cycleId || null);
      
      setChanges({});
    } catch (err) {
      setToast({ type: 'error', message: 'Errore caricamento listino' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- BULK EDITOR LOGIC ---
  const handleChange = (id, field, value) => {
    if (isLocked) return;
    setChanges(prev => ({
      ...prev,
      [id]: { 
        ...(prev[id] || products.find(p => p.id === id)), 
        [field]: value 
      }
    }));
  };

  const handleBulkSave = async () => {
    if (isLocked) return;
/* richiesta conferma se già validato
    if (isValidated) {
        if (!window.confirm(t('producer_dash.editor.warn_revoke', "Attenzione: salvando queste modifiche, il listino perderà lo stato di 'Validato' e dovrai confermarlo nuovamente. Vuoi procedere?"))) {
            return;
        }
    } */
    setSaving(true);
    const itemsToUpdate = Object.values(changes).map(p => ({
      id: p.id,
      price: parseFloat(p.price),
      stock: p.stock === '' ? null : parseInt(p.stock),
      min_order_qty: parseInt(p.min_order_qty) || 1,
      is_active: p.is_active
    }));

    try {
      await axios.put('/api/products/bulk', { items: itemsToUpdate });
      setToast({ type: 'success', message: 'Prezzi e disponibilità aggiornati!' });
      fetchData();
    } catch (err) {
      setToast({ type: 'error', message: 'Errore salvataggio massivo' });
    } finally {
      setSaving(false);
    }
  };

  // --- CRUD LOGIC ---
  const handleCreateClick = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  const handleEditClick = (product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleDeleteClick = async (id) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo prodotto? Se è già stato ordinato in passato, verrà solo archiviato.")) return;
    
    try {
        await axios.delete(`/api/products/${id}`);
        setToast({ type: 'success', message: 'Prodotto eliminato/archiviato.' });
        fetchData();
    } catch (err) {
        setToast({ type: 'error', message: 'Errore eliminazione prodotto' });
    }
  };

  const handleModalSave = async (formData) => {
    setModalLoading(true);
    try {
        if (editingProduct) {
            // Edit
            await axios.put(`/api/products/${editingProduct.id}`, formData);
            setToast({ type: 'success', message: 'Scheda aggiornata!' });
        } else {
            // Create
            await axios.post('/api/products', formData);
            setToast({ type: 'success', message: 'Prodotto creato!' });
        }
        setShowModal(false);
        fetchData();
    } catch (err) {
        setToast({ type: 'error', message: 'Errore salvataggio scheda.' });
    } finally {
        setModalLoading(false);
    }
  };

  const handleValidate = async () => {
    if (isLocked || validating || !cycleId) return;
    
    // Controllo di sicurezza aggiuntivo
    if (!activeProfile?.context_id) {
        setToast({ type: 'error', message: 'Errore: ID Produttore mancante' });
        return;
    }

    setValidating(true);
    try {
      await axios.post('/api/products/validate-list', {
        producerId: activeProfile.context_id, // <-- MODIFICATO: Ora passiamo l'ID reale
        cycleId: cycleId
      });
      
      setIsValidated(true);
      setToast({ type: 'success', message: t('producer_dash.editor.validation_ok', 'Listino validato correttamente!') });
    } catch (err) {
      console.error("Errore validazione API:", err);
      setToast({ type: 'error', message: t('producer_dash.editor.validation_error', 'Errore durante la validazione') });
    } finally {
      setValidating(false);
    }
  };

  // --- PREPARAZIONE DATI PER IL RENDER ---
  const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const changesCount = Object.keys(changes).length;

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-amber-500" /></div>;

  return (
    <div className="pb-24 space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* =========================================================
          1. HEADER FISSO (Ricerca, Valida, Nuovo, Salva Massivo) 
          ========================================================= */}
      <div className="sticky top-0 bg-slate-50/95 backdrop-blur z-20 py-3 space-y-3 border-b border-slate-200 px-1">
        
        {isLocked && (
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold border border-red-100">
                <Lock size={14}/> {t('producer_dash.editor.list_locked', 'LISTINO CHIUSO')}
            </div>
        )}

        {/* RIGA A: Ricerca + Azioni (Flex Layout) */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                <input 
                    type="text" 
                    placeholder={t('producer_dash.editor.search_placeholder', 'Cerca...')}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-medium text-sm bg-white shadow-sm transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="hidden sm:block flex-1"></div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {!isLocked && cycleId && (
                    <button 
                      onClick={handleValidate}
                      disabled={isValidated || validating}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border shadow-sm h-10 ${
                        isValidated 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                          : 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700 shadow-amber-200 active:scale-95'
                      }`}
                    >
                      {validating ? <Loader2 size={14} className="animate-spin"/> : (isValidated ? <CheckCircle2 size={14}/> : <AlertTriangle size={14}/>)}
                      <span>{isValidated ? t('producer_dash.editor.btn_validated', 'Validato') : t('producer_dash.editor.btn_validate', 'Valida Listino')}</span>
                    </button>
                )}

                {!isLocked && (
                    <Button onClick={handleCreateClick} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-4 flex items-center gap-2 rounded-xl shadow-md active:scale-95 transition-all">
                        <Plus size={18}/>
                        <span className="font-black text-[10px] uppercase tracking-widest">{t('producer_dash.editor.btn_new_product', 'Nuovo Prodotto')}</span>
                    </Button>
                )}
            </div>
        </div>

        {/* RIGA B: Bottone Salvataggio Massivo */}
        {!isLocked && (
            <Button 
              onClick={handleBulkSave} 
              disabled={changesCount === 0 || saving} 
              className={`w-full font-bold shadow-lg h-11 transition-all rounded-xl ${
                changesCount > 0 
                  ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-100' 
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}
            >
              {saving ? <Loader2 className="animate-spin mr-2" size={18}/> : <Save className="mr-2" size={18}/>}
              {changesCount > 0 
                ? `${t('producer_dash.editor.btn_save_changes', 'SALVA MODIFICHE')} (${changesCount})` 
                : t('producer_dash.editor.no_changes', 'NESSUNA MODIFICA RILEVATA')}
            </Button>
        )}
      </div>

      {/* =========================================================
          2. LISTA PRODOTTI (Ciclo Unico)
          ========================================================= */}
      <div className="space-y-4 px-1">
        {filtered.map(p => {
          const current = changes[p.id] || p;
          return (
            <Card key={p.id} className={`p-4 border-l-4 ${current.is_active ? 'border-l-emerald-500' : 'border-l-slate-300 opacity-75'} relative`}>
              
              {/* Intestazione singola Card */}
              <div className="flex justify-between items-start mb-3">
                <div className="pr-16">
                  <h3 className="font-bold text-slate-800">{p.name}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{p.unit}</span>
                    {p.category_name && <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded">{p.category_name}</span>}
                  </div>
                </div>
                
                {/* Bottoni Edit/Delete singola Card */}
                {!isLocked && (
                    <div className="absolute top-4 right-4 flex gap-1">
                        <button onClick={() => handleEditClick(p)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                            <Edit2 size={16}/>
                        </button>
                        <button onClick={() => handleDeleteClick(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={16}/>
                        </button>
                    </div>
                )}
              </div>

              {/* Form campi massivi singola Card */}
              <div className="grid grid-cols-4 gap-2 items-end">
                <div className="col-span-1 text-center">
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Prezzo</label>
                  <input type="number" step="0.01" disabled={isLocked} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-700 outline-none text-sm focus:border-amber-500" value={current.price} onChange={e => handleChange(p.id, 'price', e.target.value)} />
                </div>
                <div className="col-span-1 text-center">
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Disp.</label>
                  <input type="number" disabled={isLocked} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-700 outline-none text-sm focus:border-amber-500" value={current.stock === null ? '' : current.stock} onChange={e => handleChange(p.id, 'stock', e.target.value)} />
                </div>
                <div className="col-span-1 text-center">
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Min.</label>
                  <input type="number" min="1" disabled={isLocked} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-700 outline-none text-sm focus:border-amber-500" value={current.min_order_qty} onChange={e => handleChange(p.id, 'min_order_qty', e.target.value)} />
                </div>
                <div className="col-span-1 flex justify-center pb-1">
                    <label className="flex flex-col items-center cursor-pointer">
                        <span className="text-[9px] font-black text-slate-400 uppercase mb-1">{current.is_active ? 'ON' : 'OFF'}</span>
                        <input type="checkbox" disabled={isLocked} className="w-6 h-6 rounded text-amber-600 focus:ring-amber-500 border-slate-300" checked={!!current.is_active} onChange={e => handleChange(p.id, 'is_active', e.target.checked)} />
                    </label>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* =========================================================
          3. MODALE EDIT/CREATE
          ========================================================= */}
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title={editingProduct ? t('producer_dash.editor.edit_title', "Modifica Scheda") : t('producer_dash.editor.new_title', "Nuovo Prodotto")}
      >
        <div className="p-4">
            <ProducerProductForm 
                product={editingProduct}
                units={units}
                categories={categories}
                onSave={handleModalSave}
                onCancel={() => setShowModal(false)}
                loading={modalLoading}
            />
        </div>
      </Modal>

    </div>
  );
};