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

/* =============================================================================
  FILE: backend/middlewares/roles.js - v3.2
  DESC: Middleware that checks roles and GAS membership.
  FIX: injects verifiedGasId to support the multi-profile architecture.
  =============================================================================
*/

const getDb = () => global.pool || require('../config/db');

/**
 * Middleware: verifyGasMembership
 * Checks that the user belongs to the requested GAS and has the required role.
 * Reads the GAS id from the query string, body or params.
 */
const verifyGasMembership = (requiredRole = null) => {
    return async (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Autenticazione richiesta' });

        // Read the gasId sent by the frontend
        // SECURITY: gasId may come from query, body or params, but there must be only ONE value.
        // Different values across the sources are rejected, to prevent access to another GAS.
        const sources = [req.query?.gasId, req.body?.gasId, req.params?.gasId]
            .filter(v => v !== undefined && v !== null && v !== '');
        const gasId = sources[0];

        if (!gasId) {
            return res.status(400).json({ error: 'Contesto GAS non specificato (gasId mancante)' });
        }
        if (!/^\d+$/.test(String(gasId)) || sources.some(v => String(v) !== String(gasId))) {
            return res.status(400).json({ error: 'Contesto GAS non valido o incoerente' });
        }

        try {
            const pool = getDb();
            const [rows] = await pool.execute(
                `SELECT gm.role_id, r.name as role_name 
                 FROM gas_memberships gm 
                 JOIN roles r ON gm.role_id = r.id
                 WHERE gm.user_id = ? AND gm.gas_id = ? AND gm.is_active = 1`,
                [req.user.id, gasId]
            );

            if (rows.length === 0) {
                console.warn(`[SECURITY] Accesso negato: Utente ${req.user.id} ha tentato di accedere al GAS ${gasId}`);
                return res.status(403).json({ error: 'Accesso non autorizzato a questo GAS' });
            }

            const membership = rows[0];

            // Role check (if required)
            if (requiredRole && membership.role_name !== requiredRole) {
                return res.status(403).json({ error: `Privilegi di ${requiredRole} necessari` });
            }

            // ESSENTIAL INJECTION:
            // store the validated gasId for the following routes
            req.user.verifiedGasId = parseInt(gasId);
            req.user.role = membership.role_name;
            
            next();
        } catch (e) {
            console.error("[ROLES MIDDLEWARE] Error:", e.message);
            res.status(500).json({ error: 'Errore interno verifica permessi' });
        }
    };
};

const requireAdmin = verifyGasMembership('Coordinatore');

module.exports = { requireAdmin, verifyGasMembership };