/**
 * @file frontend/src/views/admin/CoordMembers.jsx
 * @version v1.1.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description Gestione Soci e Cassa. Fix: Posizionamento Bulk Bar per compatibilità Mobile Bottom Nav.
 * @status Integro, Completo, Robusto.
 * @date 2026-02-24
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { 
  Search, UserPlus, Edit2, Mail, CheckCircle, XCircle, 
  AlertCircle, Trash2, Loader2, Phone, MapPin, 
  MessageSquare, CheckSquare, Square, Send, Shield, Users, Wallet, 
  PlusCircle, ChevronDown, ArrowUpDown, RefreshCw
} from 'lucide-react';
import { Card, Button, Badge, Toast } from '../../components/ui-kit';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

const INTERNATIONAL_PREFIXES = [
    { code: '+39', label: '🇮🇹 +39' }, { code: '+41', label: '🇨🇭 +41' },
    { code: '+33', label: '🇫🇷 +33' }, { code: '+49', label: '🇩🇪 +49' },
    { code: '+44', label: '🇬🇧 +44' }, { code: '+34', label: '🇪🇸 +34' },
];

export const CoordMembers = () => {
  const { activeProfile } = useAuth();
  const dropdownRef = useRef(null); 
  const { t } = useTranslation();
  
  // --- STATI DATI ---
  const [activeTab, setActiveTab] = useState('MEMBERS');
  const [members, setMembers] = useState([]);
  const [pendingTx, setPendingTx] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  // --- FILTRI & ORDINAMENTO ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState([]); 
  const [sortConfig, setSortConfig] = useState({ key: 'last_name', direction: 'asc' });

  // --- STATI MODALI ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
  const [messageTargets, setMessageTargets] = useState([]); 
  const [msgData, setMsgData] = useState({ subject: '', body: '', channels: { email: true, whatsapp: false, board: false } });

  // --- STATI CASSA ---
  const [selectedWalletUser, setSelectedWalletUser] = useState(null); 
  const [walletSearchQuery, setWalletSearchQuery] = useState('');
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletNote, setWalletNote] = useState('');

  const splitPhone = (fullPhone) => {
      if (!fullPhone) return { prefix: '+39', number: '' };
      const sorted = [...INTERNATIONAL_PREFIXES].sort((a, b) => b.code.length - a.code.length);
      const found = sorted.find(p => fullPhone.startsWith(p.code));
      return found ? { prefix: found.code, number: fullPhone.replace(found.code, '') } : { prefix: '+39', number: fullPhone };
  };

  const fetchData = async () => {
    if (!activeProfile?.context_id) return;
    setLoading(true);
    const gasId = activeProfile.context_id;
    try {
      const [resMembers, resWallet, resRoles] = await Promise.all([
        axios.get(`${API_URL}/api/admin/members?gasId=${gasId}`),
        axios.get(`${API_URL}/api/admin/wallet/pending?gasId=${gasId}`),
        axios.get(`${API_URL}/api/admin/roles?gasId=${gasId}`)
      ]);
      setMembers(resMembers.data);
      setPendingTx(resWallet.data);
      setAvailableRoles(resRoles.data);
      setSelectedIds([]); 
    } catch (err) { 
        setToast({ type: 'error', message: t('admin_members.error_loading') }); 
    } finally { 
        setLoading(false); 
    }
  };

  useEffect(() => { 
    fetchData(); 
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsWalletDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeTab, activeProfile]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const processedMembers = useMemo(() => {
    let result = [...members];
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(m => (m.last_name + ' ' + m.first_name).toLowerCase().includes(lower) || (m.email && m.email.toLowerCase().includes(lower)));
    }
    if (filterRole !== 'ALL') result = result.filter(m => m.role_name === filterRole);
    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = (a[sortConfig.key] || '').toString().toLowerCase();
        const valB = (b[sortConfig.key] || '').toString().toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [members, searchTerm, filterRole, sortConfig]);

  const walletFilteredMembers = useMemo(() => {
    const q = walletSearchQuery.toLowerCase();
    if (!q) return members.slice(0, 8); 
    return members.filter(m => `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) || `${m.last_name} ${m.first_name}`.toLowerCase().includes(q)).slice(0, 10);
  }, [members, walletSearchQuery]);

  const handleSelectAll = () => {
      if (selectedIds.length === processedMembers.length) setSelectedIds([]);
      else setSelectedIds(processedMembers.map(m => m.id));
  };

  const handleSelectRow = (id) => {
      if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(sid => sid !== id));
      else setSelectedIds([...selectedIds, id]);
  };

  const handleOpenCreate = () => {
    const socioRole = availableRoles.find(r => r.name.toLowerCase().includes('socio'));
    setEditingMember({ first_name: '', last_name: '', email: '', phone_prefix: '+39', phone_number: '', address: '', internal_notes: '', role_id: socioRole?.id || 3, is_active: 1 });
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (member) => {
      const { prefix, number } = splitPhone(member.phone);
      setEditingMember({ ...member, phone_prefix: prefix, phone_number: number, address: member.address || '', internal_notes: member.internal_notes || '' });
      setIsEditModalOpen(true);
  };

  const handleSaveMember = async (e) => {
      e.preventDefault();
      try {
          const finalPhone = editingMember.phone_number?.trim() ? `${editingMember.phone_prefix}${editingMember.phone_number.trim()}` : null;
          const payload = { ...editingMember, phone: finalPhone, gasId: activeProfile.context_id };
          delete payload.phone_prefix; delete payload.phone_number;
          await axios.post(`${API_URL}/api/admin/members`, payload);
          setToast({ type: 'success', message: t('admin_members.save_success') });
          setIsEditModalOpen(false); fetchData();
      } catch(e) { setToast({ type: 'error', message: e.response?.data?.error || t('admin_members.save_error') }); }
  };

  const handleDeleteSingleMember = async () => {
    if (!editingMember?.id || !window.confirm(t('admin_members.confirm_delete'))) return;
    try {
        await axios.delete(`${API_URL}/api/admin/members/${editingMember.id}?gasId=${activeProfile.context_id}`);
        setToast({ type: 'success', message: t('admin_members.delete_success') });
        setIsEditModalOpen(false); fetchData();
    } catch (err) { setToast({ type: 'error', message: err.response?.data?.error || t('admin_members.delete_error') }); }
  };

  const handleBulkAction = async (action) => {
      if (selectedIds.length === 0) return;
      if (action === 'message') {
          setMessageTargets(selectedIds);
          setMsgData({ subject: '', body: '', channels: { email: true, whatsapp: false, board: false } });
          setIsMsgModalOpen(true); return;
      }
      if (!window.confirm(t('admin_members.confirm_action'))) return;
      try {
          await axios.post(`${API_URL}/api/admin/members/bulk-action`, { userIds: selectedIds, action, gasId: activeProfile.context_id });
          setToast({ type: 'success', message: t('admin_members.action_success') }); fetchData();
      } catch (err) { setToast({ type: 'error', message: err.response?.data?.error || t('admin_members.action_error') }); }
  };

  const handleRowMessage = (memberId) => {
      setMessageTargets([memberId]);
      setMsgData({ subject: '', body: '', channels: { email: true, whatsapp: false, board: false } });
      setIsMsgModalOpen(true);
  };

  const handleSendMessage = async (e) => {
      e.preventDefault();
      try {
          const channelsList = Object.keys(msgData.channels).filter(k => msgData.channels[k]);
          await axios.post(`${API_URL}/api/admin/messages/send`, { recipientIds: messageTargets, subject: msgData.subject, message: msgData.body, channels: channelsList, target_profile: "member", gasId: activeProfile.context_id });
          setToast({ type: 'success', message: t('admin_members.msg_sent_success') });
          setIsMsgModalOpen(false); setSelectedIds([]);
      } catch(e) { setToast({ type: 'error', message: t('admin_members.msg_error') }); }
  };

  const getRecipientNames = () => {
      const selected = members.filter(m => messageTargets.includes(m.id));
      if (selected.length === 0) return t('admin_members.none');
      if (selected.length === 1) return `${selected[0].first_name} ${selected[0].last_name}`;
      return `${selected[0].first_name} + ${selected.length - 1} ${t('admin_members.others')}`;
  };

  const handleManualRecharge = async (e) => {
    e.preventDefault();
    if (!selectedWalletUser || !walletAmount) return;
    try {
      await axios.post(`${API_URL}/api/admin/wallet/manual-add`, { userId: selectedWalletUser.id, amount: parseFloat(walletAmount), description: walletNote || t('admin_members.default_recharge_note'), gasId: activeProfile.context_id });
      setToast({ type: 'success', message: t('admin_members.save_success') });
      setWalletAmount(''); setWalletNote(''); setSelectedWalletUser(null); setWalletSearchQuery(''); fetchData();
    } catch (err) { setToast({ type: 'error', message: t('admin_members.action_error') }); }
  };

  const handleApproveTransaction = async (txId) => {
    try {
        await axios.post(`${API_URL}/api/admin/wallet/approve/${txId}?gasId=${activeProfile.context_id}`, {});
        setToast({ type: 'success', message: t('admin_members.action_success') }); fetchData();
    } catch (err) { setToast({ type: 'error', message: t('admin_members.action_error') }); }
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-emerald-500" size={40} /></div>;

  return (
    <div className="space-y-6 pb-24 relative">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="w-full lg:w-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0"><Users size={24}/></div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight">{t('admin_members.title')}</h1>
              <p className="text-slate-500 text-xs sm:text-sm">{activeProfile?.context_name} — {t('admin_members.subtitle')}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder={t('admin_members.search_placeholder')} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Button onClick={handleOpenCreate} className="bg-emerald-600 h-10 sm:h-11 font-bold text-xs sm:text-sm text-white shadow-lg"><UserPlus size={18} className="mr-2"/> {t('admin_members.btn_new_member')}</Button>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="flex justify-end px-2">
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
           <button onClick={() => setActiveTab('MEMBERS')} className={`flex-1 sm:flex-none px-6 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'MEMBERS' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('admin_members.tab_members')}</button>
           <button onClick={() => setActiveTab('WALLET')} className={`flex-1 sm:flex-none px-6 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'WALLET' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('admin_members.tab_wallet')} {pendingTx.length > 0 && <Badge color="red" className="scale-75">{pendingTx.length}</Badge>}</button>
        </div>
      </div>

      {activeTab === 'MEMBERS' && (
        <Card className="shadow-sm pb-16 relative overflow-visible border-none bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                    <tr>
                        <th className="p-4 w-10 text-center cursor-pointer" onClick={handleSelectAll}>{selectedIds.length > 0 && selectedIds.length === processedMembers.length ? <CheckSquare className="text-emerald-600 mx-auto" size={18}/> : <Square className="text-slate-300 mx-auto" size={18}/>}</th>
                        <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('last_name')}><div className="flex items-center gap-1">{t('admin_members.col_member')} <ArrowUpDown size={12} className="opacity-40"/></div></th>
                        <th className="p-4">{t('admin_members.col_contacts')}</th>
                        <th className="p-4 hidden md:table-cell">{t('admin_members.col_address')}</th>
                        <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('role_name')}><div className="flex items-center gap-1">{t('admin_members.col_role')} <ArrowUpDown size={12} className="opacity-40"/></div></th>
                        <th className="p-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('is_active')}><div className="flex items-center justify-center gap-1">{t('admin_members.col_status')} <ArrowUpDown size={12} className="opacity-40"/></div></th>
                        <th className="p-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('balance')}><div className="flex items-center justify-end gap-1">{t('admin_members.col_balance')} <ArrowUpDown size={12} className="opacity-40"/></div></th>
                        <th className="p-4 text-right">{t('admin_members.col_actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {processedMembers.map(m => (
                        <tr key={m.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.includes(m.id) ? 'bg-indigo-50/30' : ''}`}>
                            <td className="p-4 text-center cursor-pointer" onClick={() => handleSelectRow(m.id)}>{selectedIds.includes(m.id) ? <CheckSquare className="text-indigo-600 mx-auto" size={18}/> : <Square className="text-slate-200 mx-auto" size={18}/>}</td>
                            <td className="p-4">
                                <div className="font-bold text-slate-700">{m.last_name} {m.first_name}</div>
                                {m.internal_notes && <div className="text-amber-600 cursor-help mt-0.5 inline-block" title={m.internal_notes}><div className="text-[9px] bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded flex items-center gap-1 font-black uppercase"><AlertCircle size={10}/> {t('admin_members.label_notes')}</div></div>}
                            </td>
                            <td className="p-4 text-slate-600"><div className="flex items-center gap-2 truncate max-w-[150px] text-xs font-medium"><Mail size={12} className="shrink-0 text-slate-400"/> {m.email}</div>{m.phone && <div className="text-slate-400 text-[10px] mt-0.5 font-mono">{m.phone}</div>}</td>
                            <td className="p-4 text-slate-500 text-xs max-w-[140px] truncate hidden md:table-cell">{m.address || '-'}</td>
                            <td className="p-4"><Badge color="slate" className="text-[10px]">{m.role_name}</Badge></td>
                            <td className="p-4"><div className="flex justify-center"><div className={`h-3 w-3 rounded-full shadow-sm border border-white/20 ${m.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} title={m.is_active ? t('admin_members.status_active') : t('admin_members.status_suspended')}/></div></td>
                            <td className={`p-4 text-right font-mono font-black ${m.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{parseFloat(m.balance).toFixed(2)} €</td>
                            <td className="p-4 text-right whitespace-nowrap"><div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleRowMessage(m.id)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"><MessageSquare size={16}/></button><button onClick={() => handleOpenEdit(m)} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors"><Edit2 size={16}/></button></div></td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>

          {/* FIX: BARRA AZIONI MASSIVE MOBILE FRIENDLY */}
          {selectedIds.length > 0 && (
              <div className="fixed bottom-20 lg:bottom-10 left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-max bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between lg:gap-8 z-50 border border-slate-700 animate-in slide-in-from-bottom-10 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500 text-white px-2 py-0.5 rounded-md text-[10px] font-black">{selectedIds.length}</div>
                    <span className="hidden sm:inline font-bold text-xs uppercase tracking-wider text-slate-400">{t('admin_members.bulk_selected')}</span>
                  </div>

                  <div className="flex gap-1 items-center border-l border-slate-700 pl-4">
                      <button onClick={() => handleBulkAction('message')} className="p-2 lg:px-4 lg:py-2 rounded-xl hover:bg-slate-800 text-blue-400 flex items-center gap-2 transition-all active:scale-90" title={t('admin_members.bulk_message')}>
                        <MessageSquare size={18}/> <span className="hidden lg:inline text-[10px] font-black uppercase">{t('admin_members.bulk_message')}</span>
                      </button>
                      <button onClick={() => handleBulkAction('activate')} className="p-2 lg:px-4 lg:py-2 rounded-xl hover:bg-slate-800 text-emerald-400 flex items-center gap-2 transition-all active:scale-90" title={t('admin_members.bulk_activate')}>
                        <CheckCircle size={18}/> <span className="hidden lg:inline text-[10px] font-black uppercase">{t('admin_members.bulk_activate')}</span>
                      </button>
                      <button onClick={() => handleBulkAction('deactivate')} className="p-2 lg:px-4 lg:py-2 rounded-xl hover:bg-slate-800 text-orange-400 flex items-center gap-2 transition-all active:scale-90" title={t('admin_members.bulk_suspend')}>
                        <XCircle size={18}/> <span className="hidden lg:inline text-[10px] font-black uppercase">{t('admin_members.bulk_suspend')}</span>
                      </button>
                      <button onClick={() => handleBulkAction('delete')} className="p-2 lg:px-4 lg:py-2 rounded-xl hover:bg-slate-800 text-red-400 flex items-center gap-2 transition-all active:scale-90" title={t('admin_members.bulk_delete')}>
                        <Trash2 size={18}/> <span className="hidden lg:inline text-[10px] font-black uppercase">{t('admin_members.bulk_delete')}</span>
                      </button>
                  </div>
                  
                  <button onClick={() => setSelectedIds([])} className="p-2 text-slate-500 hover:text-white transition-colors">
                    <XCircle size={20}/>
                  </button>
              </div>
          )}
        </Card>
      )}

      {activeTab === 'WALLET' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                  <Card className="border-l-4 border-l-orange-400 shadow-sm border border-slate-200 bg-white">
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center rounded-t-2xl">
                          <h3 className="font-bold text-slate-700 flex items-center gap-2"><AlertCircle size={18} className="text-orange-500"/> {t('admin_members.wallet_pending_title')}</h3>
                          <Badge color="orange">{pendingTx.length}</Badge>
                      </div>
                      <div className="divide-y divide-slate-100">
                          {pendingTx.length === 0 ? <div className="p-12 text-center text-slate-400 font-medium italic text-sm">{t('admin_members.wallet_no_pending')}</div> : 
                            pendingTx.map(tx => (
                                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div className="flex gap-3"><div className="bg-orange-100 text-orange-700 p-2 rounded-full h-fit"><Wallet size={18}/></div><div><div className="font-bold text-sm text-slate-800">{tx.first_name} {tx.last_name}</div><div className="text-xs text-slate-500">{tx.description}</div></div></div>
                                    <div className="flex items-center gap-3"><div className="font-mono font-black text-emerald-600">+{parseFloat(tx.amount).toFixed(2)} €</div><button onClick={() => handleApproveTransaction(tx.id)} className="bg-emerald-500 text-white p-2 rounded-xl hover:bg-emerald-600 transition-colors shadow-sm"><CheckCircle size={18}/></button></div>
                                </div>
                            ))
                          }
                      </div>
                  </Card>
              </div>
              <div className="lg:col-span-1">
                  <Card className="sticky top-6 border border-indigo-100 shadow-md overflow-visible bg-white rounded-2xl">
                      <div className="p-4 border-b border-indigo-50 bg-indigo-50/30 rounded-t-2xl"><h3 className="font-bold text-indigo-900 flex items-center gap-2"><PlusCircle size={18}/> {t('admin_members.wallet_manual_title')}</h3></div>
                      <form onSubmit={handleManualRecharge} className="p-5 space-y-4">
                          <div className="relative" ref={dropdownRef}>
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t('admin_members.field_select_member')}</label>
                              <div className="relative flex items-center group cursor-pointer" onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}>
                                <input type="text" className="w-full border-2 border-slate-100 p-2.5 rounded-xl outline-none focus:border-indigo-500 transition-all text-sm font-bold bg-slate-50" placeholder={t('admin_members.placeholder_search_member')} value={selectedWalletUser ? `${selectedWalletUser.last_name} ${selectedWalletUser.first_name}` : walletSearchQuery} onChange={(e) => { setWalletSearchQuery(e.target.value); setSelectedWalletUser(null); setIsWalletDropdownOpen(true); }} onFocus={() => setIsWalletDropdownOpen(true)} /><ChevronDown className="absolute right-3 text-slate-300 group-hover:text-indigo-50 transition-colors" size={18}/>
                              </div>
                              {isWalletDropdownOpen && (
                                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                                      {walletFilteredMembers.length > 0 ? walletFilteredMembers.map(m => (
                                          <div key={m.id} onClick={() => { setSelectedWalletUser(m); setWalletSearchQuery(''); setIsWalletDropdownOpen(false); }} className="p-3 hover:bg-indigo-50 border-b border-slate-50 last:border-none cursor-pointer flex justify-between items-center transition-colors group"><div><div className="font-bold text-slate-700 group-hover:text-indigo-700">{m.last_name} {m.first_name}</div><div className="text-[10px] text-slate-400">{m.email}</div></div><Badge color="slate" className="font-mono text-[9px]">{parseFloat(m.balance).toFixed(2)}€</Badge></div>
                                      )) : <div className="p-4 text-center text-xs text-slate-400 italic">{t('admin_members.no_member_found')}</div>}
                                  </div>
                              )}
                          </div>
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t('admin_members.field_amount')}</label><input type="number" step="0.01" className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-mono font-black outline-none focus:border-indigo-500 bg-slate-50" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} required placeholder="0.00"/></div>
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t('admin_members.field_note')}</label><textarea className="w-full border-2 border-slate-100 p-2.5 rounded-xl text-sm h-16 resize-none outline-none focus:border-indigo-500 bg-slate-50" value={walletNote} onChange={e => setWalletNote(e.target.value)} placeholder={t('admin_members.placeholder_note')}/></div>
                          <Button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl shadow-lg shadow-indigo-100 disabled:opacity-50 font-bold" disabled={!selectedWalletUser}><Send size={16} className="mr-2"/> {t('admin_members.btn_confirm_payment')}</Button>
                      </form>
                  </Card>
              </div>
          </div>
      )}

      {/* MODALI */}
      {isEditModalOpen && editingMember && (
          <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-auto overflow-hidden">
                  <div className="bg-slate-50 px-6 py-4 border-b flex justify-between items-center"><h3 className="font-bold text-lg text-slate-800">{editingMember.id ? t('admin_members.modal_edit_title') : t('admin_members.modal_new_title')}</h3><button onClick={()=>setIsEditModalOpen(false)}><XCircle size={20} className="text-slate-400 hover:text-slate-600"/></button></div>
                  <form onSubmit={handleSaveMember} className="p-6 space-y-5">
                      <div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t('admin_members.field_name')}</label><input className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm" value={editingMember.first_name} onChange={e=>setEditingMember({...editingMember, first_name:e.target.value})} required/></div><div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t('admin_members.field_surname')}</label><input className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm" value={editingMember.last_name} onChange={e=>setEditingMember({...editingMember, last_name:e.target.value})} required/></div></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t('admin_members.field_email')}</label><input type="email" className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm" value={editingMember.email} onChange={e=>setEditingMember({...editingMember, email:e.target.value})} required/></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t('admin_members.field_phone')}</label><div className="flex gap-2"><select className="w-28 border p-2.5 rounded-xl bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-emerald-500" value={editingMember.phone_prefix} onChange={e=>setEditingMember({...editingMember, phone_prefix:e.target.value})}>{INTERNATIONAL_PREFIXES.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}</select><input type="tel" className="flex-1 border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm" value={editingMember.phone_number || ''} onChange={e=>setEditingMember({...editingMember, phone_number:e.target.value})} placeholder="333 1234567"/></div></div>
                      <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                          <div><label className="block text-[10px] font-black text-indigo-400 uppercase mb-1">{t('admin_members.field_role')}</label><select value={editingMember.role_id} onChange={e => setEditingMember({...editingMember, role_id: parseInt(e.target.value)})} className="w-full p-2 border border-indigo-100 rounded-lg bg-white outline-none font-bold text-sm">{availableRoles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div>
                          <div><label className="block text-[10px] font-black text-indigo-400 uppercase mb-1">{t('admin_members.field_account_status')}</label><select value={editingMember.is_active ? 1 : 0} onChange={e => setEditingMember({...editingMember, is_active: parseInt(e.target.value)})} className={`w-full p-2 border border-indigo-100 rounded-lg font-bold outline-none text-sm ${editingMember.is_active ? 'text-emerald-600' : 'text-red-600'}`}><option value={1}>{t('admin_members.status_active')}</option><option value={0}>{t('admin_members.status_suspended')}</option></select></div>
                      </div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t('admin_members.field_address')}</label><input className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm" value={editingMember.address || ''} onChange={e=>setEditingMember({...editingMember, address:e.target.value})} placeholder="Via Roma 1..."/></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{t('admin_members.field_notes')}</label><textarea className="w-full border p-2.5 rounded-xl h-20 text-sm resize-none outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" value={editingMember.internal_notes || ''} onChange={e=>setEditingMember({...editingMember, internal_notes:e.target.value})}/></div>
                      <div className="flex justify-between items-center pt-4 border-t">
                          {editingMember.id && (editingMember.role_id === 1 ? <div className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded shadow-sm"><Shield size={12}/> {t('admin_members.warning_demote')}</div> : <Button type="button" variant="danger" onClick={handleDeleteSingleMember} className="bg-red-50 text-red-600 border-none px-3 font-bold"><Trash2 size={14} className="mr-2"/> {t('common.delete', 'Elimina')}</Button>)}
                          <div className="flex gap-3"><Button variant="outline" onClick={()=>setIsEditModalOpen(false)} className="rounded-xl">{t('admin_members.btn_cancel')}</Button><Button type="submit" className="bg-emerald-600 text-white font-bold rounded-xl">{t('admin_members.btn_save')}</Button></div>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {isMsgModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                  <div className="bg-slate-900 text-white px-8 py-6 flex justify-between items-start"><div><h3 className="font-bold text-xl flex items-center gap-2"><Send size={20}/> {t('admin_members.msg_send_title')}</h3><div className="mt-2 text-slate-400 text-xs"><Users size={14} className="inline mr-1"/> {t('admin_members.msg_recipients')}: {getRecipientNames()}</div></div><button onClick={()=>setIsMsgModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><XCircle size={24}/></button></div>
                  <form onSubmit={handleSendMessage} className="p-8 space-y-6">
                      <input className="w-full border-2 border-slate-100 p-3 rounded-2xl outline-none focus:border-blue-500 font-bold bg-slate-50" value={msgData.subject} onChange={e=>setMsgData({...msgData, subject:e.target.value})} required placeholder={t('admin_members.placeholder_subject')}/>
                      <textarea className="w-full border-2 border-slate-100 p-4 rounded-2xl h-40 resize-none outline-none focus:border-blue-500 text-slate-600 bg-slate-50" value={msgData.body} onChange={e=>setMsgData({...msgData, body:e.target.value})} required placeholder={t('admin_members.placeholder_message')}/>
                      <div className="flex gap-4 pt-2"><Button variant="outline" type="button" onClick={()=>setIsMsgModalOpen(false)} className="flex-1 rounded-2xl">{t('admin_members.btn_cancel')}</Button><Button type="submit" className="flex-[2] bg-blue-600 text-white shadow-lg shadow-blue-200 py-3 rounded-2xl font-bold"><Send size={14} className="mr-2"/> {t('admin_members.btn_send')}</Button></div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};