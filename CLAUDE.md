# doliGAS — contesto per Claude

Questo file viene letto automaticamente da Claude Code (CLI) all'avvio. Tienilo aggiornato a ogni passo importante.

## Il progetto
doliGAS è una web app multi-tenant per i Gruppi di Acquisto Solidale (GAS), con tre profili: **Coordinatore**, **Produttore** e **Socio**.
- **Indirizzo strategico:** doliGAS è una **piattaforma indipendente**. L'integrazione con Dolibarr/doliFarm (il modulo PHP in `../dolifarm`) è **opzionale**: si attiva solo per i GAS più complessi o per i produttori che la chiedono. Il nucleo non deve mai dipendere da Dolibarr.
- **Installazione attiva:** https://demo.dolifarm365.com. Il codice in questa cartella coincide con quello della demo (baseline al 19/11/2026).
- **Autore e maintainer:** Luigi Grillo (doliFarm). Lingua di lavoro: italiano.

## Stack
- `backend/`: Node.js 18 + Express, `mysql2/promise` con SQL scritto a mano (niente ORM), JWT, nodemailer, node-cron. Entry: `server.js`.
- `frontend/`: React 18 + Vite + Tailwind, react-router, i18next (it/en/fr in `src/locales`), recharts.
- `mysql-init/01_schema.sql`: schema storico, **rotto** (non si installa). Fa fede lo schema reale in `db/schema_produzione_2026-11-19.sql`.
- `docker-compose.yml`: tre container, `gashub-db` (MySQL 8.4), `gashub-api`, `gashub-frontend`, con target `${APP_ENV}` = `dev` | `prod`.

## Concetti chiave
- **Multi-tenant:** `users` sono globali; `gas_memberships` collega utente, GAS e ruolo, e contiene il **saldo wallet**. Il produttore è una riga di `producers` collegata a un `user_id`.
- **Login:** OTP di 6 cifre via email (`magic_links`, 15 minuti), poi un JWT di 30 giorni con `{id, email}`. Il profilo attivo (GAS + ruolo) lo sceglie il frontend e lo manda come `gasId`.
- **Contesto GAS:** `middlewares/roles.js#verifyGasMembership` valida il `gasId` (da query, body o params, che devono coincidere) e imposta `req.user.verifiedGasId`. **Nelle rotte usa sempre e solo `req.user.verifiedGasId`**, mai il `gasId` del body.
- **Ciclo G1–G7** (tabella `cycles`): G1 avvio, G2 scadenza listini produttori, G3 apertura ordini, G4 chiusura, G5 invio ai fornitori, G6 ricezione e pesatura, G7 consegna. Gli offset predefiniti stanno in `gas.g*_offset`.
- **Validazione del listino:** il produttore valida il listino per ciclo (`producer_cycle_validations`). Il socio vede solo i prodotti validati, e ogni modifica al listino revoca la validazione.
- **Modello wallet (DECISO):** l'importo ordinato **si scala subito all'ordine** (`routes/members.js POST /order`). **Alla consegna si fa il conguaglio** sul peso reale (`routes/admin/logistics.js POST /checkout/deliver`): `SPESA` se costa di più, `REFUND` se costa di meno. Non va mai riaddebitato il totale.

## Stato (19/11/2026)
Commit su `main`:
1. `51c9794` Baseline (uguale alla demo)
2. `d2431a6` Fase 0: sicurezza (debug API, OTP fuori dai log, limite tentativi, JWT_SECRET obbligatorio, gasId unico, mercato aperto, lock del listino dopo G2, HTML neutralizzato nelle email)
3. `d3c18ec` Schema reale della demo in `db/`
4. `07eb65b` Consegna G7 con conguaglio (prima falliva sempre su `wallet_history`, una tabella inesistente)

**Nessuna di queste modifiche è ancora in produzione.** Prima di distribuirle sulla demo:
- `JWT_SECRET` nuovo, di almeno 32 caratteri (`openssl rand -hex 32`); altrimenti il server non parte.
- Non impostare `ENABLE_DEBUG_API` sulla demo.

## Prossimi passi
Il piano completo è in `docs/piano-stabilizzazione.md`; l'analisi dei problemi (#1–#17) è in `docs/analisi-codice.md`.
1. **Fase 1, database:** usare lo schema reale come migrazione `001`, introdurre migrazioni SQL numerate con una tabella `schema_migrations` applicata all'avvio, tenere un seed demo separato, verificare un'installazione da zero. Decidere cosa fare delle tabelle non usate dal codice (`permissions`, `role_permissions`, `user_permissions`, `gas_holidays`).
2. **Fase 2, ciclo:**
   - lo scheduler (`cron/scheduler.js`) non viene mai avviato: va avviato e reso idempotente con una tabella degli eventi inviati per ciclo; il controllo MOQ usa `status='pending'`, che non esiste;
   - endpoint mancanti: `PUT /api/admin/cycles/:id`, `POST /api/admin/catalog/validate` e `/bulk-import`, ordini del produttore (la pagina legge `ordered_qty`, che non esiste), richiesta di ricarica del socio;
   - stock;
   - arrotondamento delle unità discrete nella pesatura.
3. **Fase 3, qualità:** test (Jest + supertest su un DB MySQL di test), validazione degli input, pulizia del codice morto (`routes/contact.js`, `routes/admin/dashboard.js`, `routes/admin/products.js` non montati; i mock nel frontend), proxy Vite (`gashub-backend` → `gashub-api`), `.env.example`, CI.
4. **Fase 4, connettore Dolibarr opzionale:** campi `external_ref` e `external_source`; configurazione per produttore (il suo Dolibarr: listino in entrata, ordini G5 come ordini cliente) e per GAS (il Dolibarr del GAS: fornitori, ordini fornitore, fatture ai soci); sincronizzazione asincrona tramite una tabella outbox.

## Insidie note
- I file sorgente hanno **fine riga CRLF**: preservale quando modifichi.
- In compose `NODE_ENV` prende il valore di `APP_ENV` (`dev`/`prod`), quindi `NODE_ENV === 'development'` non è mai vero nei container.
- `global.pool` viene usato ovunque tramite `getDb()`. Per le query usa `pool.execute` con parametri `?`, mai concatenazione.
- Le date del DB sono stringhe (`dateStrings: true`); i confronti temporali vanno fatti preferibilmente in SQL con `NOW()`.
- Le operazioni sul wallet vanno sempre in transazione: aggiornano `gas_memberships.balance` e inseriscono una riga in `wallet_transactions`.
- Non committare `.env` né `mysql-data/` (già esclusi in `.gitignore`).

## Convenzioni
- Commit in italiano, piccoli, uno per argomento, con la riga `Co-Authored-By: Claude ...` quando li fa Claude.
- Commenti nel codice in italiano. Dopo ogni modifica a un file JS: `node --check <file>`.
- Prima di modificare il comportamento del ciclo o del wallet, chiedi conferma a Luigi.
