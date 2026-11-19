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
  FILE: backend/routes/debug.js - v1.4
  DESCRIPTION: endpoints for system stats, logs and container status.
  =============================================================================
*/
const express = require('express');
const router = express.Router();
const os = require('os');
const { authenticateToken } = require('../middlewares/auth');

// SECURITY: all debug routes require an authenticated user
router.use(authenticateToken);

// --- 1. HARDWARE STATS (RAM/CPU) ---
router.get('/system-stats', (req, res) => {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        res.json({
            memory: {
                total: (totalMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                used: (usedMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                percent: ((usedMem / totalMem) * 100).toFixed(1) + '%'
            },
            uptime: (os.uptime() / 3600).toFixed(1) + ' ore',
            load: os.loadavg(),
            cpus: os.cpus().length,
            platform: os.platform(),
            timestamp: new Date()
        });
    } catch (e) {
        res.status(500).json({ error: "Errore lettura hardware" });
    }
});

// --- 2. CONTAINER STATUS ---
// Note: requires the API container to have access to the docker socket (optional)
// or returns the status of the internally mapped services.
router.get('/containers', (req, res) => {
    // In a standard Docker setup the API can see the other services through DNS.
    // We simulate the health check of the essential containers.
    const services = [
        { name: 'gashub-api', role: 'Backend/API', port: 3000 },
        { name: 'gashub-db', role: 'MySQL Database', port: 3306 },
        { name: 'gashub-frontend', role: 'Vite/Nginx', port: 8080 }
    ];
    
    // For now return the list defined in the system, to monitor visibility
    res.json({
        containers: services.map(s => ({
            ...s,
            status: 'running', // Future: real check through docker.sock
            lastCheck: new Date()
        }))
    });
});

// --- 3. READ LOGS FROM THE GLOBAL BUFFER ---
router.get('/logs', (req, res) => {
    res.json({ logs: global.logBuffer || [] });
});

module.exports = router;