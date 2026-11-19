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

export const APP_CONFIG = {
  // Session length in minutes (read from env, falls back to 120)
  SESSION_DURATION_MINUTES: Number(import.meta.env.VITE_SESSION_DURATION_MINUTES) || 120,

  // API endpoint
  // In production behind Nginx it MUST be an empty string '' (to use relative paths)
  // In local development without Docker you may want to point to localhost:3000
  API_URL: import.meta.env.VITE_API_URL || '',
  APP_ENV: import.meta.env.VITE_APP_ENV || 'prod',
  // "This is a demo" notice at login: demo instance only
  DEMO_MODE: import.meta.env.VITE_DEMO_MODE === 'true',
  // Default routes per role
  DEFAULT_ROUTES: {
    admin: '/admin',
    producer: '/producer',
    member: '/app'
  }
};
