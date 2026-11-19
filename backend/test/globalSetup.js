/**
 * Eseguito una volta prima di tutti i test: crea il database di test (se manca)
 * e applica le migrazioni.
 *
 * Per creare il database serve un utente con i privilegi: se è disponibile la
 * password di root (DB_ROOT_PASSWORD, come nel .env del progetto) lo crea e dà i
 * permessi a DB_USER; altrimenti il database deve esistere già (come in CI).
 */
const mysql = require('mysql2/promise');
const { applyTestEnv } = require('./testEnv');

module.exports = async () => {
    applyTestEnv();
    const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_ROOT_PASSWORD } = process.env;

    if (DB_ROOT_PASSWORD) {
        const root = await mysql.createConnection({
            host: DB_HOST || 'localhost',
            port: DB_PORT ? parseInt(DB_PORT) : 3306,
            user: 'root',
            password: DB_ROOT_PASSWORD
        });
        try {
            await root.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4`);
            if (DB_USER && DB_USER !== 'root') {
                await root.query(`GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO ?@'%'`, [DB_USER]);
            }
        } finally {
            await root.end();
        }
    }

    const { migrate } = require('../db/migrate');
    await migrate({ log: () => {} });
};
