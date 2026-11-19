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
 * Runs once before all tests: creates the test database (if missing)
 * and applies the migrations.
 *
 * Creating the database needs a privileged user: if the root password is available
 * (DB_ROOT_PASSWORD, as in the project .env) it creates it and grants DB_USER
 * access; otherwise the database must already exist (as in CI).
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
