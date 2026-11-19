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

/* vite.config.js - VITE CONFIGURATION v4.0
  FIX: proxy forwarding API calls from the public domain to the Docker backend.
*/
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Required for access from mobile
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
      // Every call starting with /api is forwarded to the backend container
      '/api': {
        target: 'http://gashub-backend:3000', // Uses the service name from docker-compose
        changeOrigin: true,
        secure: false,
        // Fixes internal routing problems in Docker/Nginx setups
        rewrite: (path) => path 
      }
    }
  }
})
