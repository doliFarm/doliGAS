/**
 * @file backend/db/migrate.js
 * @description Motore delle migrazioni del database doliGAS.
 *
 * - Le migrazioni sono file SQL in backend/db/migrations, chiamati NNN_descrizione.sql
 *   ed eseguiti in ordine numerico una sola volta.
 * - Quelle già applicate sono registrate nella tabella `schema_migrations`.
 * - DATABASE ESISTENTE (es. la demo, creata prima delle migrazioni): se la tabella
 *   `schema_migrations` è vuota ma il database contiene già le tabelle dell'app,
 *   la migrazione 001 (schema iniziale) viene registrata come "baseline" senza eseguirla.
 * - Un lock MySQL (GET_LOCK) impedisce esecuzioni concorrenti.
 *
 * Regole per scrivere una nuova migrazione:
 * - mai modificare un file già applicato: si aggiunge un nuovo file con il numero successivo;
 * - in MySQL le istruzioni DDL (CREATE/ALTER/DROP) non sono transazionali: tenere ogni
 *   migrazione piccola e focalizzata.
 *
 * Uso:  npm run migrate            (applica le migrazioni mancanti)
 *       npm run migrate -- --status (mostra lo stato senza modificare nulla)
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
    multipleStatements: true, // un file di migrazione contiene più istruzioni
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
 * Applica le migrazioni mancanti. Restituisce l'elenco delle versioni applicate.
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

        // Baseline per i database creati prima dell'introduzione delle migrazioni
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

        // Avviso se un file già applicato è stato modificato
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

// Esecuzione da riga di comando
if (require.main === module) {
    require('dotenv').config();
    migrate({ statusOnly: process.argv.includes('--status') })
        .then(() => process.exit(0))
        .catch(err => { console.error('[MIGRATE] ❌', err.message); process.exit(1); });
}
