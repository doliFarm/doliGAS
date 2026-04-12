/* vite.config.js - CONFIGURAZIONE VITE v4.0
   STATUS: Integro, Completo, Robusto.
   FIX: Implementazione Proxy per inoltro chiamate API dal dominio pubblico al backend Docker.
*/
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Obbligatorio per accesso da Mobile
    port: 5173,
    allowedHosts: [
      'fiesole.dolifarm365.com',
      'localhost',
      'demo.dolifarm365.com',
      'welcome.dolifarm365.com',
      'welcome.doligas.com',
      'www.doligas.com',
      'doligas.com'
    ],
    proxy: {
      // ROBUSTEZZA: Ogni chiamata che inizia con /api viene dirottata al container backend
      '/api': {
        target: 'http://gashub-backend:3000', // Usa il nome del servizio nel docker-compose
        changeOrigin: true,
        secure: false,
        // Risolve i problemi di routing interno in ambienti Docker/Nginx
        rewrite: (path) => path 
      }
    }
  }
})
