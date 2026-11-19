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

/**
 * @file backend/server.js
 * @description doliGAS backend startup: waits for the database, applies the migrations,
 * starts the scheduler and opens the port. The Express application is in app.js.
 */
require('dotenv').config();

// SECURITY: without a strong JWT_SECRET the server must not start
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('[CRITICAL] JWT_SECRET mancante o troppo corto (minimo 32 caratteri). Avvio interrotto.');
    process.exit(1);
}

// 1. In-memory log for the debug console (last 100 messages)
global.logBuffer = [];
const MAX_LOGS = 100;
const originalLog = console.log;
const originalError = console.error;

const addToBuffer = (type, args) => {
    const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    global.logBuffer.unshift({ timestamp: new Date(), type, message });
    if (global.logBuffer.length > MAX_LOGS) global.logBuffer.pop();
};

console.log = (...args) => { addToBuffer('INFO', args); originalLog.apply(console, args); };
console.error = (...args) => { addToBuffer('ERROR', args); originalError.apply(console, args); };

// Warning repeated at startup: it exposes the access codes, demo instances only
if (process.env.DEMO_SHOW_OTP === 'true') {
    console.warn('[SECURITY] ⚠️ DEMO_SHOW_OTP attivo: il codice di accesso viene restituito');
    console.warn('[SECURITY] ⚠️ nella risposta di login. Solo per istanze dimostrative con dati finti.');
}

// 2. Application and resources
const app = require('./app');
const { allowedOrigins } = require('./app');
const pool = require('./config/db');
const { migrate } = require('./db/migrate');
const runScheduler = require('./cron/scheduler');

const PORT = process.env.PORT || 3000;

// 3. Startup, waiting for the database
const startServer = async () => {
    // 3a. Wait for the database (the MySQL container may be slower to start)
    let retries = 5;
    while (true) {
        try {
            await pool.query('SELECT 1');
            break;
        } catch (err) {
            retries -= 1;
            console.error(`❌ DB Offline. Tentativi rimasti: ${retries}. Errore: ${err.message}`);
            if (retries <= 0) process.exit(1);
            await new Promise(res => setTimeout(res, 5000));
        }
    }

    // 3b. Schema migrations (can be disabled with DB_AUTO_MIGRATE=false)
    if (process.env.DB_AUTO_MIGRATE !== 'false') {
        try {
            await migrate();
        } catch (err) {
            console.error('[MIGRATE] ❌ Avvio interrotto:', err.message);
            process.exit(1);
        }
    }

    // 3c. G1-G7 cycle automation
    runScheduler();

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Backend doliGAS online su porta ${PORT}`);
        console.log(`🌍 CORS abilitato per: ${allowedOrigins.join(', ')}`);
    });
};

startServer();
