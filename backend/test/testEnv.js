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
 * Test environment: dedicated database and safe variables.
 *
 * Used both by globalSetup (which runs in a separate process) and by every test
 * file, so that both point to the same database.
 *
 * SECURITY: the tests empty and reload the database for every file. To avoid
 * wiping real data, the database name MUST end with "_test".
 */
const path = require('path');

const applyTestEnv = () => {
    // Outside Docker, read the .env in the project root (variables already set are not overridden)
    require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

    process.env.NODE_ENV = 'test';
    process.env.DB_NAME = process.env.TEST_DB_NAME || 'doligas_test';
    if (!process.env.DB_NAME.endsWith('_test')) {
        throw new Error(`Rifiuto di eseguire i test sul database "${process.env.DB_NAME}": il nome deve finire con "_test".`);
    }
    // Fixed secret for tests only: the helpers sign the tokens
    process.env.JWT_SECRET = 'test-secret-solo-per-i-test-0123456789abcdef';
    process.env.DEMO_SHOW_OTP = 'true';      // login returns the code
    process.env.SCHEDULER_ENABLED = 'false'; // the scheduler is tested by calling runOnce
    process.env.SMTP_HOST = '';              // no real email: sending is simulated
    process.env.ENABLE_DEBUG_API = 'false';
};

module.exports = { applyTestEnv };
