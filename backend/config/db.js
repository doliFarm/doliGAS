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
 * doliGAS - Database connection pool configuration (MySQL/MariaDB)
 * -----------------------------------------------------------------------------
 * This module exports a singleton connection pool.
 * It uses 'mysql2/promise' to support async/await across the backend.
 * @module config/db
 */

const mysql = require('mysql2/promise');

// Load settings from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // Balanced for the typical load of a GAS
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true // Keep dates as strings to avoid unwanted time zone offsets
};

/**
 * Sanity check: required credentials must be present.
 * In production the server must stop if the database is not configured.
 */
if (!dbConfig.user || !dbConfig.database) {
  console.error('[CRITICAL] Configurazione Database incompleta nel file .env');
  // We do not call process.exit(1) here so that the server can log the error,
  // but the pool will fail on the first query with a clear error.
}

/**
 * Pool creation.
 * The pool is created only once, when the application starts.
 */
const pool = mysql.createPool(dbConfig);

/**
 * Immediate connection test (fail fast)
 * Checks that the database is reachable when the backend starts.
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
 * Global context injection.
 * For compatibility with existing modules that use global.pool the instance
 * is injected here, but importing the module directly is preferred.
 */
global.pool = pool;

/**
 * Pool export.
 * Usage: const db = require('../config/db');
 * Example: const [rows] = await db.query('SELECT...');
 */
module.exports = pool;