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

Nessuna di queste modifiche è ancora in produzione sulla demo.

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

## Fase 1 — Il database come base affidabile ⏭ prossima
- ✅ Schema reale ottenuto. È quasi allineato al codice; in produzione ci sono in più le tabelle `gas_holidays`, `permissions`, `role_permissions` e `user_permissions` (non usate dal codice) e la colonna `gas.manage_orders`. `01_schema.sql` è rotto (#10).
- Usare lo schema reale come migrazione `001` e introdurre migrazioni SQL numerate con una tabella `schema_migrations`, applicate all'avvio.
- Decidere se tenere o eliminare le tabelle dei permessi non usate.
- Tenere un seed demo separato; verificare che un'installazione da zero funzioni.

## Fase 2 — Ciclo G1–G7 completo e coerente
- ✅ Consegna con conguaglio (#7, #8).
- Scheduler: avviarlo e renderlo idempotente con una tabella degli eventi già inviati per ciclo (#9); correggere lo stato usato per il MOQ.
- Endpoint mancanti: modifica ciclo, import CSV del catalogo, ordini del produttore (lista di preparazione), richiesta di ricarica del socio (#11–13).
- Stock (#15); arrotondamento delle unità discrete nella ripartizione della pesatura.

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
