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
 * @file backend/app.js
 * @description doliGAS Express application: middleware and routes, without startup.
 *
 * It is kept separate from server.js because the tests (backend/test) load it with
 * supertest without opening a port, waiting for the database or starting the scheduler.
 * Environment variables must already be loaded when this module is required.
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Used by the Debug API; server.js fills it by intercepting console.log
global.logBuffer = global.logBuffer || [];

// 1. Resources and routes
const pool = require('./config/db');
global.pool = pool;

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const memberRoutes = require('./routes/members');
const adminRoutes = require('./routes/admin/index');
const debugRoutes = require('./routes/debug');
const publicRoutes = require('./routes/public');

const app = express();

// 2. CORS: known origins only
const allowedOrigins = [
    'https://doligas.com',
    'https://www.doligas.com',
    'https://doligas.it',
    'https://www.doligas.it',
    'http://localhost:5173',
    'https://demo.dolifarm365.com'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS Policy: Origin not allowed'), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
// In tests the per-request log is just noise
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// 3. Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/admin', adminRoutes);
// In this project NODE_ENV takes the value of APP_ENV ('dev' or 'prod'), so
// comparing it with 'production' is not enough
const isProduction = ['prod', 'production'].includes(process.env.NODE_ENV);

// SECURITY: the Debug API exists only when explicitly enabled (never in production)
if (process.env.ENABLE_DEBUG_API === 'true' && !isProduction) {
    app.use('/api/debug', debugRoutes);
    console.warn('[SECURITY] Debug API abilitata: da NON usare su istanze pubbliche.');
}
app.use('/api/public', publicRoutes);

// Health check for Docker/load balancer
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Global error handler
app.use((err, req, res, next) => {
    console.error("[Fatal Error]", err.message);
    res.status(500).json({ error: 'Errore interno del server', details: err.message });
});

module.exports = app;
module.exports.allowedOrigins = allowedOrigins;
