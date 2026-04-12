/* src/components/ui-kit.jsx v3.1
   INCLUDE: Button, Input, Select, Card, Modal, Badge, Progress, Toast.
   FIX: Forzato locale it-IT su Input per correggere formato date mobile/desktop.
*/

import React, { useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';

// --- ATOMS ---

export const Button = ({ children, variant = 'primary', className = '', disabled, isLoading, ...props }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-bold transition-all active:scale-95 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    outline: "border-2 border-slate-200 text-slate-600 hover:border-slate-300 bg-transparent",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100",
    ghost: "text-slate-500 hover:bg-slate-100 bg-transparent"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant] || variants.primary} ${className}`} 
      disabled={disabled || isLoading} 
      {...props}
    >
      {isLoading && <Loader2 className="animate-spin mr-2" size={18}/>}
      {children}
    </button>
  );
};

export const Input = ({ label, error, className = '', icon: Icon, ...props }) => (
  <div className="w-full font-sans">
    {label && <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>}
    <div className="relative">
        {Icon && <Icon className="absolute left-3 top-3 text-slate-400" size={18}/>}
        <input 
          lang="it-IT" // FIX: Forza il browser a mostrare date in formato italiano
          className={`w-full p-2.5 ${Icon ? 'pl-10' : ''} bg-white border rounded-xl outline-none transition-all ${error ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'} ${className}`}
          {...props}
        />
    </div>
    {error && <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>}
  </div>
);

export const Select = ({ label, options = [], className = '', ...props }) => (
  <div className="w-full">
    {label && <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>}
    <select 
      className={`w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 ${className}`}
      {...props}
    >
      {props.children || options.map((opt, i) => (
        <option key={i} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// --- COMPONENTI VISUALI ---

export const Badge = ({ children, color = 'slate', className = '' }) => {
    const colors = {
        slate: 'bg-slate-100 text-slate-600',
        red: 'bg-red-100 text-red-700',
        green: 'bg-emerald-100 text-emerald-700',
        emerald: 'bg-emerald-100 text-emerald-700',
        blue: 'bg-blue-100 text-blue-700',
        indigo: 'bg-indigo-100 text-indigo-700',
        orange: 'bg-orange-100 text-orange-700',
        amber: 'bg-amber-100 text-amber-700',
        purple: 'bg-purple-100 text-purple-700'
    };

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colors[color] || colors.slate} ${className}`}>
            {children}
        </span>
    );
};

export const Progress = ({ value = 0, max = 100, className = "" }) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`w-full bg-slate-100 rounded-full h-2 overflow-hidden ${className}`}>
      <div 
        className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out" 
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

// --- MOLECULES ---

export const Card = ({ title, children, className = '', ...props }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`} {...props}>
    {title && (
        <div className="px-5 py-4 border-b border-slate-100 font-bold text-slate-800 text-sm uppercase tracking-wide">
            {title}
        </div>
    )}
    <div className="p-5">
        {children}
    </div>
  </div>
);

export const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-50 shrink-0">
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- TOAST INTELLIGENTE ---
export const Toast = ({ message, type = 'info', onClose, duration = 4000 }) => {
  const styles = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-slate-800 text-white',
    warning: 'bg-amber-50 text-white border border-amber-200 !text-amber-800'
  };
  
  const icons = {
      success: <CheckCircle size={18}/>,
      error: <AlertTriangle size={18}/>,
      info: <Info size={18}/>,
      warning: <AlertTriangle size={18}/>
  };

  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => onClose(), duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl shadow-slate-400/20 animate-in slide-in-from-right duration-300 font-medium text-sm ${styles[type] || styles.info}`}>
      {icons[type]}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="ml-4 hover:opacity-70 transition-opacity"><X size={16}/></button>
    </div>
  );
};