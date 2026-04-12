/* src/components/ErrorBoundary.jsx - COMPONENTE DI SICUREZZA v1.0
   STATUS: Integro, Completo, Robusto.
   DESCRIZIONE: Intercetta errori fatali di React e fornisce una UI di ripristino.
*/
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui-kit';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Aggiorna lo stato in modo che il prossimo render mostri l'UI di fallback.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Puoi inviare l'errore a un servizio di logging qui
    console.error("UI CRITICAL ERROR:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-red-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Ops! Errore di Caricamento</h1>
            <p className="text-slate-500 text-sm mb-6">
              L'applicazione ha riscontrato un problema imprevisto sulla tua interfaccia.
            </p>
            <div className="bg-slate-50 p-4 rounded-xl mb-6 text-left overflow-auto max-h-40">
              <code className="text-[10px] text-red-700 font-mono block">
                {this.state.error?.toString()}
              </code>
            </div>
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full bg-indigo-600 flex items-center justify-center gap-2 font-bold"
            >
              <RefreshCw size={18} /> Ricarica Pagina
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;