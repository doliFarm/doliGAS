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

// backend/utils/logger.js

const isDev = process.env.NODE_ENV !== 'production';

const logger = {
	    info: (msg, data = null) => {
		            // Only verify stringify if data exists to keep logs clean
		            if (data) {
				                console.log(`[INFO] ${msg}`, JSON.stringify(data, null, 2));
				            } else {
						                console.log(`[INFO] ${msg}`);
						            }
		        },
	    
	    // Logs full error details to server console
	    error: (msg, error) => {
		            console.error(`[ERROR] ${msg}`);
		            if (error) {
				                // Log stack trace if available, otherwise the error object
				                console.error(error.stack || error);
				            }
		        },

	    // Sanitize error for frontend responses
	    sanitizeError: (error) => {
		            if (isDev) return error.message; // In dev, show details to frontend
		            return 'INTERNAL_SERVER_ERROR';  // In prod, hide details for security
		        }
};

module.exports = logger;
