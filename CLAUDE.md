# doliGAS — contesto per Claude

Questo file viene letto automaticamente da Claude Code (CLI) all'avvio. Tienilo aggiornato a ogni passo importante.

## Il progetto
doliGAS è una web app multi-tenant per i Gruppi di Acquisto Solidale (GAS), con tre profili: **Coordinatore**, **Produttore** e **Socio**.
- **Indirizzo strategico:** doliGAS è una **piattaforma indipendente**. L'integrazione con Dolibarr/doliFarm (il modulo PHP in `../dolifarm`) è **opzionale**: si attiva solo per i GAS più complessi o per i produttori che la chiedono. Il nucleo non deve mai dipendere da Dolibarr.
- **Flusso di lavoro:** si sviluppa in locale sulla workstation (Docker, `APP_ENV=dev`), si valida sulla VPS demo, e il passaggio avviene via GitHub con pull request. Niente modifiche a mano sul server. Istruzioni in `docs/sviluppo-locale.md`.
- **Installazione attiva:** https://demo.dolifarm365.com, sul server `www` in `~/doliGAS`.
- **Attenzione:** il server è una copia del repository con cui si lavora anche a mano. È già capitato che contenesse un commit non pubblicato (`e11eb59`, modifiche al compose e al ProfileSelector). Prima di ogni aggiornamento, controllare là `git status` e `git log origin/main..main`, e pubblicare l'eventuale lavoro locale su un ramo prima di fare `pull`.
- **Repository:** https://github.com/doliFarm/doliGAS, ramo `main`.
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
Tutto il lavoro è in `main` su GitHub: PR #1 (sicurezza, consegna, migrazioni), #3 (integrazione del lavoro fatto a mano sulla demo), #4 (Fase 2) e #5 (stock).

**La demo è allineata a `main` (`00ad608`)**, con le migrazioni 001–004 applicate e lo scheduler acceso. La Fase 2 è stata rilasciata il 19/11 alle 09:28 UTC, sopprimendo l'arretrato con `backend/db/tools/sopprimi-eventi-passati.sql`, e lo stock alle 09:58 UTC. Per un rilascio senza migrazioni delicate bastano:

```
cd ~/doliGAS
git status && git log origin/main..main      # deve essere vuoto: niente lavoro locale
git fetch origin && git merge --ff-only origin/main
docker compose up -d --build
docker compose exec gashub-api npm run migrate:status
```
Sul server `git fetch` richiede l'inoltro dell'agente SSH (`ssh -A`), perché il server non ha una chiave GitHub sua.

### Da provare dall'interfaccia dopo il rilascio
Flussi nuovi che nessuno ha ancora toccato dal browser:
- coordinatore: modifica di un ciclo (prima dava 404) e import CSV del catalogo;
- socio: dichiarazione di una ricarica dal portafoglio, poi approvazione del coordinatore;
- produttore: pagina Ordini, che prima era sempre vuota (serve un ciclo a mercato chiuso con ordini).
- socio: negozio con "Disponibili: N" ed "Esaurito" sui prodotti con stock (sulla demo sono 7), e il rifiuto quando si chiede più del disponibile;
- produttore: conferma della fornitura dopo la chiusura del mercato, che ora resta salvata per ciclo.

## Prossimi passi
Il piano completo è in `docs/piano-stabilizzazione.md`; l'analisi dei problemi (#1–#17) è in `docs/analisi-codice.md`.

Fase 0 (sicurezza), Fase 1 (migrazioni) e Fase 2 (ciclo G1–G7, endpoint mancanti e stock) sono fatte e rilasciate. Resta:

1. **Fase 3, qualità:** test automatici (Jest + supertest su un MySQL di test) del flusso completo — ciclo, listino, validazione, ordine, pesatura, consegna, saldo; validazione degli input con schemi; pulizia del codice morto (`routes/contact.js`, `routes/admin/dashboard.js`, `routes/admin/products.js` non sono montati; mock nel frontend); proxy Vite che punta a `gashub-backend` invece di `gashub-api`; CI minima. Da allineare anche le traduzioni: a `en.json` e `fr.json` mancano 57 chiavi di `it.json`.
2. **Fase 4, connettore Dolibarr opzionale:** campi `external_ref` e `external_source`; per il produttore il suo Dolibarr (listino in entrata, ordini G5 come ordini cliente), per il GAS il proprio Dolibarr (fornitori, ordini fornitore, fatture ai soci); sincronizzazione asincrona con una tabella outbox.

### Decisioni in sospeso
- Le tabelle `permissions`, `role_permissions` e `user_permissions` esistono nel database ma nessun codice le usa: erano il disegno di permessi granulari, di cui resta traccia in `frontend/src/mockCoordinatorData.js` (dieci permessi, ruoli personalizzabili come "Volontario Logistica"). Da realizzare o rimuovere con una migrazione.
- `gas_holidays` è un duplicato mai usato di `holidays`, che è la tabella viva: da rimuovere con una migrazione.
- **SMTP:** finché `SMTP_HOST` non è configurato gli invii sono simulati e l'accesso dipende da `DEMO_SHOW_OTP`. Configurarlo è la precondizione per aprire la demo a persone esterne, e il momento in cui ricontrollare i destinatari delle notifiche automatiche.

## Comandi utili (in `backend/`)
- `npm run migrate` applica le migrazioni mancanti; `npm run migrate:status` mostra lo stato senza modificare nulla.
- `npm test` esegue i test (Jest + supertest) sul database `doligas_test`; nel container: `docker compose exec gashub-api npm test`. Dettagli in `docs/sviluppo-locale.md`.
- `npm run seed:demo` carica i dati demo (rifiuta in produzione e su un database già popolato; `-- --reset` svuota prima).
- `npm run create-gas -- --name "GAS X" --slug x --admin-email a@b.c --admin-first A --admin-last B` crea un nuovo GAS con il suo coordinatore.

In locale i container si avviano con `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build` (il secondo file pubblica le porte, che il file principale non apre perché sulla VPS c'è un reverse proxy).

## Insidie note
- **Fine riga:** nel repository i file sono salvati con LF, nella cartella di lavoro su Windows con CRLF (`core.autocrlf=true` in questo repo). Non convertire i file a mano.
- In compose `NODE_ENV` prende il valore di `APP_ENV` (`dev`/`prod`), quindi `NODE_ENV === 'development'` non è mai vero nei container.
- `global.pool` viene usato ovunque tramite `getDb()`. Per le query usa `pool.execute` con parametri `?`, mai concatenazione.
- Le date del DB sono stringhe (`dateStrings: true`); i confronti temporali vanno fatti preferibilmente in SQL con `NOW()`.
- Le operazioni sul wallet vanno sempre in transazione: aggiornano `gas_memberships.balance` e inseriscono una riga in `wallet_transactions`.
- Non committare `.env` né `mysql-data/` (già esclusi in `.gitignore`); `.env.example` elenca tutte le variabili.
- **Migrazioni:** mai modificare un file già applicato (il checksum viene confrontato e la differenza segnalata); aggiungere sempre un nuovo file col numero successivo. In MySQL il DDL non è transazionale, quindi tenere ogni migrazione piccola.
- **Accesso senza SMTP:** la demo e l'ambiente locale non inviano email, quindi il codice di accesso torna nella risposta di login e il frontend lo mostra nella console di debug in basso a destra. Serve `DEMO_SHOW_OTP=true` nel `.env`, e per vedere la console serve `APP_ENV=dev`. Con quell'opzione attiva chiunque conosca un indirizzo email può entrare come quella persona: va spenta appena c'è SMTP, e non va mai usata su un'installazione reale.
- **Traduzioni:** a `en.json` e `fr.json` mancano 57 chiavi presenti in `it.json`, da allineare (Fase 3). Le chiavi nuove vanno aggiunte in tutte e tre le lingue.
- **Scheduler:** gli eventi inviati sono in `cycle_events`. Per far ripartire una notifica basta togliere la sua riga; spostando in avanti una data del ciclo, `PUT /api/admin/cycles/:id` lo fa da solo.
- **Due endpoint distinti per il produttore:** `PUT /api/products/bulk` modifica il listino e si blocca dopo G2; `POST /api/products/confirm-supply` conferma le quantità da consegnare e vale solo fra chiusura del mercato e consegna. Non confonderli.
- **Stock:** `products.stock` è il tetto del listino e non viene mai scalato. Il disponibile si calcola (stock meno quanto hanno ordinato gli altri soci nel ciclo) sia in `GET /members/shop` (`available`) sia in `POST /members/order`: se cambi uno dei due, cambia anche l'altro. La fornitura confermata dal produttore dopo G4 sta in `producer_cycle_supply`, non in `products.stock`.
- La ripartizione della pesatura usa `utils/allocation.js` (metodo dei resti maggiori): la somma delle quote è esattamente il totale ricevuto e le unità discrete restano numeri interi.

## Convenzioni
- **Tutto ciò che va su GitHub è in inglese**: messaggi di commit, titoli e descrizioni delle pull request, commenti. Commit piccoli, uno per argomento. **Senza righe di firma**: niente `Co-Authored-By` né `Claude-Session` nei messaggi di commit e nelle descrizioni delle pull request.
- **Commenti nel codice in inglese.** I messaggi rivolti agli utenti (errori delle API, log, interfaccia) restano in italiano, o passano da i18n.
- **Licenza AGPL-3.0-or-later.** Ogni file di codice (JS/JSX, SQL di seed e strumenti) comincia con il preambolo della licenza (copyright "Luigi Grillo (doliFarm)", riga `SPDX-License-Identifier: AGPL-3.0-or-later`): copialo da un file esistente quando ne crei uno nuovo. Fanno eccezione le migrazioni già applicate, che non si toccano (checksum); le migrazioni nuove lo includono.
- Dopo ogni modifica a un file JS: `node --check <file>`.
- Prima di modificare il comportamento del ciclo o del wallet, chiedi conferma a Luigi.
