/**
 * @file backend/app.js
 * @description Applicazione Express di doliGAS: middleware e rotte, senza avvio.
 *
 * È separata da server.js perché i test (backend/test) la caricano con supertest
 * senza aprire una porta, attendere il database o far partire lo scheduler.
 * Le variabili d'ambiente devono essere già caricate quando si richiede questo modulo.
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Usato dalla Debug API; server.js lo riempie intercettando console.log
global.logBuffer = global.logBuffer || [];

// 1. Risorse e rotte
const pool = require('./config/db');
global.pool = pool;

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const memberRoutes = require('./routes/members');
const adminRoutes = require('./routes/admin/index');
const debugRoutes = require('./routes/debug');
const publicRoutes = require('./routes/public');

const app = express();

// 2. CORS: solo le origini note
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
// Nei test il log di ogni richiesta è solo rumore
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// 3. Rotte
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/admin', adminRoutes);
// In questo progetto NODE_ENV vale quanto APP_ENV ('dev' o 'prod'), quindi
// non basta confrontarlo con 'production'
const isProduction = ['prod', 'production'].includes(process.env.NODE_ENV);

// SICUREZZA: la Debug API esiste solo se abilitata esplicitamente (mai in produzione)
if (process.env.ENABLE_DEBUG_API === 'true' && !isProduction) {
    app.use('/api/debug', debugRoutes);
    console.warn('[SECURITY] Debug API abilitata: da NON usare su istanze pubbliche.');
}
app.use('/api/public', publicRoutes);

// Health Check per Docker/LoadBalancer
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Gestore globale degli errori
app.use((err, req, res, next) => {
    console.error("[Fatal Error]", err.message);
    res.status(500).json({ error: 'Errore interno del server', details: err.message });
});

module.exports = app;
module.exports.allowedOrigins = allowedOrigins;
