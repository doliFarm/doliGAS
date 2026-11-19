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
 * @file backend/db/seed.js
 * @description Loads demo data (backend/db/seeds/<name>.sql).
 *
 * Safeguards:
 * - refuses to run with NODE_ENV=production;
 * - refuses if the database already contains GAS rows, unless --reset is given;
 * - --reset empties the data tables (NOT the migration history).
 *
 * Usage:  npm run seed:demo
 *         npm run seed:demo -- --reset
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { migrate } = require('./migrate');

// Data tables, emptied by --reset (reference data in roles/product_units is kept).
// The child tables of cycles must be listed too: with constraints disabled, deleting
// does not apply ON DELETE CASCADE, and leftover rows would point to the recreated cycles.
const DATA_TABLES = [
    'cycle_events', 'producer_cycle_supply',
    'notifications', 'notification_templates', 'magic_links', 'wallet_transactions',
    'order_items', 'orders', 'producer_cycle_validations', 'cycles', 'holidays', 'gas_holidays',
    'products', 'product_categories', 'producers', 'gas_memberships', 'user_permissions',
    'users', 'gas', 'leads', 'page_views'
];

/**
 * Loads a seed. Used by the command line and by the tests (backend/test).
 * @param {{ name?: string, reset?: boolean, log?: Function }} options
 */
const loadSeed = async ({ name = 'demo', reset = false, log = console.log } = {}) => {
    if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'prod') {
        throw new Error('Seed rifiutato: ambiente di produzione.');
    }
    const file = path.join(__dirname, 'seeds', `${name}.sql`);
    if (!fs.existsSync(file)) throw new Error(`Seed non trovato: ${file}`);

    // The schema must be up to date before loading the data
    await migrate({ log });

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
        // Emptying and loading in a single transaction: one commit instead of one per
        // statement, and on error the database stays as it was
        await conn.beginTransaction();
        if (reset) {
            // DELETE rather than TRUNCATE: much faster on small tables (the tests run it for every test)
            for (const t of DATA_TABLES) await conn.query(`DELETE FROM \`${t}\``);
            log('[SEED] Tabelle dei dati svuotate.');
        }
        await conn.query(fs.readFileSync(file, 'utf8'));
        await conn.commit();
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        log(`[SEED] ✅ Dati "${name}" caricati.`);
    } finally {
        await conn.end();
    }
};

module.exports = { loadSeed, DATA_TABLES };

// Command line entry point
if (require.main === module) {
    require('dotenv').config();
    loadSeed({ name: process.argv[2] || 'demo', reset: process.argv.includes('--reset') })
        .then(() => process.exit(0))
        .catch(e => { console.error('[SEED] ❌', e.message); process.exit(1); });
}
