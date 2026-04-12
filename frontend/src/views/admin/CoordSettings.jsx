/**
 * @file frontend/src/views/admin/CoordSettings.jsx
 * @version v1.2.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description GAS Settings. Gestione anagrafica, categorie, notifiche e nuove modalità operative (Pagamenti, Ordini, Consegne).
 * @status Integro, Completo, Robusto.
 * @date 2026-02-24
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { 
    Settings, Save, Globe, Landmark, Info, Loader2, 
    ShieldAlert, CheckCircle2, Ban, MessageSquare, 
    Tag, Plus, Trash2, Edit3, XCircle, Sliders
} from 'lucide-react';
import { Card, Button, Input, Toast } from '../../components/ui-kit';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

const EVENT_DEFS = [
    { key: 'G1_OPEN', label: 'G1: Apertura Listini Produttori', vars: '{{cycle_name}}, {{deadline}}' },
    { key: 'G3_SHOP_OPEN', label: 'G3: Apertura Mercato Soci', vars: '{{cycle_name}}, {{close_date}}' },
    { key: 'G4_REMINDER', label: 'G4: Alert Chiusura (-3h)', vars: '{{cycle_name}}' },
    { key: 'G5_PROD_ORDER', label: 'G5: Ordini ai Produttori', vars: '{{cycle_name}}' }
];

export const CoordSettings = () => {
    const { t } = useTranslation();
    const { activeProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [activeTab, setActiveTab] = useState('GENERAL');
    
    // --- STATE DATI ---
    const [formData, setFormData] = useState({
        name: '', 
        description: '', 
        iban: '', 
        website: '', 
        email_contact: '', 
        allow_insufficient_balance: false,
        manage_payments: true,   // Nuova opzione
        manage_orders: true,     // Nuova opzione
        manage_deliveries: true  // Nuova opzione
    });
    const [templates, setTemplates] = useState({});
    const [categories, setCategories] = useState([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCatId, setEditingCatId] = useState(null);

    const fetchData = async () => {
        if (!activeProfile?.context_id) return;
        setLoading(true);
        const gasId = activeProfile.context_id;
        try {
            const [infoRes, tplRes, catRes] = await Promise.all([
                axios.get(`${API_URL}/api/admin/settings/gas-info?gasId=${gasId}`),
                axios.get(`${API_URL}/api/admin/settings/templates?gasId=${gasId}`),
                axios.get(`${API_URL}/api/admin/settings/categories?gasId=${gasId}`)
            ]);
            
            setFormData({
                name: infoRes.data.name || '',
                description: infoRes.data.description || '',
                iban: infoRes.data.iban || '',
                website: infoRes.data.website || '',
                email_contact: infoRes.data.email_contact || '',
                allow_insufficient_balance: !!infoRes.data.allow_insufficient_balance,
                manage_payments: infoRes.data.manage_payments ?? true,
                manage_orders: infoRes.data.manage_orders ?? true,
                manage_deliveries: infoRes.data.manage_deliveries ?? true
            });

            const tplObj = {};
            tplRes.data.forEach(t => tplObj[t.event_key] = t);
            setTemplates(tplObj);
            setCategories(catRes.data);

        } catch (err) { 
            setToast({ message: t('common.error'), type: 'error' }); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { fetchData(); }, [activeProfile]);

    const handleSubmit = async () => {
        setSaving(true);
        const gasId = activeProfile.context_id;
        try {
            if (activeTab === 'GENERAL') {
                await axios.post(`${API_URL}/api/admin/settings/gas-info`, { ...formData, gasId });
            } else if (activeTab === 'NOTIFICATIONS') {
                const tplArray = Object.keys(templates).map(k => ({ event_key: k, ...templates[k] }));
                await axios.post(`${API_URL}/api/admin/settings/templates`, { templates: tplArray, gasId });
            }
            setToast({ message: t('common.saved'), type: 'success' });
        } catch (err) { 
            setToast({ message: t('common.error'), type: 'error' }); 
        } finally { 
            setSaving(false); 
        }
    };

    // --- CATEGORY ACTIONS ---
    const handleSaveCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            await axios.post(`${API_URL}/api/admin/settings/categories`, { 
                id: editingCatId, 
                name: newCategoryName, 
                gasId: activeProfile.context_id 
            });
            setNewCategoryName('');
            setEditingCatId(null);
            fetchData();
            setToast({ message: t('common.saved'), type: 'success' });
        } catch (err) { setToast({ message: t('common.error'), type: 'error' }); }
    };

    const handleDeleteCategory = async (id) => {
        if (!window.confirm(t('common.confirm_delete'))) return;
        try {
            await axios.delete(`${API_URL}/api/admin/settings/categories/${id}?gasId=${activeProfile.context_id}`);
            fetchData();
            setToast({ message: t('common.deleted'), type: 'success' });
        } catch (err) { 
            setToast({ message: err.response?.data?.error || t('common.error'), type: 'error' }); 
        }
    };

    // Helper per renderizzare i toggle (Chirurgia Modalità Operative)
    const RenderToggle = ({ label, sublabel, field }) => (
        <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white transition-all duration-200">
            <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-sm truncate">{label}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed italic">{sublabel}</p>
            </div>
            <div 
                className="relative inline-flex cursor-pointer items-center shrink-0" 
                onClick={() => setFormData({...formData, [field]: !formData[field]})}
            >
                <div className={`w-11 h-6 rounded-full transition-colors ${formData[field] ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform ${formData[field] ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
            </div>
        </div>
    );

    if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-600" /></div>;

    return (
        <div className="max-w-5xl mx-auto pb-20 px-4 space-y-6 animate-in fade-in duration-500">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* HEADER CON TAB */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><Settings size={24} /></div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">{t('admin_settings.title')}</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{activeProfile?.context_name}</p>
                    </div>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
                    <button onClick={() => setActiveTab('GENERAL')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'GENERAL' ? 'bg-white shadow text-indigo-700' : 'text-slate-50' && 'text-slate-500'}`}>Generale</button>
                    <button onClick={() => setActiveTab('CATEGORIES')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'CATEGORIES' ? 'bg-white shadow text-indigo-700' : 'text-slate-50' && 'text-slate-500'}`}>Categorie</button>
                    <button onClick={() => setActiveTab('NOTIFICATIONS')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'NOTIFICATIONS' ? 'bg-white shadow text-indigo-700' : 'text-slate-50' && 'text-slate-500'}`}>Notifiche</button>
                </div>
            </div>

            {/* TAB CONTENT: GENERAL */}
            {activeTab === 'GENERAL' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
                        <Card className="p-6 space-y-4">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-tighter flex items-center gap-2 mb-2"><Info size={14}/> {t('common.info_general')}</h2>
                            <Input label={t('admin_settings.field_gas_name')} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Descrizione</label>
                                <textarea className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm focus:border-indigo-500 outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                            </div>
                        </Card>

                        {/* SEZIONE REGOLE E MODALITA OPERATIVE */}
                        <Card className="p-6 border-l-4 border-l-amber-400 bg-white space-y-4">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-tighter flex items-center gap-2 mb-4"><ShieldAlert size={14} className="text-amber-500"/> Regole e Modalità Operativa</h2>
                            
                            <div className="grid grid-cols-1 gap-3">
                                <RenderToggle 
                                    label={t('admin_settings.manage_payments')} 
                                    sublabel={t('admin_settings.manage_payments_desc')} 
                                    field="manage_payments" 
                                />
                                <RenderToggle 
                                    label={t('admin_settings.manage_orders')} 
                                    sublabel={t('admin_settings.manage_orders_desc')} 
                                    field="manage_orders" 
                                />
                                <RenderToggle 
                                    label={t('admin_settings.manage_deliveries')} 
                                    sublabel={t('admin_settings.manage_deliveries_desc')} 
                                    field="manage_deliveries" 
                                />
                                <div className="pt-2 border-t border-slate-100 mt-2">
                                    <RenderToggle 
                                        label={t('admin_settings.rule_allow_negative')} 
                                        sublabel={t('admin_settings.rule_allow_negative_desc')} 
                                        field="allow_insufficient_balance" 
                                    />
                                </div>
                            </div>

                            <div className="mt-4 text-center">
                                {formData.allow_insufficient_balance ? 
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center justify-center gap-1 w-fit mx-auto border border-emerald-100"><CheckCircle2 size={10}/> {t('admin_settings.model_trust') || 'Modello basato sulla FIDUCIA'}</span> : 
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full flex items-center justify-center gap-1 w-fit mx-auto border border-slate-200"><Ban size={10}/> {t('admin_settings.model_prepaid') || 'Modello PREPAGATO'}</span>
                                }
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="p-6 space-y-4">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-tighter flex items-center gap-2 mb-2"><Landmark size={14}/> Finanza</h2>
                            <Input label={t('admin_settings.field_iban')} value={formData.iban} onChange={e => setFormData({...formData, iban: e.target.value})} />
                        </Card>
                        <Card className="p-6 space-y-4">
                            <h2 className="text-xs font-black text-slate-400 uppercase tracking-tighter flex items-center gap-2 mb-2"><Globe size={14}/> Contatti</h2>
                            <Input label="Sito Web" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
                            <Input label="Email" value={formData.email_contact} onChange={e => setFormData({...formData, email_contact: e.target.value})} />
                        </Card>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: CATEGORIES */}
            {activeTab === 'CATEGORIES' && (
                <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
                    <Card className="p-6">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-tighter flex items-center gap-2 mb-6"><Tag size={14}/> Gestione Categorie Catalogo</h2>
                        <div className="flex gap-2 mb-8">
                            <Input placeholder="Esempio: Ortofrutta, Latticini..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                            <Button onClick={handleSaveCategory} className="bg-emerald-600 text-white shadow-lg" disabled={!newCategoryName.trim()}>
                                {editingCatId ? <Save size={18}/> : <Plus size={18}/>}
                            </Button>
                            {editingCatId && (
                                <Button variant="ghost" onClick={() => {setEditingCatId(null); setNewCategoryName('');}}><XCircle size={18}/></Button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {categories.length === 0 ? (
                                <p className="text-center py-8 text-slate-400 italic text-sm">Nessuna categoria configurata.</p>
                            ) : (
                                categories.map(cat => (
                                    <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group hover:bg-white hover:shadow-sm transition-all">
                                        <span className="font-bold text-slate-700">{cat.name}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => {setEditingCatId(cat.id); setNewCategoryName(cat.name);}} className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg"><Edit3 size={16}/></button>
                                            <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* TAB CONTENT: NOTIFICATIONS */}
            {activeTab === 'NOTIFICATIONS' && (
                <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-right-4">
                    {EVENT_DEFS.map(evt => {
                        const tpl = templates[evt.key] || { subject: '', body: '' };
                        return (
                            <Card key={evt.key} className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-black text-slate-700 flex items-center gap-2"><MessageSquare size={18} className="text-indigo-500"/> {evt.label}</h3>
                                    <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-mono">Variabili: {evt.vars}</span>
                                </div>
                                <div className="space-y-3">
                                    <Input label="Oggetto Email" value={tpl.subject} onChange={e => {
                                        setTemplates(prev => ({...prev, [evt.key]: {...prev[evt.key], subject: e.target.value}}))
                                    }} />
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Messaggio</label>
                                        <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm h-24 focus:border-indigo-500 outline-none resize-none" value={tpl.body} onChange={e => {
                                             setTemplates(prev => ({...prev, [evt.key]: {...prev[evt.key], body: e.target.value}}))
                                        }} />
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* TASTO SALVA GLOBALE */}
            {activeTab !== 'CATEGORIES' && (
                <div className="sticky bottom-6 z-10">
                    <Button onClick={handleSubmit} isLoading={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black shadow-xl uppercase tracking-wide">
                        <Save size={18} className="mr-2" /> {t('common.save')}
                    </Button>
                </div>
            )}
        </div>
    );
};