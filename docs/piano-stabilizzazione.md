# doliGAS — Piano di stabilizzazione (aggiornato 19/11/2026)

**Indirizzo deciso:** doliGAS è una piattaforma indipendente. L'integrazione con Dolibarr/doliFarm è opzionale e si attiva per i GAS più complessi o per i produttori che la chiedono. Installazione attiva: https://demo.dolifarm365.com

I numeri #n rimandano ai problemi elencati in `analisi-codice.md`.

## Decisioni prese
- La copia locale coincide con il codice della demo (baseline `d5fcaae`).
- **Wallet:** l'importo ordinato si scala subito all'ordine; alla consegna si fa il conguaglio sul peso reale (SPESA se costa di più, REFUND se costa di meno).
- Il repository git è su `main`, con un commit per argomento.

## Stato di avanzamento
| Commit | Contenuto |
|---|---|
| `d5fcaae` | Baseline (stato della demo al 19/11) |
| `2faa6dc` | Fase 0: messa in sicurezza del backend |
| `8d6d93f` | Schema reale del DB della demo → `db/schema_produzione_2026-11-19.sql` |
| `1c8b764` | Consegna G7 con conguaglio, niente doppio addebito (#7, #8) |
| `da5a393`, `6a5f671` | Contesto per Claude Code (`CLAUDE.md`) e documenti in `docs/` |
| `0f9e446` | Fase 1: migrazioni, seed demo, creazione GAS, ripartizione pesatura (#10) |
| `fcc8ad3` | Merge PR #3: integrazione del lavoro fatto a mano sulla demo, avviso demo dietro `VITE_DEMO_MODE`, `DEMO_SHOW_OTP`, sviluppo locale |
| `4f6b6bf` | Fase 2: scheduler G1–G7, MOQ, rotazione log |
| `2fbfbdd` | Fase 2: modifica ciclo, ordini del produttore, conferma fornitura |
| `fdfb3f3` | Fase 2: import CSV del catalogo, richiesta di ricarica del socio |

Si lavora sul branch `stabilizzazione`, con una pull request aperta verso `main`. Nessuna di queste modifiche è ancora in produzione sulla demo.

## Fase 0 — Messa in sicurezza ✅ codice fatto, da distribuire
**Sul server demo (a carico di Luigi):**
- Bloccare `/api/debug/*` nel reverse proxy finché la nuova versione non è online.
- Nuovo `JWT_SECRET` di almeno 32 caratteri (`openssl rand -hex 32`), poi riavviare l'API.
- Controllare nei log del proxy se ci sono chiamate a `/api/debug/logs` da IP esterni.
- Non impostare `ENABLE_DEBUG_API` sulla demo.

**Nel codice (fatto):**
- Debug API attiva solo con `ENABLE_DEBUG_API=true` e fuori produzione, comunque solo con login.
- OTP mai nei log; massimo 5 tentativi di verifica, poi il codice viene invalidato.
- `JWT_SECRET` obbligatorio: senza, il server non parte.
- `gasId` unico e verificato; logistica e rotte admin usano solo `req.user.verifiedGasId` (#3).
- Ordine del socio: ciclo del GAS, attivo, con il mercato aperto; quantità valide; prodotto del GAS (#4).
- Listino del produttore bloccato tra la scadenza G2 e la consegna (#5).
- Email dei contatti: HTML neutralizzato, invio solo all'amministratore (#6, #14).

## Fase 1 — Il database come base affidabile ✅ fatta
- Schema reale della demo diventato `backend/db/migrations/001_schema_iniziale.sql` (#10).
- Motore di migrazioni `backend/db/migrate.js`: file `NNN_*.sql` applicati una volta sola e registrati in `schema_migrations`, con lock contro esecuzioni concorrenti e confronto dei checksum. Su un database preesistente (la demo) la 001 è registrata come *baseline* senza essere eseguita. Le migrazioni partono all'avvio del backend, o a mano con `npm run migrate`.
- Migrazione `002`: il codice OTP non è più unico a livello globale ma per utente (due codici a 6 cifre identici facevano fallire il secondo login con un errore 500).
- `backend/db/seeds/demo.sql` + `seed.js`: dati demo con date relative a oggi (un ciclo passato e uno con il mercato aperto), saldi coerenti con i movimenti, un listino non validato e una ricarica in attesa. Rifiuta di partire in produzione e su un database già popolato.
- `backend/db/create-gas.js`: crea un nuovo GAS con il suo primo coordinatore e i template delle notifiche.
- `.env.example` con tutte le variabili; `mysql-init/` non contiene più lo schema.
- **Verificato** su MySQL 8: installazione da zero, database preesistente portato alla 002, e strutture finali identiche nei due casi.
- **Deciso dopo:** le tabelle `permissions`, `role_permissions`, `user_permissions` e `gas_holidays` restano nello schema ma non sono usate dal codice. Da valorizzare o rimuovere con una migrazione.

## Fase 2 — Ciclo G1–G7 completo e coerente ✅ fatta
- ✅ Consegna con conguaglio (#7, #8) e ripartizione della pesatura col metodo dei resti maggiori (`utils/allocation.js`).
- ✅ **Scheduler** avviato in `server.js` e reso ripetibile: migrazione `003`, con la tabella `cycle_events` e la chiave unica `(cycle_id, event_key)`. L'evento è registrato prima dell'invio, quindi riavvii e processi paralleli non duplicano le notifiche; la condizione è "la data è passata e l'evento non è partito", così le tappe mancate durante un fermo vengono recuperate. Spegnibile con `SCHEDULER_ENABLED=false` (#9).
- ✅ **MOQ** corretto: cercava `status='pending'`, che non esiste nell'enum.
- ✅ Avvisi del mercato a Soci e Coordinatori, non ai Produttori.
- ✅ Rotazione dei log nel compose (10 MB × 3 file per servizio).
- ✅ **Endpoint mancanti** (#11–13): `PUT /api/admin/cycles/:id` con validazione della sequenza delle sette date (applicata anche alla creazione) e normalizzazione del formato `datetime-local`; `ordered_qty` nella lista del produttore, che rendeva vuota la pagina Ordini; `POST /api/products/confirm-supply`, separato dal listino perché la conferma avviene quando il listino è bloccato; import CSV `validate` + `bulk-import` con rivalidazione server-side (`docs/import-csv-catalogo.md`); richiesta di ricarica del socio con avviso al coordinatore.
- ⏭ **Resta da fare:** gestione dello stock (#15), che oggi non viene né controllato né scalato.

## Fase 3 — Qualità e manutenibilità
- Test automatici (Jest + supertest su un DB MySQL di test) del flusso completo: ciclo, listino, validazione, ordine, pesatura, consegna, saldo.
- Validazione degli input con schemi; gestione degli errori uniforme; log strutturati.
- Pulizia del codice morto e dei mock; correzione di proxy Vite e nginx (#16, #17).
- In compose `NODE_ENV` prende il valore di `APP_ENV` (`dev`/`prod`): uniformare.
- CI minima e procedura di deploy documentata (`.env.example`, backup del DB).

## Fase 4 — Connettore Dolibarr (opzionale)
- Il nucleo non dipende da Dolibarr: il connettore è un modulo separato, disattivato di default.
- Campi di riferimento esterno (`external_ref`, `external_source`) su produttori, prodotti e ordini.
- **Produttore:** collega il proprio Dolibarr. Il listino arriva da Dolibarr; gli ordini aggregati G5 diventano ordini cliente nel suo Dolibarr (per lui il GAS è un cliente).
- **GAS complesso:** ha il proprio Dolibarr. I produttori sono fornitori, il G5 genera ordini fornitore, la consegna genera fatture o pagamenti dei soci.
- Sincronizzazione asincrona tramite una tabella outbox con nuovi tentativi: un Dolibarr irraggiungibile non blocca il GAS.
