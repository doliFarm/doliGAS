/**
 * doliGAS - Enterprise Resource Planning per Gruppi di Acquisto Solidale
 * Modulo Gestione Catalogo, Produttori e Categorie
 * -----------------------------------------------------------------------------
 * FILE: backend/routes/admin/catalog.js
 * STATUS: Integro, Completo, Robusto.
 * FIX: Risoluzione Error 500 (Sanitizzazione tipi e fallback context GAS).
 */

const express = require('express');
const router = express.Router();

/**
 * Helper per acquisire il pool di connessioni singleton.
 */
const getDb = () => global.pool || require('../../config/db');

/**
 * Helper interno per estrarre il gasId in modo robusto da vari contesti
 */
const getGasId = (req) => req.user?.verifiedGasId || req.body?.gasId || req.user?.gas_id;

// =============================================================================
// SEZIONE PRODOTTI (CATALOGO)
// =============================================================================

/**
 * GET /api/admin/catalog
 * Recupera l'elenco prodotti con JOIN su produttori, categorie, unità E STATO VALIDAZIONE.
 */
router.get('/', async (req, res) => {
    const pool = getDb();
    const gasId = getGasId(req);

    if (!gasId) return res.status(400).json({ error: "Contesto GAS mancante." });

    try {
        const [rows] = await pool.execute(`
            SELECT 
                p.*, 
                pr.business_name as producer_name,
                c.name as category_name,
                u.symbol as unit_symbol,
                (SELECT COUNT(*) FROM order_items oi 
                 JOIN orders o ON oi.order_id = o.id 
                 WHERE oi.product_id = p.id AND o.gas_id = ? AND o.status IN ('draft', 'confirmed')) as active_orders_count,
                
                -- SUBQUERY ROBUSTA: Verifica la validazione senza duplicare le righe
                IFNULL((
                    SELECT 1 
                    FROM producer_cycle_validations v
                    JOIN cycles cy ON v.cycle_id = cy.id
                    WHERE v.producer_id = p.producer_id 
                      AND cy.gas_id = ? 
                      AND cy.is_active = 1 
                      AND cy.delivery_at > NOW()
                    LIMIT 1
                ), 0) as is_validated

            FROM products p
            JOIN producers pr ON p.producer_id = pr.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            LEFT JOIN product_units u ON p.unit_id = u.id
            WHERE pr.gas_id = ?
            ORDER BY pr.business_name ASC, p.name ASC
        `, [gasId, gasId, gasId]); // I 3 parametri mappano i tre '?' nella query
        
        res.json(rows);
    } catch (e) {
        console.error("[CATALOG] Critical Fetch Error:", e.message);
        res.status(500).json({ error: "Errore nel caricamento del catalogo." });
    }
});

/**
 * POST /api/admin/catalog/products
 * Crea o aggiorna un prodotto con protezione transazionale e sanitizzazione.
 */
router.post('/products', async (req, res) => {
    const pool = getDb();
    const conn = await pool.getConnection();
    const gasId = getGasId(req);
    const adminId = req.user.id;

    try {
        const { 
            id, name, producer_id, category_id, unit_id,
            price, stock, min_order_qty, is_active
        } = req.body;

        // 1. Validazione Formale (Previene crash SQL)
        if (!gasId) throw new Error("Sessione non valida: GAS ID mancante.");
        if (!producer_id || !unit_id || !name) throw new Error("Dati obbligatori mancanti.");

        await conn.beginTransaction();

        // 2. Verifica Autorizzazione Multi-tenant
        const [prodCheck] = await conn.execute(
            "SELECT id FROM producers WHERE id = ? AND gas_id = ?",
            [producer_id, gasId]
        );
        if (prodCheck.length === 0) throw new Error("Produttore non autorizzato per questo GAS.");

        // 3. Sanitizzazione Valori (NULL invece di stringhe vuote)
        const cleanCategoryId = (category_id && category_id !== '') ? parseInt(category_id) : null;
        const cleanStock = (stock !== undefined && stock !== '' && stock !== null) ? parseFloat(stock) : null;
        const cleanPrice = parseFloat(price) || 0;
        const cleanMinQty = parseInt(min_order_qty) || 1;
        const activeFlag = is_active ? 1 : 0;

        if (id) {
            // MODIFICA PRODOTTO ESISTENTE
            const [active] = await conn.execute(`
                SELECT COUNT(*) as count FROM order_items oi 
                JOIN orders o ON oi.order_id = o.id 
                WHERE oi.product_id = ? AND o.status IN ('draft', 'confirmed')
            `, [id]);

            if (active[0].count > 0) {
                // Ordini attivi: Safe Update (Protezione integrità prezzi)
                await conn.execute(`
                    UPDATE products SET 
                        name=?, category_id=?, is_active=?, updated_by=?, updated_at=NOW()
                    WHERE id=?`,
                    [name, cleanCategoryId, activeFlag, adminId, id]
                );
            } else {
                // Nessun ordine: Aggiornamento Totale
                await conn.execute(`
                    UPDATE products SET 
                        name=?, producer_id=?, category_id=?, unit_id=?,
                        price=?, stock=?, min_order_qty=?, is_active=?, 
                        updated_by=?, updated_at=NOW()
                    WHERE id=?`,
                    [name, producer_id, cleanCategoryId, unit_id, cleanPrice, cleanStock, cleanMinQty, activeFlag, adminId, id]
                );
            }
        } else {
            // INSERIMENTO NUOVO PRODOTTO
            await conn.execute(`
                INSERT INTO products 
                (producer_id, category_id, unit_id, name, price, stock, min_order_qty, is_active, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [producer_id, cleanCategoryId, unit_id, name, cleanPrice, cleanStock, cleanMinQty, activeFlag, adminId, adminId]
            );
        }

        await conn.commit();
        res.json({ success: true });
    } catch (e) {
        if (conn) await conn.rollback();
        console.error("[CATALOG ADMIN] Save Error:", e.message);
        res.status(500).json({ error: e.message });
    } finally {
        if (conn) conn.release();
    }
});

/**
 * PATCH /api/admin/catalog/bulk-status
 * Azione massiva per attivazione/disattivazione prodotti.
 */
router.patch('/bulk-status', async (req, res) => {
    const { ids, is_active } = req.body;
    const gasId = getGasId(req);

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Nessun prodotto selezionato." });
    }

    const pool = getDb();
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        
        const activeFlag = is_active ? 1 : 0;
        const query = `
            UPDATE products p
            JOIN producers pr ON p.producer_id = pr.id
            SET p.is_active = ?, p.updated_at = NOW(), p.updated_by = ?
            WHERE p.id IN (${ids.map(() => '?').join(',')}) AND pr.gas_id = ?
        `;
        
        await conn.execute(query, [activeFlag, req.user.id, ...ids, gasId]);
        
        await conn.commit();
        res.json({ success: true, message: `${ids.length} prodotti aggiornati.` });
    } catch (e) {
        if (conn) await conn.rollback();
        console.error("[CATALOG] Bulk Update Error:", e.message);
        res.status(500).json({ error: "Errore durante l'aggiornamento massivo." });
    } finally {
        if (conn) conn.release();
    }
});

// =============================================================================
// SEZIONE PRODUTTORI
// =============================================================================

router.get('/producers', async (req, res) => {
    const pool = getDb();
    const gasId = getGasId(req);
    try {
        const [rows] = await pool.execute(
            "SELECT * FROM producers WHERE gas_id = ? ORDER BY business_name ASC", 
            [gasId]
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: "Errore caricamento produttori" });
    }
});

router.post('/producers', async (req, res) => {
    const pool = getDb();
    const gasId = getGasId(req);
    const { id, business_name, contact_name, contact_email, contact_phone, address, iban, internal_notes, is_active } = req.body;

    try {
        const activeFlag = is_active ? 1 : 0;
        if (id) {
            await pool.execute(`
                UPDATE producers SET 
                business_name=?, contact_name=?, contact_email=?, contact_phone=?, address=?, iban=?, internal_notes=?, is_active=?, updated_at=NOW()
                WHERE id=? AND gas_id=?`,
                [business_name, contact_name, contact_email, contact_phone, address, iban, internal_notes, activeFlag, id, gasId]
            );
        } else {
            await pool.execute(`
                INSERT INTO producers (gas_id, business_name, contact_name, contact_email, contact_phone, address, iban, internal_notes, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [gasId, business_name, contact_name, contact_email, contact_phone, address, iban, internal_notes, activeFlag]
            );
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =============================================================================
// SEZIONE CATEGORIE E UNITÀ
// =============================================================================

router.get('/categories', async (req, res) => {
    const pool = getDb();
    const gasId = getGasId(req);
    try {
        const [rows] = await pool.execute(
            "SELECT * FROM product_categories WHERE gas_id = ? ORDER BY name ASC", 
            [gasId]
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: "Errore caricamento categorie" });
    }
});

router.get('/units', async (req, res) => {
    const pool = getDb();
    try {
        const [rows] = await pool.execute("SELECT * FROM product_units ORDER BY name ASC");
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: "Errore caricamento unità" });
    }
});

// =============================================================================
// SEZIONE ELIMINAZIONE
// =============================================================================

/**
 * DELETE /api/admin/catalog/:id
 * Gestisce Hard Delete (se mai usato) o Soft Delete (se presente in ordini).
 */
router.delete('/:id', async (req, res) => {
    const pool = getDb();
    const gasId = getGasId(req);
    const productId = req.params.id;

    try {
        // 1. Verifica integrità referenziale in order_items (storico ordini)
        const [usage] = await pool.execute("SELECT id FROM order_items WHERE product_id = ? LIMIT 1", [productId]);
        
        if (usage.length > 0) {
            // Preserva i dati storici disattivando il prodotto invece di cancellarlo
            await pool.execute("UPDATE products SET is_active = 0 WHERE id = ?", [productId]);
            return res.json({ success: true, message: "Archiviato causa storico ordini." });
        }

        // 2. Eliminazione fisica (solo se appartiene al GAS)
        const [result] = await pool.execute(`
            DELETE p FROM products p 
            JOIN producers pr ON p.producer_id = pr.id 
            WHERE p.id = ? AND pr.gas_id = ?
        `, [productId, gasId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Prodotto non trovato o non autorizzato." });
        }

        res.json({ success: true });
    } catch (e) {
        console.error("[CATALOG] Delete Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;