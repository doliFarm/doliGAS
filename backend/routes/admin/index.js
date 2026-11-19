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
  FILE: backend/routes/admin/index.js - v18.3
  DESC: main Admin gateway.
  FIX: extended and complete analytics queries.
  =============================================================================
*/

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middlewares/auth');
const { verifyGasMembership } = require('../../middlewares/roles');

// Dynamic DB helper (prevents crashes at startup)
const getDb = () => global.pool || require('../../config/db');

// --- 1. AREA SECURITY ---
// All admin routes require authentication and the Coordinator role for the specific GAS
router.use(authenticateToken);
router.use(verifyGasMembership('Coordinatore')); 

// --- 2. SUBMODULE IMPORTS ---
const memberRoutes = require('./members');
const walletRoutes = require('./wallet');
const cycleRoutes = require('./cycles');
const producerRoutes = require('./producers');
const catalogRoutes = require('./catalog');
const settingsRoutes = require('./settings');
const logisticsRoutes = require('./logistics');
const messagesRoutes = require('./messages');

// --- 3. ROUTE MOUNTING ---
router.use('/members', memberRoutes);
router.use('/wallet', walletRoutes);
router.use('/cycles', cycleRoutes);
router.use('/producers', producerRoutes);
router.use('/catalog', catalogRoutes);
router.use('/settings', settingsRoutes);
router.use('/logistics', logisticsRoutes);
router.use('/messages', messagesRoutes);

// --- 4. CROSS-CUTTING APIS (roles, stats, analytics) ---

/**
 * GET /api/admin/roles
 * Needed to fill the selects in the member registry
 */
router.get('/roles', async (req, res) => {
    const pool = getDb();
    try {
        const [rows] = await pool.execute("SELECT id, name FROM roles ORDER BY id ASC");
        res.json(rows);
    } catch (e) {
        console.error("[Admin Index] Roles error:", e.message);
        res.status(500).json({ error: "Errore recupero ruoli" });
    }
});

/**
 * GET /api/admin/stats
 * Main KPIs for the dashboard (header)
 */
router.get('/stats', async (req, res) => {
    const gasId = req.user.verifiedGasId;
    const pool = getDb();

    try {
        // 1. Total orders and revenue (non-cancelled orders only)
        const [ord] = await pool.execute(
            "SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM orders WHERE gas_id = ? AND status != 'cancelled'", 
            [gasId]
        );
        
        // 2. Active members
        const [members] = await pool.execute(
            "SELECT COUNT(*) as count FROM gas_memberships WHERE gas_id = ? AND is_active = 1",
            [gasId]
        );

        // 3. Active producers
        const [producers] = await pool.execute(
            "SELECT COUNT(*) as count FROM producers WHERE gas_id = ? AND is_active = 1",
            [gasId]
        );

        // 4. Pending top-ups (wallet)
        const [pending] = await pool.execute(
            "SELECT COUNT(*) as count FROM wallet_transactions WHERE gas_id = ? AND status = 'pending'",
            [gasId]
        );

        res.json({ 
            stats: { 
                totalOrdersAmount: parseFloat(ord[0].total).toFixed(2), 
                ordersCount: ord[0].count, 
                activeMembers: members[0].count,
                activeProducers: producers[0].count,
                pendingTopups: pending[0].count
            }
        });
    } catch (e) {
        console.error("[Admin Index] Stats error:", e.message);
        res.status(500).json({ error: "Errore calcolo statistiche" });
    }
});

/**
 * GET /api/admin/analytics
 * Detailed data for the charts (pie, bar, lists)
 */
router.get('/analytics', async (req, res) => {
    const gasId = req.user.verifiedGasId;
    const { startDate, endDate } = req.query;
    const pool = getDb();

    try {
        // A. Sales by producer (pie chart)
        const [byProducer] = await pool.execute(`
            SELECT pr.business_name as name, SUM(COALESCE(oi.qty_received, oi.quantity) * oi.price_at_order) as value
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN producers pr ON p.producer_id = pr.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.gas_id = ? 
              AND o.status != 'cancelled'
              AND o.created_at BETWEEN ? AND ?
            GROUP BY pr.id
            ORDER BY value DESC
        `, [gasId, startDate, endDate]);

        // B. Sales by category (bar chart)
        const [byCategory] = await pool.execute(`
            SELECT c.name, SUM(COALESCE(oi.qty_received, oi.quantity) * oi.price_at_order) as value
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.gas_id = ? 
              AND o.status != 'cancelled'
              AND o.created_at BETWEEN ? AND ?
            GROUP BY c.id
            ORDER BY value DESC
        `, [gasId, startDate, endDate]);

        // C. Top 5 products (list)
        const [byProduct] = await pool.execute(`
            SELECT p.name, pr.business_name as producer, SUM(COALESCE(oi.qty_received, oi.quantity) * oi.price_at_order) as value
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN producers pr ON p.producer_id = pr.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.gas_id = ? 
              AND o.status != 'cancelled'
            GROUP BY p.id 
            ORDER BY value DESC 
            LIMIT 5
        `, [gasId]);

        // D. Top 5 members by spending (optional, useful for analysis)
        const [byMember] = await pool.execute(`
            SELECT u.first_name, u.last_name, SUM(o.total_amount) as value
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.gas_id = ? 
              AND o.status != 'cancelled'
              AND o.created_at BETWEEN ? AND ?
            GROUP BY u.id
            ORDER BY value DESC
            LIMIT 5
        `, [gasId, startDate, endDate]);

        res.json({ 
            byProducer, 
            byCategory: byCategory.map(c => ({ name: c.name || 'Altro', value: c.value })), // Handle null categories
            byProduct,
            byMember
        });

    } catch (e) {
        console.error("[Admin Index] Analytics error:", e.message);
        res.status(500).json({ error: "Errore caricamento analisi dettagliata" });
    }
});

module.exports = router;