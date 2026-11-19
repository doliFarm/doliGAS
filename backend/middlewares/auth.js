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
 * doliGAS - Authentication and authorization middleware
 * -----------------------------------------------------------------------------
 * This module verifies JSON Web Tokens (JWT) and injects the user/GAS
 * context into authenticated requests.
 * FIX: aligned the export (authenticateToken) to prevent an Express crash.
 * @module middlewares/auth
 */

const jwt = require('jsonwebtoken');

/**
 * Main JWT authentication middleware.
 * Checks that a valid token is present in the Authorization header.
 *
 * Robustness requirements:
 * 1. Refuses to run if the secret key is not configured (fail fast).
 * 2. Handles the different JWT error cases (expired, invalid signature).
 * 3. Preserves the user data for the following middleware.
 */
const auth = (req, res, next) => {
  // Read the secret key from the environment
  const JWT_SECRET = process.env.JWT_SECRET;

  // SECURITY: hard stop when the configuration is missing
  if (!JWT_SECRET) {
    console.error('[CRITICAL] JWT_SECRET non configurato nel file .env');
    return res.status(500).json({ 
      error: 'Errore interno di configurazione del server',
      code: 'AUTH_CONFIG_ERROR' 
    });
  }

  // Extract the token from the Authorization header (format: "Bearer TOKEN")
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Accesso negato. Token mancante.',
      code: 'TOKEN_MISSING'
    });
  }

  try {
    // Token verification
    const decoded = jwt.verify(token, JWT_SECRET);
    
    /**
     * Inject the user context into the request.
     * decoded must contain: { id, email, gas_id, role_id }
     */
    req.user = decoded;
    
    // Monitoring log for debugging (optional, depending on the log level)
    // console.log(`[AUTH] User ${decoded.id} authenticated for GAS ${decoded.gas_id}`);
    
    next();
  } catch (err) {
    // Separate handling of JWT errors, for better UX and security
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Sessione scaduta. Effettuare nuovamente il login.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    res.status(403).json({ 
      error: 'Token non valido o corrotto.',
      code: 'TOKEN_INVALID'
    });
  }
};

/**
 * Optional middleware that extracts the GAS context from a slug or a header.
 * Useful for public operations that still need to tell tenants apart.
 */
const injectGasContext = (req, res, next) => {
  const gasSlug = req.header('X-GAS-Slug') || req.query.gas;
  if (gasSlug) {
    req.gasSlug = gasSlug;
  }
  next();
};



// Exports
module.exports = {
  auth,
  authenticateToken: auth, // <--- CRITICAL FIX: alias used by all routers
  injectGasContext
};