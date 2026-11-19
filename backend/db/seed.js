/**
 * @file backend/db/seed.js
 * @description Carica i dati dimostrativi (backend/db/seeds/<nome>.sql).
 *
 * Sicurezze:
 * - rifiuta di partire con NODE_ENV=production;
 * - rifiuta se il database contiene già dei GAS, a meno di --reset;
 * - con --reset svuota le tabelle dei dati (NON lo storico delle migrazioni).
 *
 * Uso:  npm run seed:demo
 *       npm run seed:demo -- --reset
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { migrate } = require('./migrate');

// Tabelle dei dati, svuotate con --reset (i dati di riferimento roles/product_units restano)
const DATA_TABLES = [
    'notifications', 'notification_templates', 'magic_links', 'wallet_transactions',
    'order_items', 'orders', 'producer_cycle_validations', 'cycles', 'holidays', 'gas_holidays',
    'products', 'product_categories', 'producers', 'gas_memberships', 'user_permissions',
    'users', 'gas', 'leads', 'page_views'
];

const run = async () => {
    require('dotenv').config();
    const name = process.argv[2] || 'demo';
    const reset = process.argv.includes('--reset');

    if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'prod') {
        throw new Error('Seed rifiutato: ambiente di produzione.');
    }
    const file = path.join(__dirname, 'seeds', `${name}.sql`);
    if (!fs.existsSync(file)) throw new Error(`Seed non trovato: ${file}`);

    // Lo schema deve essere aggiornato prima di caricare i dati
    await migrate();

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });
    try {
        const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM gas');
        if (n > 0 && !reset) {
            throw new Error(`Il database contiene già ${n} GAS. Usa --reset per svuotarlo (solo sviluppo).`);
        }
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        if (reset) {
            for (const t of DATA_TABLES) await conn.query(`TRUNCATE TABLE \`${t}\``);
            console.log('[SEED] Tabelle dei dati svuotate.');
        }
        await conn.query(fs.readFileSync(file, 'utf8'));
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log(`[SEED] ✅ Dati "${name}" caricati.`);
    } finally {
        await conn.end();
    }
};

run().then(() => process.exit(0)).catch(e => { console.error('[SEED] ❌', e.message); process.exit(1); });
