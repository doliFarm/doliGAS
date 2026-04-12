/**
 * @file frontend/src/views/auth/Verify.jsx
 * @version v1.0.0
 * @author Luigi GRILLO @ doliFarm.com
 * @description OTP Verification View. Handles code validation, JWT storage, and redirection logic based on user profile count.
 * @status Stable
 * @date 2026-01-16
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Toast } from '../../components/ui-kit';
import { ShieldCheck, ArrowRight, Loader2, RefreshCw } from 'lucide-react';

export const Verify = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  
  const { verifyOtp, requestOtp } = useAuth(); // Context v5.0
  const navigate = useNavigate();
  const location = useLocation();

  // Dati passati dalla schermata Login (contact + gasSlug)   *** LG attenzione al demoCode
  const { contact, gasSlug, demoCode } = location.state || {};

  // 1. PROTEZIONE ACCESSO DIRETTO
  useEffect(() => {
    if (!contact) {
      navigate('/login', { replace: true });
    }
  }, [contact, navigate]);

  // 2. LOGICA VERIFICA
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setToast(null);

    try {
      // Step 2: Verifica OTP
      const user = await verifyOtp(contact, code);
      
      // SUCCESSO: Routing basato sul Ruolo
      setToast({ type: 'success', message: `Benvenuto ${user.first_name}!` });
      
      // Ritardo estetico per leggere il messaggio
      setTimeout(() => {
        switch (user.role) {
          case 'Coordinatore':
          case 'Admin':
            navigate('/admin/dashboard');
            break;
          case 'Produttore':
            navigate('/producer/dashboard');
            break;
          case 'Socio':
          default:
            // Qui indirizziamo alla Nuova App Mobile
            navigate('/mobile/home'); 
            break;
        }
      }, 800);

    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Codice non valido' });
      setLoading(false);
    }
  };

  // 3. LOGICA RE-INVIO CODICE
  const handleResend = async () => {
    try {
      setLoading(true);
      await requestOtp(contact, gasSlug); // Richiama lo Step 1
      setToast({ type: 'success', message: 'Nuovo codice inviato!' });
    } catch (err) {
      setToast({ type: 'error', message: 'Impossibile rinviare il codice' });
    } finally {
      setLoading(false);
    }
  };

  if (!contact) return null; // Evita flash prima del redirect

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="max-w-md w-full animate-in slide-in-from-right duration-500">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Verifica Sicurezza</h1>
          <p className="mt-2 text-slate-500">Inserisci il codice inviato a:</p>
          <p className="font-semibold text-indigo-600">{contact}</p>
        </div>

        <Card className="p-8 shadow-xl shadow-slate-200/50 border-slate-100">
          <div className="mb-6 text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
              <ShieldCheck size={24} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-center text-xs font-bold text-slate-400 uppercase mb-2">
                Codice a 6 cifre
              </label>
              <input
                type="text"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} // Solo numeri
                className="w-full text-center text-3xl tracking-[0.5em] py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-black text-slate-800 placeholder-slate-200"
                placeholder="000000"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 flex justify-center items-center gap-2 text-lg"
              disabled={loading || code.length < 6}
            >
              {loading ? <Loader2 className="animate-spin" /> : <>Verifica <ArrowRight /></>}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={handleResend}
              disabled={loading}
              className="text-sm text-slate-400 hover:text-indigo-600 font-medium flex items-center justify-center gap-1 mx-auto transition-colors"
            >
              <RefreshCw size={14} /> Non hai ricevuto il codice? Reinvia
            </button>
          </div>
        </Card>
            {/* SEZIONE DEBUG/DEMO: Mostra il codice solo se presente nello state */}
        {demoCode && (
          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm animate-pulse flex flex-col items-center justify-center text-center">
             <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase mb-1">
                <KeyRound size={14} /> 
                <span>Modalità Demo Attiva</span>
             </div>
             <p className="text-amber-900 text-sm">
                Il codice OTP per l'accesso è:
             </p>
             <p className="text-2xl font-mono font-black text-amber-600 mt-1 tracking-widest select-all cursor-pointer" onClick={() => setCode(String(demoCode))}>
                {demoCode}
             </p>
             <p className="text-[10px] text-amber-500 mt-2">(Clicca sul codice per inserirlo automaticamente)</p>
          </div>
        )}


      </div>
    </div>
  );
};
