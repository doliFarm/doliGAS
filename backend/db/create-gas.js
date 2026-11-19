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
 * @file backend/db/create-gas.js
 * @description Creates a new GAS with its first Coordinator (new installation or new tenant).
 * Transactional: creates (or reuses) the user, the GAS, the Coordinator membership
 * and the default notification templates.
 *
 * Usage:
 *   npm run create-gas -- --name "GAS Fiesole" --slug fiesole \
 *        --admin-email mario@example.org --admin-first Mario --admin-last Rossi
 */
const mysql = require('mysql2/promise');
const { migrate } = require('./migrate');

const DEFAULT_TEMPLATES = [
    ['G1_OPEN', 'Apertura Listini - {{cycle_name}}', 'Ciao, è aperta la fase di aggiornamento listini per il ciclo {{cycle_name}}. Hai tempo fino al {{deadline}}.'],
    ['G3_SHOP_OPEN', 'Mercato Aperto! 🛒', 'Cari soci, il mercato per {{cycle_name}} è aperto. Chiusura prevista: {{close_date}}.'],
    ['G4_REMINDER', '⏳ 3 Ore alla Chiusura', 'Affrettati! Il mercato per {{cycle_name}} chiude tra 3 ore. Controlla il tuo carrello.'],
    ['G5_PROD_ORDER', 'Nuovi Ordini da Preparare 📦', 'Gli ordini per {{cycle_name}} sono confermati. Accedi alla dashboard per scaricare la lista di preparazione.']
];

const parseArgs = (argv) => {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1];
    }
    return args;
};

const run = async () => {
    require('dotenv').config();
    const a = parseArgs(process.argv.slice(2));
    const missing = ['name', 'slug', 'admin-email', 'admin-first', 'admin-last'].filter(k => !a[k]);
    if (missing.length) throw new Error(`Parametri mancanti: ${missing.map(k => '--' + k).join(', ')}`);
    if (!/^[a-z0-9-]{2,100}$/.test(a.slug)) throw new Error('Lo slug può contenere solo lettere minuscole, numeri e trattini.');
    const email = a['admin-email'].trim().toLowerCase();

    await migrate();

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    try {
        await conn.beginTransaction();
        const [exists] = await conn.execute('SELECT id FROM gas WHERE slug = ?', [a.slug]);
        if (exists.length) throw new Error(`Esiste già un GAS con slug "${a.slug}".`);

        let [users] = await conn.execute('SELECT id FROM users WHERE email = ?', [email]);
        let userId;
        if (users.length) {
            userId = users[0].id;
            console.log(`[CREATE-GAS] Utente esistente riusato: #${userId}`);
        } else {
            const [r] = await conn.execute(
                'INSERT INTO users (first_name, last_name, email) VALUES (?, ?, ?)',
                [a['admin-first'], a['admin-last'], email]
            );
            userId = r.insertId;
        }

        const [g] = await conn.execute(
            'INSERT INTO gas (name, slug, email_contact, created_by) VALUES (?, ?, ?, ?)',
            [a.name, a.slug, email, userId]
        );
        const gasId = g.insertId;
        await conn.execute(
            'INSERT INTO gas_memberships (gas_id, user_id, role_id, created_by) VALUES (?, ?, 1, ?)',
            [gasId, userId, userId]
        );
        for (const [key, subject, body] of DEFAULT_TEMPLATES) {
            await conn.execute(
                'INSERT INTO notification_templates (gas_id, event_key, subject, body) VALUES (?, ?, ?, ?)',
                [gasId, key, subject, body]
            );
        }
        await conn.commit();
        console.log(`[CREATE-GAS] ✅ GAS "${a.name}" (#${gasId}, slug "${a.slug}") creato; coordinatore: ${email}`);
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        await conn.end();
    }
};

run().then(() => process.exit(0)).catch(e => { console.error('[CREATE-GAS] ❌', e.message); process.exit(1); });
