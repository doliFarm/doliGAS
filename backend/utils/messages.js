// backend/utils/messages.js

const messages = {
    it: {
        MISSING_DATA: 'Dati mancanti',
        DB_ERROR: 'Errore Database',
        GAS_NOT_FOUND: 'GAS non trovato',
        USER_FOUND_MSG: 'Se sei iscritto, riceverai il link.', // Security-wise vague
        LINK_SENT: 'Link inviato!',
        SERVER_ERROR: 'Errore Server',
        EMAIL_SUBJECT: 'Tuo Link di Accesso GAS'
    },
    en: {
        MISSING_DATA: 'Missing data',
        DB_ERROR: 'Database Error',
        GAS_NOT_FOUND: 'GAS not found',
        USER_FOUND_MSG: 'If you are registered, you will receive a link.',
        LINK_SENT: 'Link sent!',
        SERVER_ERROR: 'Server Error',
        EMAIL_SUBJECT: 'Your GAS Access Link'
    }
};

// Default to Italian for now, extensible later based on request headers
const getMessage = (key, lang = 'it') => {
    return messages[lang][key] || key;
};

module.exports = { getMessage };
