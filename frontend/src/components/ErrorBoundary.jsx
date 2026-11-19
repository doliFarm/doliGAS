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

/* src/components/ErrorBoundary.jsx - SAFETY COMPONENT v1.0
  DESCRIPTION: catches fatal React errors and shows a recovery UI.
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
    // Update the state so the next render shows the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can send the error to a logging service here
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