/**
 * Ambiente dei test: database dedicato e variabili sicure.
 *
 * Usato sia da globalSetup (che gira in un processo a parte) sia da ogni file di
 * test, così entrambi puntano allo stesso database.
 *
 * SICUREZZA: i test svuotano e ricaricano il database a ogni file. Per evitare di
 * cancellare dati veri, il nome del database DEVE finire con "_test".
 */
const path = require('path');

const applyTestEnv = () => {
    // Fuori da Docker legge il .env della radice del progetto (non sovrascrive le variabili già impostate)
    require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

    process.env.NODE_ENV = 'test';
    process.env.DB_NAME = process.env.TEST_DB_NAME || 'doligas_test';
    if (!process.env.DB_NAME.endsWith('_test')) {
        throw new Error(`Rifiuto di eseguire i test sul database "${process.env.DB_NAME}": il nome deve finire con "_test".`);
    }
    // Segreto fisso solo per i test: i token vengono firmati dagli helper
    process.env.JWT_SECRET = 'test-secret-solo-per-i-test-0123456789abcdef';
    process.env.DEMO_SHOW_OTP = 'true';      // il login restituisce il codice
    process.env.SCHEDULER_ENABLED = 'false'; // lo scheduler si prova chiamando runOnce
    process.env.SMTP_HOST = '';              // nessuna email reale: invio simulato
    process.env.ENABLE_DEBUG_API = 'false';
};

module.exports = { applyTestEnv };
