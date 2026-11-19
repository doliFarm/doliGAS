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
  FILE: backend/routes/admin/products.js - v2.0
  DESC: catalog management for the Coordinator.
  FIX: aligned with req.user.verifiedGasId for multi-tenant protection.
  =============================================================================
*/

const express = require('express');
const router = express.Router();
const { verifyGasMembership } = require('../../middlewares/roles');

const getDb = () => global.pool || require('../../config/db');

// Central protection for the coordinator of the selected GAS
router.use(verifyGasMembership('Coordinatore'));

// GET /api/admin/catalog (or mounted under /api/admin/products)
router.get('/', async (req, res) => {
    const pool = getDb();
    const gasId = req.user.verifiedGasId;

    try {
        const query = `
            SELECT p.*, pr.business_name as producer_name, c.name as category_name, u.symbol as unit
            FROM products p
            JOIN producers pr ON p.producer_id = pr.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            JOIN product_units u ON p.unit_id = u.id
            WHERE pr.gas_id = ? AND p.is_active = 1
            ORDER BY pr.business_name, p.name
        `;
        const [rows] = await pool.execute(query, [gasId]);
        res.json(rows);
    } catch (err) {
        console.error("[ADMIN_PRODUCTS] Error:", err.message);
        res.status(500).json({ error: 'Errore recupero catalogo GAS' });
    }
});

module.exports = router;