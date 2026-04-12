/* =============================================================================
   FILE: backend/routes/admin/products.js - v2.0
   STATUS: Integro, Completo, Robusto.
   DESC: Gestione Catalogo lato Coordinatore.
   FIX: Allineamento con req.user.verifiedGasId per protezione multi-tenant.
   ============================================================================= */

const express = require('express');
const router = express.Router();
const { verifyGasMembership } = require('../../middlewares/roles');

const getDb = () => global.pool || require('../../config/db');

// Protezione centralizzata per il coordinatore del GAS selezionato
router.use(verifyGasMembership('Coordinatore'));

// GET /api/admin/catalog (o montato sotto /api/admin/products)
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