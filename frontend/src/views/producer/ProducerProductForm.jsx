/**
 * @file frontend/src/views/producer/ProducerProductForm.jsx
 * @version v1.1.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Form di dettaglio prodotto per il produttore.
 * FIX: Ripristinato campo stato e impostato default "Attivo" per i nuovi inserimenti.
 * @status Integro, Completo, Robusto.
 * @date 2026-02-24
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Package, Tag, DollarSign, Layers, 
  CheckCircle2, Ban, AlertCircle, Info 
} from 'lucide-react';
import { Input, Select, Button } from '../../components/ui-kit';

export const ProducerProductForm = ({ product, units, categories, onSave, onCancel, loading }) => {
  const { t } = useTranslation();

  // --- INIZIALIZZAZIONE STATO ---
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    unit_id: '',
    price: '',
    stock: '',
    min_order_qty: 1,
    is_active: true // DEFAULT: Attivo per i nuovi prodotti
  });

  // --- SYNC DATI (Edit Mode) ---
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        category_id: product.category_id || '',
        unit_id: product.unit_id || '',
        price: product.price || '',
        stock: product.stock === null ? '' : product.stock,
        min_order_qty: product.min_order_qty || 1,
        is_active: product.is_active === undefined ? true : !!product.is_active
      });
    }
  }, [product]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 font-sans">
      
      {/* 1. ANAGRAFICA BASE */}
      <div className="space-y-4">
        <Input 
          label="Nome Prodotto" 
          placeholder="Es: Arance Navel, Pane di Altamura..."
          icon={Package}
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Select 
            label="Categoria"
            value={formData.category_id}
            onChange={e => setFormData({...formData, category_id: e.target.value})}
            required
          >
            <option value="">Seleziona...</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </Select>

          <Select 
            label="Unità di Misura"
            value={formData.unit_id}
            onChange={e => setFormData({...formData, unit_id: e.target.value})}
            required
          >
            <option value="">Seleziona...</option>
            {units.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
            ))}
          </Select>
        </div>
      </div>

      {/* 2. PREZZI E DISPONIBILITÀ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <Input 
          label="Prezzo (€)" 
          type="number" 
          step="0.01"
          placeholder="0.00"
          value={formData.price}
          onChange={e => setFormData({...formData, price: e.target.value})}
          required
        />
        <Input 
          label="Giacenza" 
          type="number" 
          placeholder="∞"
          value={formData.stock}
          onChange={e => setFormData({...formData, stock: e.target.value})}
        />
        <Input 
          label="Ordine Min." 
          type="number" 
          min="1"
          value={formData.min_order_qty}
          onChange={e => setFormData({...formData, min_order_qty: e.target.value})}
        />
      </div>

      {/* 3. STATO PRODOTTO (CHIRURGIA: RIPRISTINATO) */}
      <div className="p-4 rounded-2xl border-2 border-indigo-50 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${formData.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              {formData.is_active ? <CheckCircle2 size={20}/> : <Ban size={20}/>}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Disponibilità a Listino</p>
              <p className="text-[10px] text-slate-400 italic">
                {formData.is_active 
                  ? "Il prodotto sarà visibile e ordinabile dai soci." 
                  : "Il prodotto sarà nascosto nel catalogo soci."}
              </p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={() => setFormData({...formData, is_active: !formData.is_active})}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${formData.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* 4. AZIONI FORM */}
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel} 
          className="flex-1"
          disabled={loading}
        >
          {t('common.cancel')}
        </Button>
        <Button 
          type="submit" 
          className="flex-1 bg-indigo-600 text-white shadow-lg shadow-indigo-100 font-black uppercase tracking-widest"
          isLoading={loading}
        >
          {product ? "Aggiorna" : "Crea Prodotto"}
        </Button>
      </div>
    </form>
  );
};