/**
 * @file backend/server.js
 * @description Avvio del backend doliGAS: attende il database, applica le migrazioni,
 * avvia lo scheduler e apre la porta. L'applicazione Express è in app.js.
 */
require('dotenv').config();

// SICUREZZA: senza un JWT_SECRET robusto il server non deve partire
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('[CRITICAL] JWT_SECRET mancante o troppo corto (minimo 32 caratteri). Avvio interrotto.');
    process.exit(1);
}

// 1. Log in memoria per la console di debug (ultimi 100 messaggi)
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

// Avviso ripetuto all'avvio: espone i codici di accesso, va usato solo sulle demo
if (process.env.DEMO_SHOW_OTP === 'true') {
    console.warn('[SECURITY] ⚠️ DEMO_SHOW_OTP attivo: il codice di accesso viene restituito');
    console.warn('[SECURITY] ⚠️ nella risposta di login. Solo per istanze dimostrative con dati finti.');
}

// 2. Applicazione e risorse
const app = require('./app');
const { allowedOrigins } = require('./app');
const pool = require('./config/db');
const { migrate } = require('./db/migrate');
const runScheduler = require('./cron/scheduler');

const PORT = process.env.PORT || 3000;

// 3. Avvio con attesa del database
const startServer = async () => {
    // 3a. Attesa del database (il container MySQL può essere più lento a partire)
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

    // 3b. Migrazioni dello schema (disattivabili con DB_AUTO_MIGRATE=false)
    if (process.env.DB_AUTO_MIGRATE !== 'false') {
        try {
            await migrate();
        } catch (err) {
            console.error('[MIGRATE] ❌ Avvio interrotto:', err.message);
            process.exit(1);
        }
    }

    // 3c. Automazione del ciclo G1-G7
    runScheduler();

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Backend doliGAS online su porta ${PORT}`);
        console.log(`🌍 CORS abilitato per: ${allowedOrigins.join(', ')}`);
    });
};

startServer();
