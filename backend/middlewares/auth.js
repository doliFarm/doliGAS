/**
 * doliGAS - Enterprise Resource Planning per Gruppi di Acquisto Solidale
 * * Middleware di Autenticazione e Autorizzazione
 * -----------------------------------------------------------------------------
 * Questo modulo gestisce la verifica dei JSON Web Tokens (JWT) e l'iniezione
 * del contesto utente/GAS nelle richieste autenticate.
 * STATUS: Integro, Completo, Robusto.
 * FIX: Allineato l'export (authenticateToken) per prevenire il crash di Express.
 * * @module middlewares/auth
 * @license GNU GPLv3 (o successiva)
 */

const jwt = require('jsonwebtoken');

/**
 * Middleware principale per l'autenticazione JWT.
 * Verifica la presenza e la validità del token nell'header Authorization.
 * * Requisiti di Robustezza:
 * 1. Previene l'esecuzione se la chiave segreta non è configurata (fail-fast).
 * 2. Gestisce i vari formati di errore JWT (scadenza, firma non valida).
 * 3. Preserva l'integrità dei dati utente per i middleware successivi.
 */
const auth = (req, res, next) => {
  // Recupero della chiave segreta dalle variabili d'ambiente
  const JWT_SECRET = process.env.JWT_SECRET;

  // SICUREZZA: Blocco critico in assenza di configurazione
  if (!JWT_SECRET) {
    console.error('[CRITICAL] JWT_SECRET non configurato nel file .env');
    return res.status(500).json({ 
      error: 'Errore interno di configurazione del server',
      code: 'AUTH_CONFIG_ERROR' 
    });
  }

  // Estrazione del token dall'header Authorization (formato: "Bearer TOKEN")
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Accesso negato. Token mancante.',
      code: 'TOKEN_MISSING'
    });
  }

  try {
    // Verifica del token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    /**
     * Iniezione del contesto utente nella richiesta.
     * decoded deve contenere: { id, email, gas_id, role_id }
     */
    req.user = decoded;
    
    // Log di monitoraggio per debugging (opzionale in base al livello di log)
    // console.log(`[AUTH] Utente ${decoded.id} autenticato per GAS ${decoded.gas_id}`);
    
    next();
  } catch (err) {
    // Gestione differenziata degli errori JWT per una migliore UX e sicurezza
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
 * Middleware opzionale per l'estrazione del contesto GAS da slug o header.
 * Utile per operazioni pubbliche che richiedono comunque la distinzione del tenant.
 */
const injectGasContext = (req, res, next) => {
  const gasSlug = req.header('X-GAS-Slug') || req.query.gas;
  if (gasSlug) {
    req.gasSlug = gasSlug;
  }
  next();
};



// Esportazione Completa e Robusta
module.exports = {
  auth,
  authenticateToken: auth, // <--- FIX CRITICO: Aggiunto l'alias usato da tutti i router
  injectGasContext
};