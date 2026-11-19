# doliGAS — contesto per Claude

Questo file viene letto automaticamente da Claude Code (CLI) all'avvio. Tienilo aggiornato a ogni passo importante.

## Il progetto
doliGAS è una web app multi-tenant per i Gruppi di Acquisto Solidale (GAS), con tre profili: **Coordinatore**, **Produttore** e **Socio**.
- **Indirizzo strategico:** doliGAS è una **piattaforma indipendente**. L'integrazione con Dolibarr/doliFarm (il modulo PHP in `../dolifarm`) è **opzionale**: si attiva solo per i GAS più complessi o per i produttori che la chiedono. Il nucleo non deve mai dipendere da Dolibarr.
- **Installazione attiva:** https://demo.dolifarm365.com, sul server `www` in `~/doliGAS`.
- **Attenzione:** il server è una copia del repository con cui si lavora anche a mano. È già capitato che contenesse un commit non pubblicato (`e11eb59`, modifiche al compose e al ProfileSelector). Prima di ogni aggiornamento, controllare là `git status` e `git log origin/main..main`, e pubblicare l'eventuale lavoro locale su un ramo prima di fare `pull`.
- **Repository:** https://github.com/doliFarm/doliGAS (branch `main`). `origin/main` (commit `d5fcaae`, aprile 2026) coincide con il codice della demo.
- **Autore e maintainer:** Luigi Grillo (doliFarm). Lingua di lavoro: italiano.

## Stack
- `backend/`: Node.js 18 + Express, `mysql2/promise` con SQL scritto a mano (niente ORM), JWT, nodemailer, node-cron. Entry: `server.js`.
- `frontend/`: React 18 + Vite + Tailwind, react-router, i18next (it/en/fr in `src/locales`), recharts.
- `backend/db/`: **migrazioni** (`migrations/NNN_*.sql`, motore in `migrate.js`), **seed** demo (`seeds/demo.sql`, `seed.js`) e `create-gas.js` per creare un nuovo GAS. `mysql-init/` non contiene più lo schema; lo schema reale fotografato il 19/11 resta in `db/schema_produzione_2026-11-19.sql`.
- `docker-compose.yml`: tre container, `gashub-db` (MySQL 8.4), `gashub-api`, `gashub-frontend`, con target `${APP_ENV}` = `dev` | `prod`.

## Concetti chiave
- **Multi-tenant:** `users` sono globali; `gas_memberships` collega utente, GAS e ruolo, e contiene il **saldo wallet**. Il produttore è una riga di `producers` collegata a un `user_id`.
- **Login:** OTP di 6 cifre via email (`magic_links`, 15 minuti), poi un JWT di 30 giorni con `{id, email}`. Il profilo attivo (GAS + ruolo) lo sceglie il frontend e lo manda come `gasId`.
- **Contesto GAS:** `middlewares/roles.js#verifyGasMembership` valida il `gasId` (da query, body o params, che devono coincidere) e imposta `req.user.verifiedGasId`. **Nelle rotte usa sempre e solo `req.user.verifiedGasId`**, mai il `gasId` del body.
- **Ciclo G1–G7** (tabella `cycles`): G1 avvio, G2 scadenza listini produttori, G3 apertura ordini, G4 chiusura, G5 invio ai fornitori, G6 ricezione e pesatura, G7 consegna. Gli offset predefiniti stanno in `gas.g*_offset`.
- **Validazione del listino:** il produttore valida il listino per ciclo (`producer_cycle_validations`). Il socio vede solo i prodotti validati, e ogni modifica al listino revoca la validazione.
- **Modello wallet (DECISO):** l'importo ordinato **si scala subito all'ordine** (`routes/members.js POST /order`). **Alla consegna si fa il conguaglio** sul peso reale (`routes/admin/logistics.js POST /checkout/deliver`): `SPESA` se costa di più, `REFUND` se costa di meno. Non va mai riaddebitato il totale.

## Stato (19/11/2026)
Si lavora sul branch **`stabilizzazione`** (`origin/stabilizzazione`), con una pull request aperta verso `main`. `main` resta allineato a quello che gira sulla demo.

Commit:
1. `d5fcaae` Ultimo commit su `origin/main`, uguale alla demo
2. `2faa6dc` Fase 0: sicurezza (debug API, OTP fuori dai log, limite tentativi, JWT_SECRET obbligatorio, gasId unico, mercato aperto, lock del listino dopo G2, HTML neutralizzato nelle email)
3. `8d6d93f` Schema reale della demo in `db/`
4. `1c8b764` Consegna G7 con conguaglio (prima falliva sempre su `wallet_history`, una tabella inesistente)
5. `da5a393` + `6a5f671` Questo file e i documenti in `docs/`
6. `0f9e446` **Fase 1:** migrazioni del database, seed demo, creazione GAS, ripartizione della pesatura
7. `bd4677d` Merge della PR #1 in `main`
8. `57718e0` + `7670158` Integrazione delle modifiche fatte a mano sulla demo (ramo `demo-locale`): taratura del compose per la VPS, avvio dell'API a database sano, `nodemon.json`, avviso demo ora dietro `VITE_DEMO_MODE`, traduzioni

**Nessuna di queste modifiche è ancora in produzione.** Prima di distribuirle sulla demo:
- `JWT_SECRET` nuovo, di almeno 32 caratteri (`openssl rand -hex 32`); altrimenti il server non parte.
- Non impostare `ENABLE_DEBUG_API` sulla demo.
- Al primo avvio il backend registra la 001 come baseline (il database esiste già) e applica solo la 002. Fare comunque un backup del database prima dell'aggiornamento.
- Per mantenere l'avviso demo sulla demo, aggiungere `VITE_DEMO_MODE=true` al suo `.env`.

## Prossimi passi
Il piano completo è in `docs/piano-stabilizzazione.md`; l'analisi dei problemi (#1–#17) è in `docs/analisi-codice.md`.
1. ~~**Fase 1, database**~~ ✅ fatta (`0f9e446`). Resta da decidere: le tabelle `permissions`, `role_permissions`, `user_permissions` e `gas_holidays` esistono nello schema ma **non sono usate dal codice** — valorizzarle o rimuoverle con una migrazione.
2. **Fase 2, ciclo:**
   - lo scheduler (`cron/scheduler.js`) non viene mai avviato: va avviato e reso idempotente con una tabella degli eventi inviati per ciclo; il controllo MOQ usa `status='pending'`, che non esiste;
   - endpoint mancanti: `PUT /api/admin/cycles/:id`, `POST /api/admin/catalog/validate` e `/bulk-import`, ordini del produttore (la pagina legge `ordered_qty`, che non esiste), richiesta di ricarica del socio;
   - stock;
   - arrotondamento delle unità discrete nella pesatura.
3. **Fase 3, qualità:** test (Jest + supertest su un DB MySQL di test), validazione degli input, pulizia del codice morto (`routes/contact.js`, `routes/admin/dashboard.js`, `routes/admin/products.js` non montati; i mock nel frontend), proxy Vite (`gashub-backend` → `gashub-api`), `.env.example`, CI.
4. **Fase 4, connettore Dolibarr opzionale:** campi `external_ref` e `external_source`; configurazione per produttore (il suo Dolibarr: listino in entrata, ordini G5 come ordini cliente) e per GAS (il Dolibarr del GAS: fornitori, ordini fornitore, fatture ai soci); sincronizzazione asincrona tramite una tabella outbox.

## Comandi utili (in `backend/`)
- `npm run migrate` applica le migrazioni mancanti; `npm run migrate:status` mostra lo stato senza modificare nulla.
- `npm run seed:demo` carica i dati demo (rifiuta in produzione e su un database già popolato; `-- --reset` svuota prima).
- `npm run create-gas -- --name "GAS X" --slug x --admin-email a@b.c --admin-first A --admin-last B` crea un nuovo GAS con il suo coordinatore.

## Insidie note
- **Fine riga:** nel repository i file sono salvati con LF, nella cartella di lavoro su Windows con CRLF (`core.autocrlf=true` in questo repo). Non convertire i file a mano.
- In compose `NODE_ENV` prende il valore di `APP_ENV` (`dev`/`prod`), quindi `NODE_ENV === 'development'` non è mai vero nei container.
- `global.pool` viene usato ovunque tramite `getDb()`. Per le query usa `pool.execute` con parametri `?`, mai concatenazione.
- Le date del DB sono stringhe (`dateStrings: true`); i confronti temporali vanno fatti preferibilmente in SQL con `NOW()`.
- Le operazioni sul wallet vanno sempre in transazione: aggiornano `gas_memberships.balance` e inseriscono una riga in `wallet_transactions`.
- Non committare `.env` né `mysql-data/` (già esclusi in `.gitignore`); `.env.example` elenca tutte le variabili.
- **Migrazioni:** mai modificare un file già applicato (il checksum viene confrontato e la differenza segnalata); aggiungere sempre un nuovo file col numero successivo. In MySQL il DDL non è transazionale, quindi tenere ogni migrazione piccola.
- **Traduzioni:** `it.json` ha 492 chiavi, `en.json` e `fr.json` 435: a inglese e francese ne mancano 57, da allineare (Fase 3).
- La ripartizione della pesatura usa `utils/allocation.js` (metodo dei resti maggiori): la somma delle quote è esattamente il totale ricevuto e le unità discrete restano numeri interi.

## Convenzioni
- Commit in italiano, piccoli, uno per argomento, con la riga `Co-Authored-By: Claude ...` quando li fa Claude.
- Commenti nel codice in italiano. Dopo ogni modifica a un file JS: `node --check <file>`.
- Prima di modificare il comportamento del ciclo o del wallet, chiedi conferma a Luigi.
