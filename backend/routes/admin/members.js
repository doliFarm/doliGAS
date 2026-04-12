/**
 * doliGAS - Enterprise Resource Planning per GAS
 * @file backend/routes/admin/members.js
 * @version v1.2.5
 * @author Luigi GRILLO @ doliFarm.com
 * @description Gestione Anagrafica Soci, Ruoli, Magic Links e Cassa.
 * STATUS: Integro, Completo, Robusto.
 * SCHEMA: v22.0 (Audit Tracing + Magic Links + Roles).
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/**
 * Helper per acquisire il pool di connessioni singleton.
 */
const getDb = () => global.pool || require('../../config/db');

/**
 * Helper interno per estrarre il gasId in modo robusto (Fallback multi-livello).
 */
const getGasId = (req) => req.user?.verifiedGasId || req.body?.gasId || req.user?.gas_id;

// =============================================================================
// MIDDLEWARE DI PROTEZIONE (LOCKOUT PREVENTION)
// =============================================================================

/**
 * Verifica che non si elimini o declassi l'ultimo Coordinatore attivo del GAS.
 */
const checkLastAdminSafe = async (conn, gasId, targetUserId, newRoleId = null, isDeleteOrDeactivate = false) => {
    const [current] = await conn.execute(
        "SELECT role_id, is_active FROM gas_memberships WHERE user_id = ? AND gas_id = ?", 
        [targetUserId, gasId]
    );
    
    // Se l'utente non è un Coordinatore (role_id=1), l'operazione è sempre sicura
    if (current.length === 0 || current[0].role_id !== 1) return true; 
    
    const staysAdmin = newRoleId !== null && parseInt(newRoleId) === 1;
    if (!isDeleteOrDeactivate && staysAdmin) return true;

    // Conteggio admin attivi rimanenti
    const [admins] = await conn.execute(
        "SELECT COUNT(*) as count FROM gas_memberships WHERE gas_id = ? AND role_id = 1 AND is_active = 1", 
        [gasId]
    );
    
    if (admins[0].count <= 1) {
        throw new Error("OPERAZIONE_NEGATA: Ultimo Coordinatore attivo. Nomina un sostituto prima di procedere.");
    }
    return true;
};

// =============================================================================
// 1. LETTURA DATI (MEMBERS & ROLES)
// =============================================================================

/**
 * GET /api/admin/members
 * Recupera l'elenco soci con statistiche ordini e saldo.
 */
router.get('/', async (req, res) => {
    const pool = getDb();
    const gasId = getGasId(req);

    if (!gasId) return res.status(400).json({ error: "GAS ID non fornito." });

    try {
        const [rows] = await pool.execute(`
            SELECT 
                u.id, u.first_name, u.last_name, u.email, u.phone, 
                gm.balance, gm.address, gm.internal_notes, gm.is_active, gm.role_id,
                r.name as role_name,
                (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.gas_id = ?) as total_orders,
                (SELECT MAX(created_at) FROM orders o WHERE o.user_id = u.id AND o.gas_id = ?) as last_order_date
            FROM gas_memberships gm 
            JOIN users u ON gm.user_id = u.id 
            JOIN roles r ON gm.role_id = r.id
            WHERE gm.gas_id = ? 
            ORDER BY u.last_name ASC, u.first_name ASC
        `, [gasId, gasId, gasId]);
        
        res.json(rows);
    } catch (e) { 
        console.error("[MEMBERS] List Fetch Error:", e.message);
        res.status(500).json({ error: "Errore nel recupero della lista soci." }); 
    }
});

/**
 * GET /api/admin/roles
 * Recupera i ruoli disponibili nel sistema.
 */
router.get('/roles', async (req, res) => {
    const pool = getDb();
    try {
        const [rows] = await pool.execute("SELECT id, name FROM roles ORDER BY id ASC");
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: "Errore caricamento ruoli." });
    }
});

/**
 * GET /api/admin/members/:id
 * Dettaglio completo di un singolo socio.
 */
router.get('/:id', async (req, res) => {
    const pool = getDb();
    const gasId = getGasId(req);
    try {
        const [rows] = await pool.execute(`
            SELECT u.*, gm.balance, gm.address, gm.role_id, gm.is_active, gm.internal_notes
            FROM users u
            JOIN gas_memberships gm ON u.id = gm.user_id
            WHERE u.id = ? AND gm.gas_id = ?
        `, [req.params.id, gasId]);
        
        if (rows.length === 0) return res.status(404).json({ error: "Socio non trovato." });
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// =============================================================================
// 2. SCRITTURA DATI (UPSERT & MAGIC LINKS)
// =============================================================================

/**
 * POST /api/admin/members
 * Crea o aggiorna un socio (User + Membership).
 */
router.post('/', async (req, res) => {
    const pool = getDb();
    const conn = await pool.getConnection();
    const adminId = req.user.id;
    const gasId = getGasId(req);

    try {
        if (!gasId) throw new Error("Contesto GAS mancante nella richiesta.");

        const { 
            id, first_name, last_name, email, phone, 
            address, role_id, is_active, internal_notes 
        } = req.body;

        const cleanEmail = email.trim().toLowerCase();
        const activeStatus = is_active ? 1 : 0;

        await conn.beginTransaction();

        let targetUserId = id;

        if (id) {
            // --- MODIFICA SOCIO ---
            await checkLastAdminSafe(conn, gasId, id, role_id, activeStatus === 0);
            
            await conn.execute(
                "UPDATE users SET first_name=?, last_name=?, phone=?, email=?, updated_at=NOW() WHERE id=?", 
                [first_name, last_name, phone || null, cleanEmail, id]
            );
        } else {
            // --- CREAZIONE NUOVO ---
            // Verifica se l'utente esiste già nel sistema globale (es. iscritto ad un altro GAS)
            const [exist] = await conn.execute("SELECT id FROM users WHERE email = ?", [cleanEmail]);
            
            if (exist.length > 0) {
                targetUserId = exist[0].id;
            } else {
                const placeholder = `LOCK_${crypto.randomBytes(8).toString('hex')}`;
                const [resNew] = await conn.execute(
                    "INSERT INTO users (first_name, last_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)", 
                    [first_name, last_name, cleanEmail, phone || null, placeholder]
                );
                targetUserId = resNew.insertId;
            }
        }

        // Inserimento o Aggiornamento Membership (Audit Tracing v22.0)
        await conn.execute(`
            INSERT INTO gas_memberships 
                (user_id, gas_id, role_id, is_active, address, internal_notes, created_by, updated_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
                role_id=VALUES(role_id), 
                is_active=VALUES(is_active), 
                address=VALUES(address),
                internal_notes=VALUES(internal_notes),
                updated_by=VALUES(updated_by),
                updated_at=NOW()`, 
            [targetUserId, gasId, role_id, activeStatus, address, internal_notes, adminId, adminId]
        );

        await conn.commit();
        res.json({ success: true, userId: targetUserId });

    } catch (err) { 
        if (conn) await conn.rollback(); 
        console.error("[MEMBERS] Save Error:", err.message);
        res.status(400).json({ error: err.message }); 
    } finally { 
        if (conn) conn.release(); 
    }
});

// =============================================================================
// 3. AZIONI MASSIVE E ELIMINAZIONE
// =============================================================================

/**
 * POST /api/admin/members/bulk-action
 */
router.post('/bulk-action', async (req, res) => {
    const { userIds, action } = req.body;
    const gasId = getGasId(req);
    const adminId = req.user.id;

    if (!Array.isArray(userIds) || userIds.length === 0) return res.status(400).json({ error: "Selezione vuota." });

    const pool = getDb();
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        for (const uid of userIds) {
            if (action === 'delete') {
                await checkLastAdminSafe(conn, gasId, uid, null, true);
                
                const [ord] = await conn.execute("SELECT id FROM orders WHERE user_id=? AND gas_id=? LIMIT 1", [uid, gasId]);
                
                if (ord.length === 0) {
                    await conn.execute("DELETE FROM gas_memberships WHERE user_id=? AND gas_id=?", [uid, gasId]);
                } else {
                    await conn.execute("UPDATE gas_memberships SET is_active=0, updated_by=? WHERE user_id=? AND gas_id=?", [adminId, uid, gasId]);
                }
            } else {
                const status = action === 'activate' ? 1 : 0;
                if (status === 0) await checkLastAdminSafe(conn, gasId, uid, null, true);
                await conn.execute("UPDATE gas_memberships SET is_active=?, updated_by=? WHERE user_id=? AND gas_id=?", [status, adminId, uid, gasId]);
            }
        }
        await conn.commit();
        res.json({ success: true, count: userIds.length });
    } catch (e) { 
        if (conn) await conn.rollback(); 
        res.status(400).json({ error: e.message }); 
    } finally { 
        if (conn) conn.release(); 
    }
});

/**
 * DELETE /api/admin/members/:id
 */
router.delete('/:id', async (req, res) => {
    const pool = getDb();
    const conn = await pool.getConnection();
    const gasId = getGasId(req);
    const userId = req.params.id;

    try {
        await conn.beginTransaction();
        await checkLastAdminSafe(conn, gasId, userId, null, true);
        
        const [ord] = await conn.execute("SELECT id FROM orders WHERE user_id=? AND gas_id=? LIMIT 1", [userId, gasId]);
        
        if (ord.length === 0) {
            await conn.execute("DELETE FROM gas_memberships WHERE user_id=? AND gas_id=?", [userId, gasId]);
        } else {
            await conn.execute("UPDATE gas_memberships SET is_active=0, updated_at=NOW() WHERE user_id=? AND gas_id=?", [userId, gasId]);
        }
        
        await conn.commit();
        res.json({ success: true });
    } catch (e) {
        if (conn) await conn.rollback();
        res.status(400).json({ error: e.message });
    } finally {
        if (conn) conn.release();
    }
});

module.exports = router;