/**
 * @file frontend/src/views/admin/CoordProducers.jsx
 * @version v1.1.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Gestione Anagrafica Produttori. Interfaccia per invitare/attivare produttori e gestire i dati aziendali.
 * Fix: Barra azioni massive uniformata (bottom), i18n totale, ottimizzazione mobile.
 * @status Integro, Completo, Robusto.
 * @date 2026-02-24
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { 
  Plus, Edit, Mail, Phone, MapPin, Loader2, Search, Tractor, 
  Trash2, CheckCircle, Ban, List, LayoutGrid, CheckSquare, 
  ArrowUpDown, CreditCard, AlertCircle, MessageSquare, Send, User, UserX, FileText, XCircle, Square
} from 'lucide-react';
import { Card, Button, Badge, Toast, Modal, Input } from '../../components/ui-kit';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

export const CoordProducers = () => {
  const { activeProfile } = useAuth();
  const { t } = useTranslation();
  
  // --- STATI DATI ---
  const [producers, setProducers] = useState([]);
  const [members, setMembers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  
  // --- STATI VISTA E FILTRI ---
  const [viewMode, setViewMode] = useState('TABLE');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'business_name', direction: 'asc' });

  // --- STATI MODALI ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
  const [msgData, setMsgData] = useState({ subject: '', message: '' });
  const [msgRecipients, setMsgRecipients] = useState([]); 
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  // --- FETCH DATI ---
  const fetchData = async () => {
    if (!activeProfile?.context_id) return;
    setLoading(true);
    const gasId = activeProfile.context_id;

    try {
      const [resP, resM] = await Promise.all([
        axios.get(`${API_URL}/api/admin/producers?gasId=${gasId}`),
        axios.get(`${API_URL}/api/admin/members?gasId=${gasId}`)
      ]);
      setProducers(resP.data || []);
      setMembers(resM.data || []);
      setSelectedIds([]);
    } catch (e) { 
        setToast({ type: 'error', message: t('admin_producers.error_loading') }); 
    } finally { 
        setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, [activeProfile]);

  // --- ORDINAMENTO E FILTRAGGIO ---
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedProducers = useMemo(() => {
    let sortableItems = [...producers];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const valA = (a[sortConfig.key] || '').toString().toLowerCase();
        const valB = (b[sortConfig.key] || '').toString().toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [producers, sortConfig]);

  const filteredProducers = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return sortedProducers.filter(p => 
      p.business_name.toLowerCase().includes(lowerSearch) ||
      (p.contact_name && p.contact_name.toLowerCase().includes(lowerSearch))
    );
  }, [sortedProducers, searchTerm]);

  // --- CRUD HANDLERS ---
  const handleOpenModal = (p = null) => {
      if (p) {
          setEditing({ ...p, user_id: p.user_id || '' }); 
      } else {
          setEditing({ 
              business_name: '', vat_number: '', contact_name: '', contact_email: '', contact_phone: '', 
              address: '', iban: '', internal_notes: '', is_active: 1, user_id: '' 
          });
      }
      setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing.business_name) { 
        setToast({ type: 'error', message: t('admin_producers.error_name_required') }); 
        return; 
    }
    
    const payload = {
        ...editing,
        user_id: editing.user_id ? parseInt(editing.user_id) : null,
        gasId: activeProfile.context_id
    };

    setIsSaving(true);
    try {
      await axios.post(`${API_URL}/api/admin/producers`, payload);
      setIsModalOpen(false);
      fetchData();
      setToast({ type: 'success', message: t('common.saved') });
    } catch (e) { 
        setToast({ type: 'error', message: t('common.error') }); 
    } finally { 
        setIsSaving(false); 
    }
  };

  const handleBulkAction = async (action) => {
      if(selectedIds.length === 0) return;
      const gasId = activeProfile.context_id;

      if (action === 'message') {
          const recipients = producers
              .filter(p => selectedIds.includes(p.id) && p.user_id)
              .map(p => p.user_id);
          
          if (recipients.length === 0) {
              setToast({ type: 'warning', message: t('admin_producers.warn_no_user_associated') });
              return;
          }
          setMsgRecipients(recipients);
          setMsgData({ subject: '', message: '' });
          setIsMsgModalOpen(true);
          return;
      }

      if (action === 'delete') {
          if (!window.confirm(t('common.confirm_delete_multiple'))) return;
          try {
              for (const id of selectedIds) {
                  await axios.delete(`${API_URL}/api/admin/producers/${id}?gasId=${gasId}`);
              }
              fetchData();
              setToast({ type: 'success', message: t('common.deleted') });
          } catch (e) {
              setToast({ type: 'error', message: t('admin_producers.error_delete_failed') });
          }
          return;
      }

      try {
          const isActive = action === 'activate' ? 1 : 0;
          await axios.patch(`${API_URL}/api/admin/producers/bulk-status`, { 
            ids: selectedIds, 
            is_active: isActive,
            gasId: gasId
          });
          fetchData();
          setToast({ type: 'success', message: t('common.saved') });
      } catch(e) { setToast({ type: 'error', message: t('common.error') }); }
  };

  const handleSingleMessage = (p) => {
      if (!p.user_id) {
          setToast({ type: 'warning', message: t('admin_producers.warn_no_user_associated') });
          return;
      }
      setMsgRecipients([p.user_id]);
      setMsgData({ subject: '', message: '' });
      setIsMsgModalOpen(true);
  };

  const handleSendMessage = async (e) => {
      e.preventDefault();
      if (!msgData.subject || !msgData.message) return;
      setIsSendingMsg(true);
      try {
          await axios.post(`${API_URL}/api/admin/messages/send`, {
              recipientIds: msgRecipients,
              subject: msgData.subject,
              message: msgData.message,
              target_profile: "producer",
              gasId: activeProfile.context_id
          });
          setToast({ type: 'success', message: t('admin_producers.msg_sent_success') });
          setIsMsgModalOpen(false);
          setSelectedIds([]);
      } catch (err) {
          setToast({ type: 'error', message: t('common.error') });
      } finally {
          setIsSendingMsg(false);
      }
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-emerald-500" size={40} /></div>;

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto pb-24 px-2 sm:px-4 relative">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="w-full lg:w-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl"><Tractor size={24}/></div>
              {t('admin_producers.title')}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">{t('admin_producers.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          
          <div className="bg-slate-100 p-1 rounded-lg border sm:w-auto hidden sm:flex">
            <button onClick={() => setViewMode('TABLE')} className={`flex-1 p-2 rounded-md transition-all ${viewMode === 'TABLE' ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}><List size={18}/></button>
            <button onClick={() => setViewMode('GRID')} className={`flex-1 p-2 rounded-md transition-all ${viewMode === 'GRID' ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}><LayoutGrid size={18}/></button>
          </div>

          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder={t('common.search_placeholder')} className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 h-10 sm:h-11 font-bold text-xs sm:text-sm text-white shadow-lg"><Plus size={18} className="mr-1"/> {t('common.add')}</Button>
        </div>
      </div>

      {/* TABLE VIEW (Desktop) */}
      {viewMode === 'TABLE' && (
        <Card className="overflow-hidden border-none shadow-sm hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-6 py-4 w-12 text-center">
                    <button onClick={() => setSelectedIds(selectedIds.length === filteredProducers.length ? [] : filteredProducers.map(p=>p.id))}>
                        {selectedIds.length === filteredProducers.length && filteredProducers.length > 0 ? <CheckSquare className="text-emerald-600" size={18}/> : <Square className="text-slate-300" size={18}/>}
                    </button>
                  </th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100" onClick={() => handleSort('business_name')}><div className="flex items-center gap-1">{t('admin_producers.col_business_name')} <ArrowUpDown size={12}/></div></th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100" onClick={() => handleSort('contact_name')}><div className="flex items-center gap-1">{t('admin_producers.col_contact')} <ArrowUpDown size={12}/></div></th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100" onClick={() => handleSort('contact_phone')}><div className="flex items-center gap-1">{t('common.phone', 'Telefono')} <ArrowUpDown size={12}/></div></th>
                  <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('is_active')}><div className="flex items-center gap-1 justify-center">{t('common.status')} <ArrowUpDown size={12}/></div></th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {filteredProducers.map(p => (
                  <tr key={p.id} className={`hover:bg-slate-50/50 ${selectedIds.includes(p.id) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-6 py-4 text-center cursor-pointer" onClick={() => setSelectedIds(prev => prev.includes(p.id) ? prev.filter(i=>i!==p.id) : [...prev, p.id])}>
                        {selectedIds.includes(p.id) ? <CheckSquare className="text-indigo-600" size={18}/> : <Square className="text-slate-200" size={18}/>}
                    </td>
                    <td className="px-4 py-4">
                        <p className="font-bold text-slate-700 text-sm">{p.business_name}</p>
                        <div className="flex items-start gap-1 text-[10px] text-slate-500 mt-1">
                            <MapPin size={10} className="mt-0.5 shrink-0"/> {p.address || <span className="italic text-slate-300">{t('admin_producers.no_address')}</span>}
                        </div>
                        {p.vat_number && <p className="text-[9px] text-slate-400 font-mono mt-1">P.IVA: {p.vat_number}</p>}
                    </td>
                    <td className="px-4 py-4 text-xs font-medium text-slate-600">
                        <div>{p.contact_name || '---'}</div>
                        {p.contact_email && <div className="text-[10px] text-blue-500 mt-0.5">{p.contact_email}</div>}
                        {!p.user_id && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-1 w-fit border border-amber-100" title={t('admin_producers.warn_no_login')}>
                                <UserX size={10}/> {t('admin_producers.label_no_login')}
                            </div>
                        )}
                    </td>
                    <td className="px-4 py-4 align-middle">
                       {p.contact_phone ? (<div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-fit text-slate-600 font-mono text-xs"><Phone size={12}/> {p.contact_phone}</div>) : <span className="text-slate-300 text-xs">-</span>}
                    </td>
                    <td className="px-4 py-4">
                        <div className="flex justify-center"><div className={`h-3 w-3 rounded-full shadow-sm border border-white/20 ${p.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} /></div>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                            <button onClick={() => handleSingleMessage(p)} className={`p-2 rounded-lg transition-colors ${p.user_id ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-300 cursor-not-allowed'}`} disabled={!p.user_id}><MessageSquare size={16}/></button>
                            <button onClick={() => handleOpenModal(p)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit size={16}/></button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* GRID VIEW (Mobile/Cards) */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 ${viewMode === 'TABLE' ? 'md:hidden' : ''}`}>
        {filteredProducers.map(p => (
          <Card key={p.id} className={`p-4 sm:p-6 border-t-4 ${p.is_active ? 'border-t-emerald-500' : 'border-t-red-300'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Tractor size={20} /></div>
              <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => setSelectedIds(prev => prev.includes(p.id) ? prev.filter(i=>i!==p.id) : [...prev, p.id])} className="w-5 h-5 rounded text-emerald-600" />
            </div>
            <h3 className="font-black text-slate-800 text-base leading-tight uppercase mb-1">{p.business_name}</h3>
            {p.vat_number && <p className="text-[10px] font-mono text-slate-400 mb-4">P.IVA: {p.vat_number}</p>}
            
            {!p.user_id && (
                <div className="bg-amber-50 text-amber-800 text-xs p-2 rounded-lg mb-3 flex items-center gap-2 border border-amber-100">
                    <UserX size={14} /> <span>{t('admin_producers.label_no_login')}</span>
                </div>
            )}

            <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-4 mb-4">
              <p className="flex items-center gap-2"><User size={14} className="text-slate-300"/> {p.contact_name || '---'}</p>
              <p className="flex items-center gap-2 truncate"><Mail size={14} className="text-slate-300 shrink-0"/> {p.contact_email || '---'}</p>
              <p className="flex items-center gap-2"><Phone size={14} className="text-slate-300 shrink-0"/> {p.contact_phone || '---'}</p>
            </div>
            
            <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-4">
                <div className="flex items-start gap-2 text-slate-500 leading-tight"><MapPin size={14} className="text-slate-300 shrink-0 mt-0.5"/><span>{p.address || t('admin_producers.no_address')}</span></div>
                {p.iban && (<div className="flex items-start gap-2"><CreditCard size={14} className="text-slate-300 shrink-0 mt-0.5"/><span className="font-mono bg-slate-50 px-1 rounded truncate">{p.iban}</span></div>)}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-6">
                <Button variant="secondary" size="sm" className={`${p.user_id ? 'text-blue-600' : 'text-slate-300 cursor-not-allowed'}`} disabled={!p.user_id} onClick={() => handleSingleMessage(p)}><MessageSquare size={14} className="mr-2"/> {t('admin_producers.btn_message')}</Button>
                <Button variant="secondary" size="sm" onClick={() => handleOpenModal(p)}><Edit size={14} className="mr-2"/> {t('common.edit')}</Button>
            </div>
          </Card>
        ))}
      </div>

      {/* --- BARRA AZIONI MASSIVE (Uniformata UX) --- */}
      {selectedIds.length > 0 && (
          <div className="fixed bottom-20 lg:bottom-10 left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-max bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between lg:gap-8 z-50 border border-slate-700 animate-in slide-in-from-bottom-10 duration-300">
              <div className="flex items-center gap-3">
                  <div className="bg-emerald-500 text-white px-2 py-0.5 rounded-md text-[10px] font-black">{selectedIds.length}</div>
                  <span className="hidden sm:inline font-bold text-xs uppercase tracking-wider text-slate-400">{t('common.selected')}</span>
              </div>
              <div className="flex gap-1 items-center border-l border-slate-700 pl-4">
                  <button onClick={() => handleBulkAction('message')} className="p-2 lg:px-4 lg:py-2 rounded-xl hover:bg-slate-800 text-blue-400 flex items-center gap-2 transition-all active:scale-90" title={t('admin_producers.btn_message')}>
                      <MessageSquare size={18}/> <span className="hidden lg:inline text-[10px] font-black uppercase">{t('admin_producers.btn_message')}</span>
                  </button>
                  <button onClick={() => handleBulkAction('activate')} className="p-2 lg:px-4 lg:py-2 rounded-xl hover:bg-slate-800 text-emerald-400 flex items-center gap-2 transition-all active:scale-90" title={t('common.activate')}>
                      <CheckCircle size={18}/> <span className="hidden lg:inline text-[10px] font-black uppercase">{t('common.activate')}</span>
                  </button>
                  <button onClick={() => handleBulkAction('deactivate')} className="p-2 lg:px-4 lg:py-2 rounded-xl hover:bg-slate-800 text-orange-400 flex items-center gap-2 transition-all active:scale-90" title={t('common.deactivate')}>
                      <Ban size={18}/> <span className="hidden lg:inline text-[10px] font-black uppercase">{t('common.deactivate')}</span>
                  </button>
                  <button onClick={() => handleBulkAction('delete')} className="p-2 lg:px-4 lg:py-2 rounded-xl hover:bg-slate-800 text-red-400 flex items-center gap-2 transition-all active:scale-90" title={t('common.delete')}>
                      <Trash2 size={18}/> <span className="hidden lg:inline text-[10px] font-black uppercase">{t('common.delete')}</span>
                  </button>
              </div>
              <button onClick={() => setSelectedIds([])} className="p-2 text-slate-500 hover:text-white transition-colors"><XCircle size={20}/></button>
          </div>
      )}

      {/* MODALE EDIT/CREATE */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing?.id ? t('admin_producers.modal_edit_title') : t('admin_producers.modal_new_title')}>
          <div className="p-1 space-y-4 max-h-[75vh] overflow-y-auto">
              <Input label={t('admin_producers.field_business_name')} value={editing?.business_name || ''} onChange={e => setEditing({...editing, business_name: e.target.value})} />
              <Input label={t('admin_producers.field_vat')} value={editing?.vat_number || ''} onChange={e => setEditing({...editing, vat_number: e.target.value})} />
              
              <div className="grid grid-cols-2 gap-4">
                  <Input label={t('admin_producers.field_contact_name')} value={editing?.contact_name || ''} onChange={e => setEditing({...editing, contact_name: e.target.value})} />
                  <Input label={t('common.phone')} value={editing?.contact_phone || ''} onChange={e => setEditing({...editing, contact_phone: e.target.value})} />
              </div>
              <Input label={t('common.email')} value={editing?.contact_email || ''} onChange={e => setEditing({...editing, contact_email: e.target.value})} />
              
              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                  <label className="block text-[10px] font-black text-indigo-400 uppercase mb-2 flex items-center gap-1">
                      <User size={12}/> {t('admin_producers.field_associated_account')}
                  </label>
                  <select 
                      className="w-full p-2.5 bg-white border border-indigo-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                      value={editing?.user_id || ''}
                      onChange={e => setEditing({...editing, user_id: e.target.value})}
                  >
                      <option value="">-- {t('admin_producers.no_user_associated')} --</option>
                      {members.map(m => (
                          <option key={m.id} value={m.id}>
                              {m.last_name} {m.first_name} ({m.email})
                          </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-2 italic">{t('admin_producers.hint_associated_account')}</p>
              </div>

              <Input label={t('admin_producers.field_address')} value={editing?.address || ''} onChange={e => setEditing({...editing, address: e.target.value})} />
              <Input label={t('admin_producers.field_iban')} value={editing?.iban || ''} onChange={e => setEditing({...editing, iban: e.target.value})} />
              
              <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">{t('admin_producers.field_notes')}</label>
                  <textarea className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-emerald-500 text-sm h-20 resize-none" 
                    value={editing?.internal_notes || ''} onChange={e => setEditing({...editing, internal_notes: e.target.value})} />
              </div>

              <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <input type="checkbox" className="w-4 h-4 rounded text-emerald-600" checked={editing?.is_active} onChange={e => setEditing({...editing, is_active: e.target.checked})} />
                  <span className="text-sm font-bold text-slate-700">{t('common.status_active')}</span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
                  <Button onClick={handleSave} isLoading={isSaving} className="flex-1 bg-emerald-600 text-white font-bold">{t('common.save')}</Button>
              </div>
          </div>
      </Modal>

      {/* MODALE MESSAGGIO */}
      <Modal isOpen={isMsgModalOpen} onClose={() => setIsMsgModalOpen(false)} title={t('admin_producers.modal_msg_title')}>
        <form onSubmit={handleSendMessage} className="p-1 space-y-5">
           <div className="bg-blue-50 p-4 rounded-2xl flex items-start gap-3 text-blue-700 text-xs border border-blue-100">
              <MessageSquare size={18} className="mt-0.5 shrink-0 opacity-70"/>
              <p>{t('admin_producers.msg_info_prefix')} <b>{msgRecipients.length}</b> {t('admin_producers.msg_info_suffix')}</p>
           </div>
           <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">{t('common.subject')}</label>
              <input type="text" required className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                value={msgData.subject} onChange={e => setMsgData({...msgData, subject: e.target.value})} />
           </div>
           <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">{t('common.message')}</label>
              <textarea required rows="5" className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                value={msgData.message} onChange={e => setMsgData({...msgData, message: e.target.value})} />
           </div>
           <div className="pt-2 flex gap-3">
             <Button type="button" variant="outline" className="flex-1" onClick={() => setIsMsgModalOpen(false)}>{t('common.cancel')}</Button>
             <Button type="submit" isLoading={isSendingMsg} className="flex-[2] bg-blue-600 text-white font-bold flex items-center justify-center gap-2"><Send size={16}/> {t('common.send')}</Button>
           </div>
        </form>
      </Modal>
    </div>
  );
};