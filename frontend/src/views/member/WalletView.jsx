/*
 * doliGAS - Solidarity purchasing group (GAS) management platform
 * Copyright (C) 2026 Luigi Grillo (doliFarm)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/* =============================================================================
  FILE: frontend/src/views/member/WalletView.jsx - v6.1
  DESC: Member wallet with multi-context support and dynamic IBAN.
  FIX: gasId injected and real GAS settings loaded.
  =============================================================================
*/
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { 
  Wallet, ArrowUpRight, ArrowDownLeft, History, 
  Info, CreditCard, Loader2, Landmark 
} from 'lucide-react';
import { Card, Button, Modal } from '../../components/ui-kit';
import { useAuth } from '../../context/AuthContext'; // Import Context

const API_URL = import.meta.env.VITE_API_URL || '';

export const WalletView = () => {
  const { activeProfile } = useAuth(); // Load the profile
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const pendingTopUp = transactions.find(tx => tx.status === 'pending' && parseFloat(tx.amount) > 0);
  const [gasInfo, setGasInfo] = useState(null); // State for the GAS info (IBAN)
  const [showTopUpInfo, setShowTopUpInfo] = useState(false);
  // Top-up declaration: the coordinator must approve it
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpNote, setTopUpNote] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestMessage, setRequestMessage] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!activeProfile?.context_id) return;
      const gasId = activeProfile.context_id;

      try {
        setLoading(true);
        // Parallel fetch: balance, history and GAS info
        const [dashRes, txRes, settingsRes] = await Promise.all([
          axios.get(`${API_URL}/api/members/dashboard?gasId=${gasId}`),
          axios.get(`${API_URL}/api/members/wallet?gasId=${gasId}`),
          // Note: use the public or protected route to read the GAS IBAN
          // Without a public route, use profile, which contains the GAS info
          axios.get(`${API_URL}/api/members/profile?gasId=${gasId}`)
        ]);
        
        setBalance(dashRes.data.balance);
        setTransactions(txRes.data);
        
        // Extract the GAS info from the profile or from a dedicated call if available
        // For now we assume profile also returns the GAS data
        setGasInfo(settingsRes.data); 

      } catch (err) {
        console.error("Wallet Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeProfile, reloadKey]); // reloadKey: reloads the history after a request

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>;

  return (
    <div className="pb-24 space-y-6 animate-in fade-in duration-500">
      
      {/* 1. HERO CARD: BALANCE */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
              <Wallet className="text-indigo-300" size={24} />
            </div>
            <button 
              onClick={() => setShowTopUpInfo(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 shadow-lg"
            >
              <ArrowUpRight size={14} /> {t('member_wallet.btn_topup')}
            </button>
          </div>
          
          <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">{activeProfile.context_name} — {t('member_wallet.current_balance')}</p>
          <h2 className="text-5xl font-black tracking-tight">
            {balance.toFixed(2)} <span className="text-2xl text-indigo-400">€</span>
          </h2>
        </div>
      </div>

      {/* 2. TRANSACTION HISTORY */}
      <div>
        <h3 className="text-lg font-black text-slate-800 mb-4 px-2 flex items-center gap-2">
          <History size={20} className="text-slate-400"/> {t('member_wallet.history_title')}
        </h3>
        
        <Card className="overflow-hidden border-slate-100 shadow-sm">
          {transactions.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {transactions.map((tx) => {
                const isPositive = parseFloat(tx.amount) > 0;
                return (
                  <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isPositive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {isPositive ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 text-sm leading-tight">{tx.description || (isPositive ? t('member_wallet.deposit') : t('member_wallet.order'))}</p>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          {new Date(tx.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', hour:'2-digit', minute:'2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className={`font-mono font-bold text-sm ${isPositive ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {isPositive ? '+' : ''}{parseFloat(tx.amount).toFixed(2)} €
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center text-slate-400 italic">
              {t('member_wallet.no_transactions')}
            </div>
          )}
        </Card>
      </div>

      {/* 3. TOP-UP MODAL: payment details and declaration to the coordinator */}
      <Modal isOpen={showTopUpInfo} onClose={() => setShowTopUpInfo(false)} title={t('member_wallet.topup_info_title')}>
        <div className="p-4 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full shrink-0">
              <Landmark size={24} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 mb-1">{t('member_wallet.how_to_topup')}</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t('member_wallet.topup_desc')}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">{t('member_wallet.iban_label')}</p>
            {/* DYNAMIC IBAN: if it is not in the DB, show a placeholder */}
            <p className="font-mono text-lg font-black text-slate-800 select-all">
                {gasInfo?.iban || "IBAN NON CONFIGURATO DAL GAS"}
            </p>
            <p className="text-xs text-slate-500 mt-2 italic">{t('member_wallet.iban_note')}</p>
          </div>

          {/* Top-up declaration: creates a request awaiting approval */}
          {pendingTopUp ? (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-800">
              {t('member_wallet.topup_pending', 'Hai già una ricarica in attesa di approvazione:')}{' '}
              <strong>{parseFloat(pendingTopUp.amount).toFixed(2)} €</strong>
            </div>
          ) : (
            <div className="border-t border-slate-200 pt-5 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase">
                {t('member_wallet.topup_declare_title', 'Hai già versato?')}
              </p>
              <p className="text-sm text-slate-600">
                {t('member_wallet.topup_declare_desc', 'Comunica l\'importo al coordinatore: il saldo si aggiorna quando lui conferma di averlo ricevuto.')}
              </p>
              <div className="flex gap-2">
                <input
                  type="number" min="0.01" step="0.01" inputMode="decimal"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  placeholder="0,00"
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-3 font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-400"
                />
                <input
                  type="text"
                  value={topUpNote}
                  onChange={(e) => setTopUpNote(e.target.value)}
                  placeholder={t('member_wallet.topup_note_placeholder', 'Nota (es. bonifico del 12/03)')}
                  className="flex-[2] border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
              {requestMessage && (
                <p className={`text-sm font-bold ${requestMessage.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {requestMessage.text}
                </p>
              )}
              <Button
                disabled={sendingRequest || !(parseFloat(String(topUpAmount).replace(',', '.')) > 0)}
                onClick={async () => {
                  setSendingRequest(true);
                  setRequestMessage(null);
                  try {
                    await axios.post(`${API_URL}/api/members/wallet/topup-request`, {
                      gasId: activeProfile.context_id,
                      amount: parseFloat(String(topUpAmount).replace(',', '.')),
                      description: topUpNote
                    });
                    setRequestMessage({ type: 'success', text: t('member_wallet.topup_sent', 'Richiesta inviata al coordinatore.') });
                    setTopUpAmount('');
                    setTopUpNote('');
                    setReloadKey(k => k + 1);
                  } catch (err) {
                    setRequestMessage({ type: 'error', text: err.response?.data?.error || t('common.error') });
                  } finally {
                    setSendingRequest(false);
                  }
                }}
                className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl"
              >
                {sendingRequest ? <Loader2 className="animate-spin mx-auto" size={18} /> : t('member_wallet.topup_declare_btn', 'Comunica la ricarica')}
              </Button>
            </div>
          )}

          <Button onClick={() => setShowTopUpInfo(false)} variant="outline" className="w-full font-bold py-3 rounded-xl">
            {t('common.close') || 'Ho capito'}
          </Button>
        </div>
      </Modal>

    </div>
  );
};