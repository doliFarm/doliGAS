/**
 * doliGAS - Enterprise Resource Planning per Gruppi di Acquisto Solidale
 * Configurazione e Gestione Pool Connessioni Database (MySQL/MariaDB)
 * -----------------------------------------------------------------------------
 * Questo modulo esporta un'istanza singleton del pool di connessioni.
 * Utilizza 'mysql2/promise' per supportare l'async/await in tutto il backend.
 * * @module config/db
 * @license GNU GPLv3 (o successiva)
 */

const mysql = require('mysql2/promise');

// Caricamento variabili d'ambiente (fallback per sicurezza robusta)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // Bilanciamento ottimale per carichi medi GAS
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true // Mantiene le date come stringhe per evitare offset fusi orari non voluti
};

/**
 * Validazione Robustezza: Verifica presenza credenziali obbligatorie.
 * In produzione, il server deve interrompersi se il DB non è configurato.
 */
if (!dbConfig.user || !dbConfig.database) {
  console.error('[CRITICAL] Configurazione Database incompleta nel file .env');
  // Non usiamo process.exit(1) qui per permettere al server di loggare l'errore,
  // ma il pool fallirà alla prima query fornendo un errore chiaro.
}

/**
 * Creazione del Pool.
 * Il pool viene creato una sola volta all'avvio dell'applicazione.
 */
const pool = mysql.createPool(dbConfig);

/**
 * Test di connessione immediato (Self-Healing/Fail-Fast)
 * Verifica che il database sia raggiungibile all'avvio del backend.
 */
pool.getConnection()
  .then(connection => {
    console.log(`[DB] Connesso con successo al database: ${dbConfig.database} su ${dbConfig.host}`);
    connection.release();
  })
  .catch(err => {
    console.error('[ERROR] Impossibile connettersi al Database:', err.message);
  });

/**
 * Integrità: Iniezione nel contesto globale.
 * Per mantenere la compatibilità con i moduli esistenti che utilizzano global.pool,
 * iniettiamo l'istanza qui, ma incoraggiamo l'importazione diretta del modulo.
 */
global.pool = pool;

/**
 * Esportazione del pool.
 * Da utilizzare come: const db = require('../config/db');
 * Esempio: const [rows] = await db.query('SELECT...');
 */
module.exports = pool;