/**
 * @file frontend/src/components/DebugConsole.jsx
 * @version v1.5.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description On-Screen Debugger potenziato. Intercetta OTP via Eventi (istantaneo) e via API Logs (polling).
 * @status Integro, Completo, Robusto.
 * @date 2026-02-24
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Terminal, ChevronDown, Activity, Database, Cpu, Key, RefreshCw, Copy, CheckCircle2, X, Trash2 } from 'lucide-react';
import { APP_CONFIG } from '../config';

const API_URL = APP_CONFIG.API_URL;

const DebugConsole = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('OTP'); 
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const scrollRef = useRef(null);

  // --- LOGICA DI ESTRAZIONE OTP ---
  const extractOtps = (logsData) => {
    if (!logsData || !Array.isArray(logsData)) return [];
    
    const otpRegex = /(?<!\d)\d{6}(?!\d)/;

    const rawCodes = logsData
      .filter(log => log.message && otpRegex.test(log.message))
      .map(log => {
        const match = log.message.match(otpRegex);
        return {
          code: match ? match[0] : null,
          timestamp: log.timestamp || log.time, // Supporto per log API e log Eventi
          fullMessage: log.message
        };
      })
      .filter(item => item.code !== null);

    // Deduplicazione per codice
    const uniqueCodesMap = new Map();
    rawCodes.forEach(item => {
      if (!uniqueCodesMap.has(item.code)) {
        uniqueCodesMap.set(item.code, item);
      }
    });

    return Array.from(uniqueCodesMap.values()).slice(0, 5);
  };

  const otps = extractOtps(logs);
  const latestOtp = otps.length > 0 ? otps[0] : null;
  const historyOtps = otps.length > 1 ? otps.slice(1) : [];

  // --- FETCH DATI DAL BACKEND (Log di sistema) ---
  const fetchData = async () => {
    if (APP_CONFIG.APP_ENV !== 'dev') return;
    setIsRefreshing(true);
    try {
      const [logRes, statRes] = await Promise.all([
        axios.get(`${API_URL}/api/debug/logs`),
        axios.get(`${API_URL}/api/debug/system-stats`)
      ]);
      
      const incomingLogs = logRes.data.logs || [];
      
      // Merge intelligente: manteniamo i log intercettati dal frontend che non sono ancora nei log server
      setLogs(prev => {
        const eventLogs = prev.filter(l => l.isEvent);
        const merged = [...eventLogs, ...incomingLogs];
        return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50);
      });

      setStats(statRes.data);
    } catch (err) { 
      console.warn("[DEBUG] API Offline o non autorizzata"); 
    } finally {
      setIsRefreshing(false);
    }
  };

  // --- LISTENER PER EVENTI ISTANTANEI (Login.jsx) ---
  useEffect(() => {
    if (APP_CONFIG.APP_ENV !== 'dev') return;

    const handleDebugOtp = (e) => {
        const { code, contact, timestamp } = e.detail;
        const eventLog = {
            timestamp: timestamp || new Date().toISOString(),
            message: `[EVENT] OTP INTERCETTATO per ${contact}: ${code}`,
            type: 'OTP_EVENT',
            isEvent: true
        };

        setLogs(prev => [eventLog, ...prev].slice(0, 50));
        setIsOpen(true); // Apriamo la console per mostrare il codice appena arrivato
        setActiveTab('OTP'); // Portiamo il focus sul tab corretto
    };

    window.addEventListener('doliGAS_debug_otp', handleDebugOtp);
    
    // Polling periodico per i log del server (backup)
    fetchData();
    const interval = setInterval(fetchData, 5000);

    return () => {
        window.removeEventListener('doliGAS_debug_otp', handleDebugOtp);
        clearInterval(interval);
    };
  }, []);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (APP_CONFIG.APP_ENV !== 'dev') return null;

  // --- RENDER PULSANTE CHIUSO ---
  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)} 
        className="fixed bottom-4 right-4 bg-slate-900 text-emerald-400 p-2.5 rounded-full shadow-xl border border-slate-700 z-[9999] hover:scale-110 transition-all hover:bg-slate-800 group flex items-center gap-2 pr-4"
      >
        <div className="relative">
          <Terminal size={18} className="group-hover:rotate-12 transition-transform" />
          {otps.length > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse border border-slate-900"></span>}
        </div>
        <span className="text-[10px] font-bold font-mono text-slate-400 group-hover:text-white uppercase">Debug</span>
      </button>
    );
  }

  // --- RENDER WIDGET APERTO ---
  return (
    <div className="fixed bottom-4 right-4 w-80 max-h-[500px] bg-slate-950 text-slate-300 shadow-2xl border border-slate-800 z-[9999] flex flex-col font-mono text-[10px] rounded-2xl animate-in slide-in-from-right duration-300 overflow-hidden">
      
      {/* HEADER */}
      <div className="flex justify-between items-center px-3 py-2 bg-slate-900 border-b border-slate-800 select-none">
        <div className="flex gap-1">
          <button onClick={() => setActiveTab('OTP')} className={`p-1.5 rounded ${activeTab === 'OTP' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`} title="OTP">
            <Key size={14} />
          </button>
          <button onClick={() => setActiveTab('LOGS')} className={`p-1.5 rounded ${activeTab === 'LOGS' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`} title="Logs">
            <Terminal size={14} />
          </button>
          <button onClick={() => setActiveTab('SYS')} className={`p-1.5 rounded ${activeTab === 'SYS' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`} title="System">
            <Activity size={14} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLogs([])} className="text-slate-600 hover:text-red-400" title="Clear">
            <Trash2 size={12} />
          </button>
          <button onClick={fetchData} className={`text-slate-500 hover:text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`}>
            <RefreshCw size={12} />
          </button>
          <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-red-400">
            <X size={14}/>
          </button>
        </div>
      </div>

      {/* BODY */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 max-h-[350px] bg-slate-950/90 backdrop-blur-sm">
        
        {activeTab === 'OTP' && (
          <div className="space-y-3">
            {latestOtp ? (
              <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-3 shadow-lg relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                   <div className="text-[9px] text-amber-500 font-bold uppercase flex items-center gap-1">
                     <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span> New OTP Code
                   </div>
                   <span className="text-[9px] text-slate-500">{new Date(latestOtp.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-2xl font-black text-white tracking-widest font-mono select-all uppercase">
                    {latestOtp.code}
                  </div>
                  <button 
                    onClick={() => handleCopy(latestOtp.code)}
                    className={`p-2 rounded-lg transition-all ${copiedCode === latestOtp.code ? 'bg-emerald-500 text-white' : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-900 text-slate-400'}`}
                  >
                    {copiedCode === latestOtp.code ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            ) : (
               <div className="text-center py-6 text-slate-600 border border-dashed border-slate-800 rounded-lg">
                  <p>In attesa di codici...</p>
               </div>
            )}

            {historyOtps.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-800/50">
                <p className="text-[9px] text-slate-500 uppercase font-bold mb-2 pl-1">Precedenti</p>
                <div className="space-y-1.5">
                  {historyOtps.map((otp, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-slate-800/50">
                      <span className="text-slate-400 font-bold">{otp.code}</span>
                      <button onClick={() => handleCopy(otp.code)} className="text-slate-600 hover:text-amber-400">
                         {copiedCode === otp.code ? <CheckCircle2 size={12} className="text-emerald-500"/> : <Copy size={12} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'LOGS' && (
          <div className="space-y-1">
            {logs.length === 0 && <p className="text-slate-600 italic text-center py-4">Nessun log disponibile.</p>}
            {logs.map((log, i) => (
              <div key={i} className={`flex gap-2 p-1 rounded border-b border-transparent hover:bg-slate-900 ${log.isEvent ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500' : ''}`}>
                <span className="text-[8px] text-slate-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                <span className="text-slate-400 break-all leading-tight">{log.message}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'SYS' && stats && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <p className="text-slate-500 text-[9px] mb-1">RAM</p>
              <div className="flex items-end gap-1">
                <span className="text-blue-400 font-bold text-xs">{stats.memory?.percent}</span>
                <div className="w-full bg-slate-800 h-1 rounded-full mb-1 relative">
                  <div className="bg-blue-500 h-1 rounded-full" style={{width: stats.memory?.percent}}></div>
                </div>
              </div>
            </div>
            <div className="bg-slate-900 p-2 rounded border border-slate-800">
              <p className="text-slate-500 text-[9px] mb-1">CPU Load</p>
              <p className="text-emerald-400 font-bold text-xs">{stats.load ? stats.load[0].toFixed(2) : '-'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugConsole;