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
 * @file backend/db/migrate.js
 * @description doliGAS database migration engine.
 *
 * - Migrations are SQL files in backend/db/migrations, named NNN_description.sql
 *   and run once, in numeric order.
 * - Applied migrations are recorded in the `schema_migrations` table.
 * - EXISTING DATABASE (e.g. the demo, created before migrations existed): if
 *   `schema_migrations` is empty but the database already has the app tables,
 *   migration 001 (initial schema) is recorded as "baseline" without running it.
 * - A MySQL lock (GET_LOCK) prevents concurrent runs.
 *
 * Rules for writing a new migration:
 * - never modify a file that has already been applied: add a new file with the next number;
 * - in MySQL DDL statements (CREATE/ALTER/DROP) are not transactional: keep each
 *   migration small and focused.
 *
 * Usage:  npm run migrate            (applies the pending migrations)
 *         npm run migrate -- --status (shows the status without changing anything)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const BASELINE_VERSION = '001';
const LOCK_NAME = 'doligas_migrations';

const listMigrations = () => fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d{3}_[\w-]+\.sql$/.test(f))
    .sort()
    .map(file => {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        return {
            version: file.slice(0, 3),
            file,
            sql,
            checksum: crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')
        };
    });

const connect = () => mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true, // a migration file contains several statements
    dateStrings: true
});

const ensureMigrationsTable = (conn) => conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(10) NOT NULL PRIMARY KEY,
        file VARCHAR(255) NOT NULL,
        checksum CHAR(64) NOT NULL,
        is_baseline TINYINT(1) NOT NULL DEFAULT 0,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

const appTablesExist = async (conn) => {
    const [[row]] = await conn.query(
        "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'gas'"
    );
    return row.n > 0;
};

/**
 * Applies the pending migrations. Returns the list of applied versions.
 * @param {{ statusOnly?: boolean, log?: Function }} options
 */
const migrate = async ({ statusOnly = false, log = console.log } = {}) => {
    const migrations = listMigrations();
    const conn = await connect();
    let locked = false;
    try {
        const [[lock]] = await conn.query('SELECT GET_LOCK(?, 60) AS ok', [LOCK_NAME]);
        if (!lock.ok) throw new Error('Impossibile ottenere il lock delle migrazioni (un altro processo le sta eseguendo?)');
        locked = true;

        await ensureMigrationsTable(conn);
        const [rows] = await conn.query('SELECT version, file, checksum, is_baseline FROM schema_migrations ORDER BY version');
        const applied = new Map(rows.map(r => [r.version, r]));

        // Baseline for databases created before migrations were introduced
        if (applied.size === 0 && await appTablesExist(conn)) {
            const base = migrations.find(m => m.version === BASELINE_VERSION);
            if (!base) throw new Error(`Migrazione di baseline ${BASELINE_VERSION} non trovata`);
            if (statusOnly) {
                log(`[MIGRATE] Database esistente senza storico: ${base.file} verrà registrata come baseline.`);
            } else {
                await conn.query(
                    'INSERT INTO schema_migrations (version, file, checksum, is_baseline) VALUES (?, ?, ?, 1)',
                    [base.version, base.file, base.checksum]
                );
                applied.set(base.version, { ...base, is_baseline: 1 });
                log(`[MIGRATE] Database esistente: ${base.file} registrata come baseline (non eseguita).`);
            }
        }

        // Warn if an already applied file has been modified
        for (const m of migrations) {
            const done = applied.get(m.version);
            if (done && done.checksum !== m.checksum) {
                log(`[MIGRATE] ⚠️ ${m.file} è stata modificata dopo essere stata applicata (checksum diverso).`);
            }
        }

        const pending = migrations.filter(m => !applied.has(m.version));
        if (statusOnly) {
            rows.forEach(r => log(`  ✔ ${r.file}${r.is_baseline ? ' (baseline)' : ''}`));
            pending.forEach(m => log(`  … ${m.file} (da applicare)`));
            return pending.map(m => m.version);
        }
        if (pending.length === 0) {
            log('[MIGRATE] Database aggiornato, nessuna migrazione da applicare.');
            return [];
        }

        for (const m of pending) {
            log(`[MIGRATE] Applico ${m.file}...`);
            try {
                await conn.query(m.sql);
            } catch (e) {
                throw new Error(`Migrazione ${m.file} fallita: ${e.message}`);
            }
            await conn.query(
                'INSERT INTO schema_migrations (version, file, checksum) VALUES (?, ?, ?)',
                [m.version, m.file, m.checksum]
            );
        }
        log(`[MIGRATE] ✅ Applicate ${pending.length} migrazioni.`);
        return pending.map(m => m.version);
    } finally {
        if (locked) await conn.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]).catch(() => {});
        await conn.end();
    }
};

module.exports = { migrate, listMigrations };

// Command line entry point
if (require.main === module) {
    require('dotenv').config();
    migrate({ statusOnly: process.argv.includes('--status') })
        .then(() => process.exit(0))
        .catch(err => { console.error('[MIGRATE] ❌', err.message); process.exit(1); });
}
