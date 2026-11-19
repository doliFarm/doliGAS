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
// SICUREZZA: solo il gasId verificato dal middleware verifyGasMembership
const getGasId = (req) => req.user?.verifiedGasId;

const { parseCsv, parseNumber, parseBool } = require('../../utils/csv');

// Limite di righe per un import, per non bloccare il server con un file enorme
const MAX_IMPORT_ROWS = 2000;

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
// SEZIONE IMPORT DA CSV
// =============================================================================

/**
 * Colonne accettate nel CSV. La prima è il nome canonico, le altre sono alias
 * (anche in inglese) riconosciuti nell'intestazione.
 */
const CSV_COLUMNS = {
    nome: ['nome', 'prodotto', 'name', 'product'],
    produttore: ['produttore', 'fornitore', 'producer', 'supplier'],
    categoria: ['categoria', 'category'],
    unita: ['unita', 'unitadimisura', 'um', 'unit'],
    prezzo: ['prezzo', 'price'],
    stock: ['stock', 'disponibilita', 'quantita'],
    minordine: ['minordine', 'minimoordine', 'minorderqty', 'moq'],
    attivo: ['attivo', 'active', 'isactive']
};

/** Trova il valore di una colonna logica in una riga, provando tutti gli alias. */
const pick = (row, key) => {
    for (const alias of CSV_COLUMNS[key]) {
        if (row[alias] !== undefined && String(row[alias]).trim() !== '') return String(row[alias]).trim();
    }
    return '';
};

/** Carica le anagrafiche del GAS necessarie a risolvere i nomi del CSV in identificativi. */
const loadLookups = async (pool, gasId) => {
    const [producers] = await pool.execute(
        "SELECT id, business_name FROM producers WHERE gas_id = ? AND is_active = 1", [gasId]);
    const [categories] = await pool.execute(
        "SELECT id, name FROM product_categories WHERE gas_id = ?", [gasId]);
    const [units] = await pool.execute("SELECT id, name, symbol FROM product_units");

    const key = (s) => String(s).trim().toLowerCase();
    return {
        producers: new Map(producers.map(p => [key(p.business_name), p.id])),
        categories: new Map(categories.map(c => [key(c.name), c.id])),
        units: new Map([
            ...units.map(u => [key(u.symbol), u.id]),
            ...units.map(u => [key(u.name), u.id])
        ]),
        names: {
            producers: producers.map(p => p.business_name),
            categories: categories.map(c => c.name),
            units: units.map(u => u.symbol)
        }
    };
};

/**
 * Controlla una riga e restituisce { row, errors }.
 * row contiene già gli identificativi risolti, pronti per l'inserimento.
 */
const validateRow = (raw, lookups) => {
    const errors = [];
    const key = (s) => String(s).trim().toLowerCase();

    const nome = pick(raw, 'nome');
    if (!nome) errors.push('nome del prodotto mancante');
    if (nome.length > 255) errors.push('nome troppo lungo (massimo 255 caratteri)');

    const produttore = pick(raw, 'produttore');
    const producerId = lookups.producers.get(key(produttore));
    if (!produttore) errors.push('produttore mancante');
    else if (!producerId) errors.push(`produttore "${produttore}" non presente fra quelli attivi del GAS`);

    const unita = pick(raw, 'unita');
    const unitId = lookups.units.get(key(unita));
    if (!unita) errors.push('unità di misura mancante');
    else if (!unitId) errors.push(`unità "${unita}" non riconosciuta (ammesse: ${lookups.names.units.join(', ')})`);

    const categoria = pick(raw, 'categoria');
    let categoryId = null;
    if (categoria) {
        categoryId = lookups.categories.get(key(categoria));
        if (!categoryId) errors.push(`categoria "${categoria}" non presente nel GAS`);
    }

    const prezzo = parseNumber(pick(raw, 'prezzo'));
    if (prezzo === null) errors.push('prezzo mancante');
    else if (Number.isNaN(prezzo) || prezzo < 0) errors.push('prezzo non valido');

    const stock = parseNumber(pick(raw, 'stock'));
    if (Number.isNaN(stock)) errors.push('stock non valido');

    const minOrdine = parseNumber(pick(raw, 'minordine'));
    if (Number.isNaN(minOrdine) || (minOrdine !== null && minOrdine <= 0)) errors.push('minimo d\'ordine non valido');

    return {
        row: {
            line: raw._line,
            name: nome,
            producer_id: producerId || null,
            producer_name: produttore,
            category_id: categoryId,
            unit_id: unitId || null,
            price: prezzo,
            stock: stock,
            min_order_qty: minOrdine === null ? 1 : minOrdine,
            is_active: parseBool(pick(raw, 'attivo'), true) ? 1 : 0
        },
        errors
    };
};

/**
 * Rivalidazione delle righe che il client rimanda indietro per l'import.
 * I dati arrivano già risolti in identificativi, ma non sono attendibili:
 * qui si verifica che ogni identificativo appartenga davvero a questo GAS.
 */
const validatePayloadRow = (p, lookups) => {
    const errors = [];
    const producerIds = new Set(lookups.producers.values());
    const categoryIds = new Set(lookups.categories.values());
    const unitIds = new Set(lookups.units.values());

    const name = String(p.name ?? '').trim();
    if (!name) errors.push('nome del prodotto mancante');
    if (name.length > 255) errors.push('nome troppo lungo (massimo 255 caratteri)');

    const producerId = Number(p.producer_id);
    if (!producerIds.has(producerId)) errors.push('produttore non valido per questo GAS');

    const unitId = Number(p.unit_id);
    if (!unitIds.has(unitId)) errors.push('unità di misura non valida');

    let categoryId = null;
    if (p.category_id !== null && p.category_id !== undefined && p.category_id !== '') {
        categoryId = Number(p.category_id);
        if (!categoryIds.has(categoryId)) errors.push('categoria non valida per questo GAS');
    }

    const price = Number(p.price);
    if (!Number.isFinite(price) || price < 0) errors.push('prezzo non valido');

    let stock = null;
    if (p.stock !== null && p.stock !== undefined && p.stock !== '') {
        stock = Number(p.stock);
        if (!Number.isFinite(stock) || stock < 0) errors.push('stock non valido');
    }

    const minOrderQty = Number(p.min_order_qty ?? 1);
    if (!Number.isFinite(minOrderQty) || minOrderQty <= 0) errors.push('minimo d\'ordine non valido');

    return {
        row: {
            name, producer_id: producerId, category_id: categoryId, unit_id: unitId,
            price, stock, min_order_qty: minOrderQty, is_active: p.is_active ? 1 : 0
        },
        errors
    };
};

/**
 * POST /api/admin/catalog/validate
 * Controlla il CSV senza scrivere niente e restituisce il riepilogo che il
 * frontend mostra prima di confermare l'import.
 */
router.post('/validate', async (req, res) => {
    const pool = getDb();
    const gasId = getGasId(req);
    const { csvData } = req.body;

    if (!gasId) return res.status(400).json({ error: "Contesto GAS mancante." });
    if (!csvData || typeof csvData !== 'string') return res.status(400).json({ error: "Nessun contenuto CSV ricevuto." });

    try {
        const { rows, headers, separator } = parseCsv(csvData);
        if (rows.length === 0) {
            return res.status(400).json({ error: "Il file non contiene righe oltre all'intestazione." });
        }
        if (rows.length > MAX_IMPORT_ROWS) {
            return res.status(400).json({ error: `Il file contiene ${rows.length} righe: il massimo è ${MAX_IMPORT_ROWS}.` });
        }

        const lookups = await loadLookups(pool, gasId);
        const validRows = [];
        const errors = [];

        rows.forEach(raw => {
            const { row, errors: rowErrors } = validateRow(raw, lookups);
            if (rowErrors.length === 0) validRows.push(row);
            else errors.push({ line: raw._line, name: row.name, errors: rowErrors });
        });

        res.json({
            summary: { total: rows.length, valid: validRows.length, invalid: errors.length },
            validRows,
            errors,
            detected: { separator, headers },
            available: lookups.names
        });
    } catch (e) {
        console.error("[CATALOG IMPORT] Validate error:", e.message);
        res.status(500).json({ error: "Errore nella lettura del file CSV." });
    }
});

/**
 * POST /api/admin/catalog/bulk-import
 * Scrive le righe valide. Un prodotto con lo stesso nome dello stesso produttore
 * viene aggiornato invece di essere duplicato, così reimportare un listino
 * aggiornato funziona.
 *
 * I dati del client non sono considerati attendibili: ogni riga viene validata
 * di nuovo qui contro le anagrafiche del GAS.
 *
 * Il prezzo di un prodotto con ordini in corso NON viene toccato, come nella
 * modifica manuale: cambierebbe il totale di ordini già fatti.
 */
router.post('/bulk-import', async (req, res) => {
    const pool = getDb();
    const gasId = getGasId(req);
    const adminId = req.user.id;
    const { products } = req.body;

    if (!gasId) return res.status(400).json({ error: "Contesto GAS mancante." });
    if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: "Nessun prodotto da importare." });
    }
    if (products.length > MAX_IMPORT_ROWS) {
        return res.status(400).json({ error: `Troppe righe: il massimo è ${MAX_IMPORT_ROWS}.` });
    }

    const conn = await pool.getConnection();
    try {
        const lookups = await loadLookups(pool, gasId);
        let created = 0, updated = 0, priceKept = 0;
        const rejected = [];

        await conn.beginTransaction();

        for (const p of products) {
            const { row, errors } = validatePayloadRow(p, lookups);
            if (errors.length > 0) {
                rejected.push({ line: p.line, name: p.name, errors });
                continue;
            }
            const categoryId = row.category_id;

            const [existing] = await conn.execute(
                "SELECT id FROM products WHERE producer_id = ? AND name = ? LIMIT 1",
                [row.producer_id, row.name]
            );

            if (existing.length > 0) {
                const productId = existing[0].id;
                const [active] = await conn.execute(`
                    SELECT COUNT(*) AS count FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE oi.product_id = ? AND o.status IN ('draft', 'confirmed')`, [productId]);

                if (active[0].count > 0) {
                    // Ordini in corso: si aggiorna tutto tranne il prezzo
                    await conn.execute(`
                        UPDATE products SET category_id = ?, unit_id = ?, stock = ?,
                            min_order_qty = ?, is_active = ?, updated_at = NOW(), updated_by = ?
                        WHERE id = ?`,
                        [categoryId, row.unit_id, row.stock, row.min_order_qty, row.is_active, adminId, productId]);
                    priceKept += 1;
                } else {
                    await conn.execute(`
                        UPDATE products SET category_id = ?, unit_id = ?, price = ?, stock = ?,
                            min_order_qty = ?, is_active = ?, updated_at = NOW(), updated_by = ?
                        WHERE id = ?`,
                        [categoryId, row.unit_id, row.price, row.stock, row.min_order_qty, row.is_active, adminId, productId]);
                }
                updated += 1;
            } else {
                await conn.execute(`
                    INSERT INTO products (producer_id, category_id, unit_id, name, price, stock,
                        min_order_qty, is_active, created_by, updated_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [row.producer_id, categoryId, row.unit_id, row.name, row.price, row.stock,
                     row.min_order_qty, row.is_active, adminId, adminId]);
                created += 1;
            }
        }

        /**
         * Il listino è cambiato: le validazioni dei produttori interessati decadono,
         * come avviene quando modificano i prodotti da soli.
         */
        await conn.execute(`
            DELETE v FROM producer_cycle_validations v
            JOIN cycles c ON c.id = v.cycle_id
            WHERE c.gas_id = ? AND c.is_active = 1 AND c.producers_deadline > NOW()`, [gasId]);

        await conn.commit();
        res.json({ success: true, created, updated, priceKept, rejected });
    } catch (e) {
        await conn.rollback();
        console.error("[CATALOG IMPORT] Bulk import error:", e.message);
        res.status(500).json({ error: "Errore durante l'importazione: nessuna riga è stata salvata." });
    } finally {
        conn.release();
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