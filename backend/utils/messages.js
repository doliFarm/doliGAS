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
