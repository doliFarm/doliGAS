/* =============================================================================
   FILE: backend/routes/admin/dashboard.js - v2.1
   STATUS: Integro, Completo, Robusto.
   DESC: API statistiche per la Dashboard del Coordinatore.
   FIX: Risolto errore 500 acquisendo il pool DB dinamicamente.
   ============================================================================= */

const express = require('express');
const router = express.Router();
const { verifyGasMembership } = require('../../middlewares/roles');

// Helper interno per coerenza
const getDb = () => global.pool || require('../../config/db');

// Applichiamo la protezione per il GAS selezionato
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

// --- 2. ANALYTICS (Grafici) ---
router.get('/analytics', async (req, res) => {
    const gasId = req.user.verifiedGasId;
    const { startDate, endDate } = req.query;
    const pool = getDb();

    try {
        // Vendite per Produttore
        const [byProducer] = await pool.execute(`
            SELECT pr.business_name as name, SUM(COALESCE(oi.qty_received, oi.quantity) * oi.price_at_order) as value
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN producers pr ON p.producer_id = pr.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.gas_id = ? AND o.created_at BETWEEN ? AND ?
            GROUP BY pr.id
        `, [gasId, startDate, endDate]);

        // Vendite per Categoria
        const [byCategory] = await pool.execute(`
            SELECT c.name, SUM(COALESCE(oi.qty_received, oi.quantity) * oi.price_at_order) as value
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN product_categories c ON p.category_id = c.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.gas_id = ? AND o.created_at BETWEEN ? AND ?
            GROUP BY c.id
        `, [gasId, startDate, endDate]);

        // Prodotti Top
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