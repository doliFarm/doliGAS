/**
 * @file backend/server.js
 * @description Application Entry Point - Versione Consolidata v1.1
 * STATUS: Production Ready
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// 1. Inizializzazione Log Buffer (In-Memory per Debug Console)
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

// 2. Importazione Risorse e Rotte
const pool = require('./config/db');
global.pool = pool;

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const memberRoutes = require('./routes/members');
const adminRoutes = require('./routes/admin/index'); 
const debugRoutes = require('./routes/debug');
const publicRoutes = require('./routes/public');

const app = express();
const PORT = process.env.PORT || 3000;

// 3. Configurazione CORS Robusta
// Risolve l'errore: "blocked by CORS policy"
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
app.use(morgan('dev'));

// 4. Mapping Rotte
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/admin', adminRoutes); 
app.use('/api/debug', debugRoutes);
app.use('/api/public', publicRoutes);

// Health Check per Docker/LoadBalancer
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("[Fatal Error]", err.message);
    res.status(500).json({ error: 'Errore interno del server', details: err.message });
});

// 5. Avvio Server con Retry Logic (Self-Healing)
const startServer = async () => {
    let retries = 5;
    while (retries > 0) {
        try {
            await pool.query('SELECT 1');
            app.listen(PORT, '0.0.0.0', () => {
                console.log(`🚀 Backend doliGAS online su porta ${PORT}`);
                console.log(`🌍 CORS abilitato per: ${allowedOrigins.join(', ')}`);
            });
            return; 
        } catch (err) {
            retries -= 1;
            console.error(`❌ DB Offline. Tentativi rimasti: ${retries}. Errore: ${err.message}`);
            await new Promise(res => setTimeout(res, 5000));
        }
    }
    process.exit(1);
};

startServer();