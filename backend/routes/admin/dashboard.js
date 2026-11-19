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
  FILE: backend/routes/admin/dashboard.js - v2.1
  DESC: statistics API for the Coordinator dashboard.
  FIX: error 500 resolved by acquiring the DB pool dynamically.
  =============================================================================
*/

const express = require('express');
const router = express.Router();
const { verifyGasMembership } = require('../../middlewares/roles');

// Internal helper, for consistency
const getDb = () => global.pool || require('../../config/db');

// Apply the protection for the selected GAS
router.use(verifyGasMembership('Coordinatore'));

// --- 1. KPI STATS ---
router.get('/stats', async (req, res) => {
    const gasId = req.user.verifiedGasId;
    const pool = getDb();
    
    try {
        const [memberRows] = await pool.execute("SELECT COUNT(*) as count FROM gas_memberships WHERE gas_id = ? AND is_active = 1", [gasId]);
        const [producerRows] = await pool.execute("SELECT COUNT(*) as count FROM producers WHERE gas_id = ? AND is_active = 1", [gasId]);
        const [orderRows] = await pool.execute("SELECT SUM(total_amount) as total FROM orders WHERE gas_id = ? AND status = 'delivered'", [gasId]);

        res.json({
            stats: {
                activeMembers: memberRows[0].count,
                activeProducers: producerRows[0].count,
                totalOrdersAmount: parseFloat(orderRows[0].total || 0).toFixed(2)
            }
        });
    } catch (e) {
        console.error("[DASHBOARD BACKEND] Stats Error:", e.message);
        res.status(500).json({ error: "Errore calcolo statistiche" });
    }
});

// --- 2. ANALYTICS (charts) ---
router.get('/analytics', async (req, res) => {
    const gasId = req.user.verifiedGasId;
    const { startDate, endDate } = req.query;
    const pool = getDb();

    try {
        // Sales by producer
        const [byProducer] = await pool.execute(`
            SELECT pr.business_name as name, SUM(COALESCE(oi.qty_received, oi.quantity) * oi.price_at_order) as value
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN producers pr ON p.producer_id = pr.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.gas_id = ? AND o.created_at BETWEEN ? AND ?
            GROUP BY pr.id
        `, [gasId, startDate, endDate]);

        // Sales by category
        const [byCategory] = await pool.execute(`
            SELECT c.name, SUM(COALESCE(oi.qty_received, oi.quantity) * oi.price_at_order) as value
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN product_categories c ON p.category_id = c.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.gas_id = ? AND o.created_at BETWEEN ? AND ?
            GROUP BY c.id
        `, [gasId, startDate, endDate]);

        // Top products
        const [byProduct] = await pool.execute(`
            SELECT p.name, pr.business_name as producer, SUM(COALESCE(oi.qty_received, oi.quantity) * oi.price_at_order) as value
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN producers pr ON p.producer_id = pr.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.gas_id = ?
            GROUP BY p.id ORDER BY value DESC LIMIT 5
        `, [gasId]);

        res.json({ byProducer, byCategory, byProduct });
    } catch (e) {
        console.error("[DASHBOARD BACKEND] Analytics Error:", e.message);
        res.status(500).json({ error: "Errore caricamento grafici" });
    }
});

module.exports = router;