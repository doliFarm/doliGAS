/**
 * @file frontend/src/views/admin/CoordCycles.jsx
 * @version v1.9.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Cycle Calendar & Management. Handles G1-G7 lifecycle, Market rules, 
 * Simulation engine, Repetitions, and Holiday conflict detection.
 * FIX: Header responsivo (bottone non esce), doppia scrollbar rimossa, date confermate in gg/mm/aaaa.
 * STATUS: Integro, Completo, Robusto.
 * @date 2026-02-28
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { 
  Calendar as CalIcon, Settings, Plus, Edit, Trash2, Loader2, 
  ChevronLeft, ChevronRight, List, Truck, Info, Palmtree, AlertTriangle,
  Mail, ShoppingBag, Package, CheckCircle, Clock, CheckSquare, Square, 
  AlertCircle, RefreshCw, HelpCircle, X, Play, Ban, Sliders, CalendarDays
} from 'lucide-react';
import { Card, Button, Input, Modal, Toast, Badge, Select } from '../../components/ui-kit';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

export const CoordCycles = () => {
  const { activeProfile } = useAuth(); 
  const { t, i18n } = useTranslation();

  // --- 1. STATI DATI ---
  const [cycles, setCycles] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('CALENDAR'); 
  const [currentDate, setCurrentDate] = useState(new Date());
  const [toast, setToast] = useState(null);
  const [gConfig, setGConfig] = useState({ g1: 10, g2: 8, g3: 7, g4: 2, g5: 2, g6: 1, g7: 0 });
  
  // --- 2. SELEZIONE & CONFIGURAZIONE ---
  const [selectedIds, setSelectedIds] = useState([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false); 
  const [simDate, setSimDate] = useState(new Date().toISOString().split('T')[0]);

  // --- 3. STATI MODALI ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState(null);
  const [formData, setFormData] = useState({
    name: '', start_at: '', producers_deadline: '', market_open_at: '', 
    market_close_at: '', orders_sent_at: '', confirmation_at: '', delivery_at: '',
    repeat_type: 'none', repeat_count: 1
  });

  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isHolidayDeleteConfirmOpen, setIsHolidayDeleteConfirmOpen] = useState(false); 
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [holidayFormData, setHolidayFormData] = useState({ name: '', holiday_date: '' });

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [conflictsInModal, setConflictsInModal] = useState([]);

  // --- 4. FORMATTAZIONE DATE ---

  /**
   * ROBUSTEZZA: Forza la visualizzazione gg/mm/aaaa hh:mm ignorando i bug del locale browser.
   * Utilizzata per etichette statiche e righe di conferma (Internazionalizzata).
   */
  const formatDT = (date, includeTime = true) => {
      if (!date) return '---';
      const d = new Date(date);
      if (isNaN(d.getTime())) return date;
      
      const options = {
        day: '2-digit', month: '2-digit', year: 'numeric',
        ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
      };
      // Usa la lingua corrente di i18n, default it-IT
      return new Intl.DateTimeFormat(i18n.language || 'it-IT', options).format(d);
  };

  /**
   * Converte una data in stringa ISO locale per gli input datetime-local (YYYY-MM-DDTHH:mm).
   * Risolve il problema dello slittamento orario di .toISOString().
   */
  const toLocalISO = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const offset = d.getTimezoneOffset() * 60000;
    return (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
  };

  const toDayKey = (d) => {
    if (!d) return null;
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // --- 5. FETCH DATI ---
  const fetchData = async () => {
    if (!activeProfile?.context_id) return;
    setLoading(true);
    const gasId = activeProfile.context_id;

    try {
      const [cycleRes, configRes, holidayRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/cycles/history?gasId=${gasId}`),
        axios.get(`${API_URL}/api/admin/cycles/schema?gasId=${gasId}`),
        axios.get(`${API_URL}/api/admin/cycles/holidays?gasId=${gasId}`)
      ]);
      setCycles(cycleRes.data || []);
      setHolidays(holidayRes.data || []);
      if(configRes.data && configRes.data.g1 !== undefined) setGConfig(configRes.data);
      setSelectedIds([]);
    } catch (err) { 
      setToast({ message: t('common.error_loading'), type: 'error' }); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, [activeProfile]);

  // --- 6. LOGICA DI BUSINESS & CALCOLO ---

  const checkSingleDateConflict = (dateValue) => {
    if (!dateValue) return false;
    const key = toDayKey(dateValue);
    return holidays.some(h => toDayKey(h.holiday_date) === key);
  };

  const getOffsetError = (key) => {
    const val = gConfig[key];
    const sequence = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
    const idx = sequence.indexOf(key);
    if (idx > 0 && val >= gConfig[sequence[idx - 1]]) return true;
    if (idx < sequence.length - 1 && val <= gConfig[sequence[idx + 1]]) return true;
    if (key === 'g6' && val <= 0) return true;
    return false;
  };

  const validateSequence = (data) => {
    const sequence = [
      { key: 'start_at', label: 'G1' },
      { key: 'producers_deadline', label: 'G2' },
      { key: 'market_open_at', label: 'G3' },
      { key: 'market_close_at', label: 'G4' },
      { key: 'orders_sent_at', label: 'G5' },
      { key: 'confirmation_at', label: 'G6' },
      { key: 'delivery_at', label: 'G7' }
    ];
    for (let i = 0; i < sequence.length - 1; i++) {
      const current = new Date(data[sequence[i].key]);
      const next = new Date(data[sequence[i+1].key]);
      if (current >= next) {
        setToast({ type: 'error', message: `Errore sequenza: ${sequence[i].label} deve precedere ${sequence[i+1].label}` });
        return false;
      }
    }
    return true;
  };

  const getSimulatedDateLabel = (key) => {
    if (!simDate) return '';
    const offsetVal = gConfig[key];
    const d = new Date(simDate);
    d.setDate(d.getDate() - offsetVal);
    return formatDT(d, false);
  };

  const calendarData = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    return {
      days: new Date(y, m + 1, 0).getDate(),
      offset: (new Date(y, m, 1).getDay() || 7) - 1,
      year: y,
      month: m
    };
  }, [currentDate]);

  // --- 7. HANDLERS CICLI ---

  const handleSaveForm = async () => {
    if (!validateSequence(formData)) return;
    const gasId = activeProfile.context_id;
    try {
      const method = editingCycle ? 'put' : 'post';
      const url = `${API_URL}/api/admin/cycles${editingCycle ? `/${editingCycle.id}` : ''}`;
      
      const payload = {
        ...formData,
        gasId,
        repeat_count: parseInt(formData.repeat_count) || 1
      };

      await axios[method](url, payload);
      setIsModalOpen(false); 
      fetchData();
      setToast({ message: t('common.saved'), type: 'success' });
    } catch (err) { 
      setToast({ message: t('common.error'), type: 'error' }); 
    }
  };

  const openCycleModal = (cycle, date = null) => {
    const sub = (d, n) => { 
      const x = new Date(d); 
      x.setDate(x.getDate() - n); 
      return toLocalISO(x); 
    };

    if (cycle) {
      setEditingCycle(cycle);
      setFormData({
        name: cycle.name, 
        start_at: toLocalISO(cycle.start_at), 
        producers_deadline: toLocalISO(cycle.producers_deadline),
        market_open_at: toLocalISO(cycle.market_open_at), 
        market_close_at: toLocalISO(cycle.market_close_at),
        orders_sent_at: toLocalISO(cycle.orders_sent_at), 
        confirmation_at: toLocalISO(cycle.confirmation_at), 
        delivery_at: toLocalISO(cycle.delivery_at), 
        repeat_type: 'none', 
        repeat_count: 1
      });
    } else {
      const d = new Date(date || new Date()); 
      d.setHours(18, 0, 0);
      setEditingCycle(null);
      setFormData({
        name: `Ciclo ${formatDT(d, false)}`, 
        delivery_at: toLocalISO(d),
        confirmation_at: sub(d, gConfig.g6), 
        orders_sent_at: sub(d, gConfig.g5),
        market_close_at: sub(d, gConfig.g4), 
        market_open_at: sub(d, gConfig.g3),
        producers_deadline: sub(d, gConfig.g2), 
        start_at: sub(d, gConfig.g1),
        repeat_type: 'none', 
        repeat_count: 1
      });
    }
    setIsModalOpen(true);
  };

  const handleBulkAction = async (action) => {
    if (selectedIds.length === 0) return;
    const gasId = activeProfile.context_id;
    if (action === 'delete' && !window.confirm(t('common.confirm_delete_multiple'))) return;
    
    try {
      if (action === 'delete') {
        await Promise.all(selectedIds.map(id => axios.delete(`${API_URL}/api/admin/cycles/${id}?gasId=${gasId}`)));
      } else {
        const isActive = action === 'activate' ? 1 : 0;
        await Promise.all(selectedIds.map(id => axios.patch(`${API_URL}/api/admin/cycles/${id}/status`, { is_active: isActive, gasId })));
      }
      setToast({ type: 'success', message: t('common.success') }); 
      fetchData();
    } catch (err) { 
      setToast({ type: 'error', message: t('common.error') }); 
    }
  };

  const handleDeleteCycle = async () => {
    if (!editingCycle) return;
    const gasId = activeProfile.context_id;
    try {
      await axios.delete(`${API_URL}/api/admin/cycles/${editingCycle.id}?gasId=${gasId}`);
      setToast({ message: t('common.deleted'), type: 'success' });
      setIsDeleteConfirmOpen(false); setIsModalOpen(false); fetchData();
    } catch (err) {
      setToast({ message: err.response?.data?.error || t('common.error'), type: 'error' });
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === cycles.length) setSelectedIds([]);
    else setSelectedIds(cycles.map(c => c.id));
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // --- 8. HANDLERS FESTIVITÀ & CONFIG SCHEMA ---
  const openHolidayModal = (h = null, date = null) => {
    if (h) {
      setEditingHoliday(h);
      setHolidayFormData({ name: h.name, holiday_date: toDayKey(h.holiday_date) });
    } else {
      setEditingHoliday(null);
      setHolidayFormData({ name: '', holiday_date: toDayKey(date || new Date()) });
    }
    setIsHolidayModalOpen(true);
  };

  const handleSaveHoliday = async () => {
    const gasId = activeProfile.context_id;
    try {
      await axios.post(`${API_URL}/api/admin/cycles/holidays`, { ...holidayFormData, id: editingHoliday?.id, gasId });
      setIsHolidayModalOpen(false); fetchData();
      setToast({ message: t('common.saved'), type: 'success' });
    } catch (err) { setToast({ message: t('common.error'), type: 'error' }); }
  };

  const handleExecuteDeleteHoliday = async () => {
    if (!editingHoliday) return;
    const gasId = activeProfile.context_id;
    try {
      await axios.delete(`${API_URL}/api/admin/cycles/holidays/${editingHoliday.id}?gasId=${gasId}`);
      setIsHolidayDeleteConfirmOpen(false); setIsHolidayModalOpen(false); fetchData();
      setToast({ message: t('common.deleted'), type: 'success' });
    } catch (err) { setToast({ message: t('common.error'), type: 'error' }); setIsHolidayDeleteConfirmOpen(false); }
  };

  const handleSaveSchema = async () => {
    const gasId = activeProfile.context_id;
    if (['g1','g2','g3','g4','g5','g6'].some(k => getOffsetError(k))) { 
        setToast({ type:'error', message: t('admin_cycles.error_sequence') }); 
        return; 
    }
    try { 
        await axios.put(`${API_URL}/api/admin/cycles/schema`, { ...gConfig, gasId }); 
        setToast({type:'success', message: t('common.saved')}); 
        fetchData(); 
    } catch { setToast({type:'error', message: t('common.error')}); }
  };

  // --- 9. RENDER COMPONENTI ---

const getEventsForDay = (day) => {
    if (viewMode !== 'CALENDAR') return [];
    const target = new Date(calendarData.year, calendarData.month, day).toDateString();
    const events = [];

    cycles.forEach(c => {
      const is = (d) => d && new Date(d).toDateString() === target;
      
      // Definiamo i nomi brevi delle fasi per risparmiare spazio
      const wrap = (gCode, phaseName, color, icon, helpKey) => ({ 
        // RISULTATO: "G2: Deadline | Ciclo Ortofrutta"
        label: `${gCode}: ${phaseName} | ${c.name}`, 
        color, 
        icon, 
        id: c.id, 
        raw: { 
          ...c, 
          currentStepLabel: `${gCode}: ${phaseName}`,
          currentStepDescription: t(`admin_cycles.${helpKey}`)
        } 
      });

      if (is(c.start_at)) events.push(wrap('G1', 'Apertura', 'bg-slate-100 text-slate-500', <Package size={10}/>, 'g1_desc'));
      if (is(c.producers_deadline)) events.push(wrap('G2', 'Deadline', 'bg-slate-50 text-slate-400', <Clock size={10}/>, 'g2_desc'));
      if (is(c.market_open_at)) events.push(wrap('G3', 'Bottega ON', 'bg-blue-100 text-blue-700', <ShoppingBag size={10}/>, 'g3_desc'));
      if (is(c.market_close_at)) events.push(wrap('G4', 'Bottega OFF', 'bg-red-50 text-red-700', <Info size={10}/>, 'g4_desc'));
      if (is(c.orders_sent_at)) events.push(wrap('G5', 'Invio', 'bg-orange-50 text-orange-600', <Mail size={10}/>, 'g5_desc'));
      if (is(c.confirmation_at)) events.push(wrap('G6', 'Merci', 'bg-orange-100 text-orange-700', <CheckCircle size={10}/>, 'g6_desc'));
      if (is(c.delivery_at)) events.push(wrap('G7', 'CONSEGNA', 'bg-emerald-500 text-white', <Truck size={10}/>, 'g7_desc'));
    });
    return events;
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500"/></div>;

  return (
    <div className="max-w-screen-2xl mx-auto pb-24 px-2 sm:px-4 space-y-6 flex flex-col min-h-screen relative font-sans">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* HEADER RESPONSIVE FIX
        Aggiunto flex-wrap e gestito flex-1 / w-full in modo da non far sbordare i bottoni
      */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 shrink-0">
        <div className="w-full lg:w-auto">
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
            <CalIcon className="text-indigo-600"/> {t('admin_cycles.title')}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 uppercase font-bold tracking-widest opacity-60">
            {activeProfile?.context_name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200 shadow-inner flex-1 sm:flex-none">
            <button onClick={() => setViewMode('CALENDAR')} className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'CALENDAR' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>{t('admin_cycles.view_calendar')}</button>
            <button onClick={() => setViewMode('LIST')} className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'LIST' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>{t('admin_cycles.view_list')}</button>
            <button onClick={() => setViewMode('HOLIDAYS')} className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'HOLIDAYS' ? 'bg-white shadow text-orange-600' : 'text-slate-500'}`}>{t('admin_cycles.view_holidays')}</button>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={() => setIsConfigOpen(!isConfigOpen)} variant="outline" className={`flex-1 sm:flex-none h-10 sm:h-11 border-slate-200 font-bold transition-all ${isConfigOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : ''}`}>
              <Sliders size={18} className="sm:mr-2 mx-auto"/> <span className="hidden sm:inline">{t('admin_cycles.btn_config')}</span>
            </Button>
            <Button onClick={() => openCycleModal(null)} className="flex-1 sm:flex-none bg-indigo-600 text-white shadow-lg font-black h-10 sm:h-11 uppercase tracking-wider">
              <Plus size={18} className="mr-1"/> {t('admin_cycles.btn_new')}
            </Button>
          </div>
        </div>
      </div>

      {/* --- TOOLBAR DI SIMULAZIONE E CONFIGURAZIONE --- */}
      {isConfigOpen && (
        <Card className="p-5 bg-white border-none shadow-xl border border-slate-100 shrink-0 overflow-visible animate-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col xl:flex-row items-stretch gap-8">
            <div className="flex flex-col justify-center border-r border-slate-100 pr-6 w-full xl:w-[220px]">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Play size={12} fill="currentColor" className="text-indigo-500"/>
                {t('admin_cycles.simulation_header') || "SIMULAZIONE"}
                </h4>
                <div className="space-y-2">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter ml-1">Simula Consegna (G7):</span>
                    <input type="date" className="w-full p-2 rounded-xl bg-slate-50 border-2 border-slate-100 text-[11px] font-black text-indigo-600 focus:border-indigo-400 outline-none transition-all shadow-inner" value={simDate} onChange={(e) => setSimDate(e.target.value)} />
                </div>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {['g1','g2','g3','g4','g5','g6'].map(k => {
                const hasErr = getOffsetError(k);
                const simLabel = getSimulatedDateLabel(k);
                
                // Recuperiamo il titolo descrittivo dalle traduzioni (es: "G1 - Apertura Listini")
                const tooltipText = t(`admin_cycles.${k}_label`);

                return (
                    <div 
                      key={k} 
                      title={tooltipText} // <-- Questo fa apparire il titolo al passaggio del mouse
                      className={`relative p-3 border rounded-2xl flex flex-col items-center justify-between text-center group transition-all min-w-[110px] cursor-help ${
                        hasErr ? 'bg-red-50 border-red-200' : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:shadow-md'
                      }`}
                    >
                      <span className={`text-[10px] font-black italic whitespace-nowrap py-1 px-2 rounded-lg bg-white shadow-sm border border-indigo-50 text-indigo-600`}>
                        {simLabel}
                      </span>
                      <div className="mt-3 flex items-center gap-1.5">
                          <input 
                            type="number" 
                            className={`w-12 h-9 text-center bg-white border-2 rounded-xl text-sm font-black outline-none transition-all shadow-sm ${
                              hasErr ? 'border-red-500 text-red-600' : 'border-slate-200 text-slate-800 focus:border-indigo-500'
                            }`} 
                            value={gConfig[k]} 
                            onChange={e=>setGConfig({...gConfig, [k]:parseInt(e.target.value) || 0})} 
                          />
                          <span className="text-[9px] font-bold text-slate-300">gg</span>
                      </div>
                      <span className={`text-[9px] font-black mt-2 uppercase tracking-widest border-t w-full pt-1.5 ${
                        hasErr ? 'text-red-600 animate-pulse border-red-200' : 'text-indigo-400 opacity-60 border-indigo-100'
                      }`}>
                          {hasErr ? '!! ERRORE !!' : k.toUpperCase()}
                      </span>
                    </div>
                );
                })}
            </div>

            <div className="flex items-center pl-6 border-l border-slate-100 gap-4">
                <button onClick={handleSaveSchema} className="p-5 bg-indigo-50 text-indigo-600 rounded-3xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex flex-col items-center gap-1.5 group">
                <RefreshCw size={24} className="group-hover:rotate-180 transition-transform duration-700"/><span className="text-[9px] font-black uppercase tracking-widest">{t('common.save')}</span>
                </button>
                <button onClick={() => setIsHelpOpen(true)} className="ml-5 text-slate-300 hover:text-indigo-500 transition-colors"><HelpCircle size={26}/></button>
            </div>
            </div>
        </Card>
      )}

      {/* AREA PRINCIPALE (LISTA / CALENDARIO) */}
      <Card className={`flex-1 shadow-md bg-white flex flex-col min-h-[500px] overflow-hidden border-none rounded-[2.5rem] ${viewMode === 'HOLIDAYS' ? 'ring-4 ring-orange-100' : ''}`}>
        
        {selectedIds.length > 0 && viewMode === 'LIST' && (
          <div className="bg-slate-900 text-white p-4 px-8 flex justify-between items-center shadow-2xl animate-in slide-in-from-top-4 z-30">
            <div className="flex items-center gap-4">
              <span className="text-xs font-black bg-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
                <CheckSquare size={18} className="text-emerald-400"/> 
                {selectedIds.length} {t('common.selected').toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleBulkAction('activate')} className="px-4 py-2 hover:bg-white/10 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all uppercase tracking-widest text-emerald-400"><CheckCircle size={16}/> {t('common.activate')}</button>
              <button onClick={() => handleBulkAction('deactivate')} className="px-4 py-2 hover:bg-white/10 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all uppercase tracking-widest text-orange-400"><Ban size={16}/> {t('common.deactivate')}</button>
              <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block"></div>
              <button onClick={() => handleBulkAction('delete')} className="px-4 py-2 hover:bg-red-500/20 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all uppercase tracking-widest text-red-400"><Trash2 size={16}/> {t('common.delete')}</button>
              <button onClick={() => setSelectedIds([])} className="p-2 text-slate-500 hover:text-white transition-colors ml-4"><X size={20}/></button>
            </div>
          </div>
        )}

        {viewMode === 'LIST' ? (
          <div className="overflow-x-auto h-full">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 sticky top-0 border-b border-slate-100 text-slate-400 z-10 text-[10px] font-black uppercase tracking-[0.15em]">
                <tr>
                  <th className="px-6 py-5 w-12 text-center">
                    <button onClick={() => setSelectedIds(selectedIds.length === cycles.length ? [] : cycles.map(c=>c.id))}>
                      {selectedIds.length === cycles.length && cycles.length > 0 ? <CheckSquare className="text-indigo-600" size={20}/> : <Square className="text-slate-300" size={20}/>}
                    </button>
                  </th>
                  <th className="px-4 py-5">{t('admin_cycles.label_cycle')}</th>
                  <th className="px-4 py-5">{t('admin_cycles.g3_label')}</th>
                  <th className="px-4 py-5">{t('admin_cycles.g4_label')}</th>
                  <th className="px-4 py-5">{t('admin_cycles.g7_label')}</th>
                  <th className="px-4 py-5 text-center">{t('common.status')}</th>
                  <th className="px-6 py-5 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {cycles.map(c => (
                  <tr key={c.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.includes(c.id) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-6 py-5 text-center cursor-pointer" onClick={() => handleSelectRow(c.id)}>
                        {selectedIds.includes(c.id) ? <CheckSquare className="text-indigo-600" size={18}/> : <Square className="text-slate-200" size={18}/>}
                    </td>
                    <td className="px-4 py-5 font-bold text-slate-800 text-sm">{c.name}</td>
                    <td className="px-4 py-5 text-xs font-black text-blue-600 italic tracking-tighter">{formatDT(c.market_open_at)}</td>
                    <td className="px-4 py-5 text-xs font-black text-red-600 italic tracking-tighter">{formatDT(c.market_close_at)}</td>
                    <td className="px-4 py-5 text-xs font-black text-emerald-600 tracking-tighter">{formatDT(c.delivery_at)}</td>
                    <td className="px-4 py-5 text-center">
                      <div className="flex justify-center">
                        <div className={`h-2.5 w-2.5 rounded-full shadow-sm border border-white/20 ${c.is_active ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right whitespace-nowrap">
                      <button onClick={() => openCycleModal(c)} className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                        <Edit size={18}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-y-auto">
            <div className={`flex justify-between items-center px-6 py-4 border-b shrink-0 ${viewMode === 'HOLIDAYS' ? 'bg-orange-50' : 'bg-white'}`}>
              <button onClick={() => setCurrentDate(new Date(calendarData.year, calendarData.month - 1))} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft size={20}/></button>
              <h2 className="text-base sm:text-lg font-black uppercase text-slate-800">{currentDate.toLocaleString(i18n.language || 'it-IT', { month: 'long', year: 'numeric' })}</h2>
              <button onClick={() => setCurrentDate(new Date(calendarData.year, calendarData.month + 1))} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight size={20}/></button>
            </div>
            <div className="overflow-x-auto flex-1">
              <div className="grid grid-cols-7 gap-px bg-slate-100 min-w-[750px] h-full">
                {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d=><div key={d} className="bg-slate-50 py-2 text-center font-black text-slate-400 text-[10px] uppercase">{d}</div>)}
                {Array.from({length: calendarData.offset}).map((_,i)=><div key={`e-${i}`} className="bg-slate-50/50 min-h-[110px]"/>)}
                {Array.from({length: calendarData.days}).map((_,i)=>{
                  const day = i+1;
                  const dK = toDayKey(new Date(calendarData.year, calendarData.month, day));
                  const dayHolidays = holidays.filter(h => toDayKey(h.holiday_date) === dK);
                  const dayEvents = viewMode === 'CALENDAR' ? getEventsForDay(day) : [];
                  return (
                    <div key={day} onClick={() => viewMode === 'HOLIDAYS' ? openHolidayModal(null, new Date(calendarData.year, calendarData.month, day)) : openCycleModal(null, new Date(calendarData.year, calendarData.month, day))} className={`min-h-[110px] bg-white p-2 border-slate-50 cursor-pointer flex flex-col gap-1 transition-colors ${viewMode === 'HOLIDAYS' ? 'hover:bg-orange-50/50' : 'hover:bg-indigo-50/30'}`}>
                      <span className={`text-xs font-black ${viewMode === 'HOLIDAYS' ? 'text-orange-500' : 'text-slate-300'}`}>{day}</span>
                      {dayHolidays.map(h => (<div key={h.id} onClick={(e) => { e.stopPropagation(); openHolidayModal(h); }} className="bg-orange-100 text-orange-800 p-1 rounded-lg text-[9px] font-black border border-orange-200 flex justify-between items-center transition-all shadow-sm"><span className="truncate">{h.name}</span><Palmtree size={10} className="shrink-0 ml-1 text-orange-600"/></div>))}
                      {dayEvents.map((e, idx) => (<div key={idx} onClick={(evt)=>{evt.stopPropagation(); openCycleModal(e.raw)}} className={`text-[8px] sm:text-[9px] px-1.5 py-1 rounded-md border truncate flex items-center gap-1 font-bold shadow-sm ${e.color}`}>{e.icon} <span className="truncate">{e.label}</span></div>))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* --- MODALE CICLO (CREAZIONE/EDIT) --- */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCycle ? "Gestione Ciclo Esistente" : "Pianificazione Nuovo Ciclo"}>
        
        {/* FIX DOPPIA SCROLLBAR: rimosso max-h-[85vh] e overflow-y-auto */}
        <div className="space-y-6 p-1 font-sans">
          
          {conflictsInModal.length > 0 && (<div className="bg-red-50 border border-red-200 p-4 rounded-xl flex gap-3 text-red-800 font-bold text-xs items-center animate-pulse"><AlertTriangle className="text-red-600 shrink-0" /> {t('admin_cycles.conflict_detected')}</div>)}
          
          <div className="bg-slate-50 border border-slate-100 p-6 rounded-[2.5rem] space-y-5 shadow-inner">
             <Input label="Titolo del Ciclo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="text-base font-bold text-indigo-700 bg-white" placeholder="Es: Ciclo Ortofrutta Maggio" />
             
             {/* LOGICA RIPETIZIONE RECUPERATA E FUNZIONANTE (Originale) */}
             {!editingCycle && (
                <div className="flex flex-col sm:flex-row gap-4 p-5 bg-white/80 backdrop-blur rounded-3xl border border-white shadow-sm">
                   <div className="flex-1">
                     <label className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2 mb-2 ml-1"><RefreshCw size={14}/> Ripetizione Automatica</label>
                     <select className="w-full p-3 text-sm font-bold bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50/50 transition-all" value={formData.repeat_type} onChange={e=>setFormData({...formData, repeat_type: e.target.value})}>
                       <option value="none">Singola istanza (nessun duplicato)</option>
                       <option value="weekly">Settimanale (stesso giorno per X volte)</option>
                       <option value="fortnightly">Quindicinale (ogni 2 settimane)</option>
                       <option value="monthly">Mensile (stesso giorno del mese)</option>
                     </select>
                   </div>
                   {formData.repeat_type !== 'none' && (
                     <div className="w-full sm:w-32">
                       <label className="text-[10px] font-black text-indigo-600 uppercase block mb-2 ml-1">Occorrenze</label>
                       <input type="number" min="1" max="12" className="w-full p-3 text-sm font-black bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50/50 text-center" value={formData.repeat_count} onChange={e => setFormData({...formData, repeat_count: e.target.value})}/>
                     </div>
                   )}
                </div>
             )}
          </div>

          <div className="p-6 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-100/50 space-y-6">
            <div className="pb-6 border-b border-slate-100">
              <label className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <Truck size={16}/> G7 - Data Consegna e Chiusura Ciclo
              </label>
              <Input 
                type="datetime-local" 
                value={formData.delivery_at} 
                onChange={e => setFormData({...formData, delivery_at: e.target.value})} 
                className={`text-base font-bold tracking-tight rounded-2xl p-4 ${checkSingleDateConflict(formData.delivery_at) ? 'bg-red-50 border-red-500 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}
              />
              
              {/* FIX FORMATO DATA: Mostriamo la conferma in gg/mm/aaaa sotto l'input */}
              <div className="mt-2 flex items-center gap-2 px-3">
                <Badge color={checkSingleDateConflict(formData.delivery_at) ? 'red' : 'emerald'} className="font-black text-[10px] uppercase">
                  {formatDT(formData.delivery_at)}
                </Badge>
                {checkSingleDateConflict(formData.delivery_at) && <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter flex items-center gap-1"><AlertCircle size={10}/> Conflitto con festività!</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
              {[
                {f: 'start_at', l: 'G1 - Apertura Listini (G1)'},
                {f: 'producers_deadline', l: 'G2 - Chiusura Listini (G2)'},
                {f: 'market_open_at', l: 'G3 - Apertura Bottega (G3)'},
                {f: 'market_close_at', l: 'G4 - Chiusura Bottega (G4)'},
                {f: 'orders_sent_at', l: 'G5 - Invio Ordini (G5)'},
                {f: 'confirmation_at', l: 'G6 - Ricezione Merce (G6)'}
              ].map((item) => {
                const conflict = checkSingleDateConflict(formData[item.f]);
                return (
                  <div key={item.f} className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{item.l}</label>
                    <Input 
                      type="datetime-local" 
                      value={formData[item.f]} 
                      onChange={e => setFormData({...formData, [item.f]: e.target.value})} 
                      className={`text-sm font-bold rounded-xl ${conflict ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-100'}`}
                    />
                    {/* FIX FORMATO DATA: Conferma formattata per G1-G6 */}
                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter ml-2 bg-indigo-50 inline-block px-2 py-1 rounded-md">
                      {formatDT(formData[item.f])}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 border-t border-slate-100 px-2">
             {editingCycle ? (
                <Button variant="danger" onClick={() => setIsDeleteConfirmOpen(true)} className="w-full sm:w-auto bg-red-50 text-red-600 border-none font-black text-[10px] uppercase py-3 px-6 hover:bg-red-100">
                  <Trash2 size={16} className="mr-2"/> Elimina Ciclo
                </Button>
             ) : <div/>}
             <div className="flex gap-4 w-full sm:w-auto">
               <Button variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1 sm:flex-none py-3 px-8 font-black uppercase text-[10px] tracking-widest border-slate-200">Annulla</Button>
               <Button onClick={handleSaveForm} className="flex-1 sm:flex-none bg-indigo-600 text-white font-black py-3 px-10 uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100">
                 {editingCycle ? 'Salva Modifiche' : 'Crea Ciclo/i'}
               </Button>
             </div>
          </div>
        </div>
      </Modal>

      {/* --- ALTRI MODALI (HELP, ELIMINAZIONE, FESTIVITÀ) --- */}
      <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Glossario Ciclo Operativo">
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <p className="text-xs text-slate-500 italic leading-relaxed mb-6">Ogni ciclo segue un percorso obbligato di 7 fasi (G1-G7). Gli offset definiscono quanti giorni prima della consegna (G7) deve avvenire ogni evento.</p>
            {[1,2,3,4,5,6,7].map(num => (
              <div key={num} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-colors">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">{t(`admin_cycles.g${num}_label`)}</p>
                <p className="text-xs text-slate-600 font-bold leading-relaxed">{t(`admin_cycles.g${num}_desc`)}</p>
              </div>
            ))}
          </div>
      </Modal>

      <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="Eliminazione Permanente">
          <div className="p-4 text-center space-y-6">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-pulse"><AlertTriangle size={40}/></div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Sei assolutamente sicuro?</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">L'eliminazione del ciclo <strong>"{editingCycle?.name}"</strong> è irreversibile e rimuoverà anche l'accesso allo shop per i soci in quel periodo.</p>
              </div>
              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-4 font-black uppercase text-[10px]">No, Annulla</Button>
                <Button onClick={async () => {
                   await axios.delete(`${API_URL}/api/admin/cycles/${editingCycle.id}?gasId=${activeProfile.context_id}`);
                   setIsDeleteConfirmOpen(false); setIsModalOpen(false); fetchData();
                   setToast({ message: t('common.deleted'), type: 'success' });
                }} className="flex-1 bg-red-600 text-white font-black py-4 uppercase text-[10px] shadow-lg shadow-red-100">Sì, Elimina</Button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isHolidayModalOpen} onClose={() => setIsHolidayModalOpen(false)} title={editingHoliday ? "Modifica Festività" : "Nuova Festività"}>
          <div className="space-y-5 p-2">
              <Input label="Nome Ricorrenza" value={holidayFormData.name} onChange={e => setHolidayFormData({...holidayFormData, name: e.target.value})} placeholder="Es: Natale, Pasquetta..." className="font-bold" />
              <Input label="Data" type="date" value={holidayFormData.holiday_date} onChange={e => setHolidayFormData({...holidayFormData, holiday_date: e.target.value})} />
              
              <div className="flex justify-between items-center pt-6 border-t mt-6">
                  {editingHoliday ? (
                    <Button variant="danger" onClick={() => setIsHolidayDeleteConfirmOpen(true)} className="bg-red-50 text-red-600 border-none font-black text-[10px] uppercase px-4"><Trash2 size={16} className="mr-2"/> Elimina</Button>
                  ) : <div/>}
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setIsHolidayModalOpen(false)} className="px-6 font-black uppercase text-[10px]">Chiudi</Button>
                    <Button onClick={handleSaveHoliday} className="bg-orange-600 text-white font-black uppercase text-[10px] px-8 shadow-lg shadow-orange-100">Salva</Button>
                  </div>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isHolidayDeleteConfirmOpen} onClose={() => setIsHolidayDeleteConfirmOpen(false)} title="Elimina Festività">
          <div className="p-4 text-center space-y-6">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto"><Palmtree size={32}/></div>
              <p className="text-sm text-slate-500 font-bold">Rimuovere definitivamente la festività "{editingHoliday?.name}"?</p>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setIsHolidayDeleteConfirmOpen(false)} className="flex-1 py-3 font-black uppercase text-[10px]">Annulla</Button>
                <Button onClick={handleExecuteDeleteHoliday} className="flex-1 bg-red-600 text-white font-black py-3 uppercase text-[10px] shadow-lg">Conferma</Button>
              </div>
          </div>
      </Modal>

    </div>
  );
};