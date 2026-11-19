/**
 * Strumenti comuni ai test.
 *
 * Dati: ogni file di test parte dal seed demo (backend/db/seeds/demo.sql), ricaricato
 * da zero con resetDb(). Riferimenti utili del seed:
 * - GAS 1 "demo"; utente 1 coordinatore; utenti 2-5 produttori (producers 1-4);
 *   utenti 6-10 soci (Giulia 124 €, Roberto 60 €, Sara 95 €, Luca 45 €, Anna 108,50 €);
 * - ciclo 2 "Ciclo in corso" con il mercato aperto; i produttori 1-3 hanno validato,
 *   la Cantina (producer 4, prodotti 10-12) no;
 * - ordini confermati nel ciclo 2: #1 Giulia 26 €, #2 Roberto 20,50 €, #3 Sara 105 €, #4 Anna 11,50 €.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const pool = require('../config/db');
const { loadSeed } = require('../db/seed');

const GAS_ID = 1;
const CYCLE_ID = 2;
const USERS = {
    coordinatore: { id: 1, email: 'admin@gas.it' },
    agrisole: { id: 2, email: 'bio@agrisole.it', producerId: 1 },
    caseificio: { id: 3, email: 'info@caseificio.it', producerId: 2 },
    cantina: { id: 5, email: 'cantina@vino.it', producerId: 4 },
    giulia: { id: 6, email: 'giulia@socio.it' },
    roberto: { id: 7, email: 'roberto@socio.it' },
    sara: { id: 8, email: 'sara@socio.it' },
    luca: { id: 9, email: 'luca@socio.it' },
    anna: { id: 10, email: 'anna@socio.it' }
};

/** Svuota il database di test e ricarica il seed demo. */
const resetDb = () => loadSeed({ name: 'demo', reset: true, log: () => {} });

/** Esegue una query e restituisce le righe. */
const sql = async (query, params = []) => (await pool.query(query, params))[0];

/** Token JWT come quello emesso da /api/auth/verify. */
const tokenFor = (user) => jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

/** Client HTTP già autenticato come l'utente indicato. */
const as = (user) => {
    const auth = (r) => r.set('Authorization', `Bearer ${tokenFor(user)}`);
    return {
        get: (url) => auth(request(app).get(url)),
        post: (url, body) => auth(request(app).post(url)).send(body),
        put: (url, body) => auth(request(app).put(url)).send(body),
        patch: (url, body) => auth(request(app).patch(url)).send(body),
        delete: (url) => auth(request(app).delete(url))
    };
};

const balanceOf = async (user) =>
    Number((await sql('SELECT balance FROM gas_memberships WHERE user_id = ? AND gas_id = ?', [user.id, GAS_ID]))[0].balance);

/**
 * Sposta il ciclo in una fase: le date vengono riscritte rispetto a NOW() nel database.
 * - 'listini':  prima della scadenza G2 (il produttore può modificare il listino)
 * - 'mercato':  mercato aperto (G3-G4)
 * - 'chiuso':   mercato chiuso, prima della consegna (G4-G7)
 */
const setPhase = async (phase, cycleId = CYCLE_ID) => {
    const offsets = {
        listini: [-2, 1, 2, 4, 5, 6, 7],
        mercato: [-6, -4, -3, 2, 3, 4, 5],
        chiuso:  [-8, -6, -5, -1, -1, 1, 2]
    }[phase];
    if (!offsets) throw new Error(`Fase sconosciuta: ${phase}`);
    const cols = ['start_at', 'producers_deadline', 'market_open_at', 'market_close_at', 'orders_sent_at', 'confirmation_at', 'delivery_at'];
    const set = cols.map((c, i) => `${c} = NOW() + INTERVAL ${offsets[i] * 24} HOUR`).join(', ');
    await sql(`UPDATE cycles SET ${set} WHERE id = ?`, [cycleId]);
};

const closePool = () => pool.end();

module.exports = { request, app, pool, sql, resetDb, tokenFor, as, balanceOf, setPhase, closePool, GAS_ID, CYCLE_ID, USERS };
