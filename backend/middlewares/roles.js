/* =============================================================================
   FILE: backend/middlewares/roles.js - v3.2
   STATUS: Integro, Completo, Robusto.
   DESC: Middleware per la verifica dei ruoli e dell'appartenenza al GAS.
   FIX: Iniezione di verifiedGasId per supportare l'architettura multi-profilo.
   ============================================================================= */

const getDb = () => global.pool || require('../config/db');

/**
 * Middleware: verifyGasMembership
 * Valida che l'utente appartenga al GAS richiesto e abbia il ruolo corretto.
 * Estrae l'ID GAS da query string o body.
 */
const verifyGasMembership = (requiredRole = null) => {
    return async (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Autenticazione richiesta' });

        // Recuperiamo il gasId inviato dal frontend
        const gasId = req.query.gasId || req.body.gasId || req.params.gasId;

        if (!gasId) {
            return res.status(400).json({ error: 'Contesto GAS non specificato (gasId mancante)' });
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

            // Verifica Ruolo (se richiesto)
            if (requiredRole && membership.role_name !== requiredRole) {
                return res.status(403).json({ error: `Privilegi di ${requiredRole} necessari` });
            }

            // INIEZIONE FONDAMENTALE: 
            // Salviamo il gasId validato per usarlo nelle rotte successive
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