# doliGAS — Analisi del codice (18/11/2026)

> **Stato al 19/11/2026:** i problemi #1–#8 e #14 sono risolti nel codice (commit `d2431a6` e `07eb65b`), ma non ancora in produzione. Il #10 è affrontato dalla Fase 1 (vedi `piano-stabilizzazione.md`).

Sorgente analizzato: 100 file, ~15k righe, senza repository git e senza test (al momento dell'analisi).

## 1. Cos'è
Web app multi-tenant per i Gruppi di Acquisto Solidale (GAS), con tre profili: **Coordinatore**, **Produttore** e **Socio**. Il README la presenta come "ponte con Dolibarr", ma **nel codice non c'è alcuna integrazione con Dolibarr/doliFarm**: è un'app autonoma con il suo database MySQL.

## 2. Architettura
- **Backend:** Node.js + Express, `mysql2` (SQL scritto a mano, niente ORM), JWT, nodemailer, node-cron.
- **Frontend:** React 18 + Vite + Tailwind, react-router, i18next (it/en/fr), recharts.
- **DB:** MySQL 8.4, schema in `mysql-init/01_schema.sql` (v22).
- **Deploy:** docker-compose con tre container (`gashub-db`, `gashub-api`, `gashub-frontend`), una rete interna e una rete proxy esterna.
- Domini previsti: doligas.com/.it, demo.dolifarm365.com; un sottodominio identifica il GAS (slug).

## 3. Modello dati
- `users` (globali) ↔ `gas_memberships` (utente-GAS-ruolo, con il **saldo wallet**)
- `gas` (tenant, con gli offset G1–G7 e i flag operativi)
- `producers` (per GAS, collegabili a un utente), `products`, `product_categories`, `product_units`
- `cycles` (ciclo d'ordine con 7 date), `orders` (draft/confirmed/processing/delivered/cancelled), `order_items` (quantità ordinata, quantità ricevuta, prezzo bloccato)
- `wallet_transactions` (DEPOSIT/WITHDRAWAL/SPESA/REFUND, pending/completed)
- `producer_cycle_validations` (il produttore "valida" il listino per un ciclo)
- `notifications`, `notification_templates`, `holidays`, `magic_links` (OTP), `leads`, `page_views`

## 4. Il ciclo G1–G7
Ogni ciclo d'ordine ha 7 tappe, calcolate da offset in giorni rispetto alla consegna:
G1 avvio → G2 scadenza listini produttori → G3 apertura ordini soci → G4 chiusura ordini → G5 invio ordini ai fornitori → G6 ricezione merce (pesatura) → G7 consegna e checkout.
Il coordinatore crea cicli singoli o ripetuti (settimanali, quindicinali o mensili, massimo 12).

## 5. Funzionalità per profilo
**Login:** senza password, con un OTP di 6 cifre via email (15 minuti) e un JWT di 30 giorni. Un utente può avere più profili; il coordinatore riceve anche un profilo "Socio" virtuale per fare acquisti.

**Coordinatore** (`/api/admin/*`):
- dashboard con KPI e grafici;
- anagrafica soci: crea e modifica, azioni massive, protezione dell'ultimo coordinatore;
- wallet: ricarica manuale, approvazione delle ricariche, estratto conto;
- cicli e festività, produttori, catalogo;
- logistica: pesatura con ripartizione proporzionale del ricevuto tra i soci, lista di checkout, ricevuta, consegna;
- impostazioni del GAS, categorie, template delle notifiche;
- invio di messaggi interni.

**Produttore** (`/api/products/*`): dashboard con lo stato del ciclo, gestione del proprio listino (CRUD e modifica massiva), validazione del listino per il ciclo (ogni modifica la revoca), messaggi.

**Socio** (`/api/members/*`):
- dashboard: saldo, prossima consegna, stato del mercato;
- bottega con i soli prodotti dei produttori che hanno validato il listino;
- ordine con addebito immediato sul wallet, o saldo negativo se il GAS lo consente;
- storico ordini, wallet, profilo.

**Pubblico:** landing page, form contatti (`leads`), tracciamento delle visite.

## 6. Problemi trovati
### Sicurezza (critici)
1. `/api/debug/*` era pubblico e restituiva i log, che contenevano gli OTP in chiaro. Chiunque poteva leggere il codice di accesso di qualunque utente.
2. Il JWT secret ripiegava su una stringa fissa in `routes/auth.js` quando mancava nel `.env`.
3. Accesso possibile tra GAS diversi in logistica: il middleware verificava il `gasId` della query, ma `checkin/bulk-update` e `checkout/deliver` usavano il `gasId` del body.
4. L'ordine del socio non verificava che il mercato fosse aperto né che il `cycleId` appartenesse al GAS.
5. Le API del produttore non controllavano la scadenza G2.
6. L'HTML nelle email dei contatti non veniva neutralizzato.

### Bug funzionali
7. La consegna (G7) scriveva su `wallet_history`, una tabella inesistente, quindi andava sempre in rollback.
8. Doppio addebito: il socio pagava all'ordine e di nuovo alla consegna (il totale intero, non la differenza).
9. Lo scheduler G1–G7 non parte mai, perché `runScheduler()` non viene chiamato in `server.js`. Il controllo MOQ cerca `status = 'pending'`, che negli ordini non esiste.
10. Lo schema SQL non si installa su un DB nuovo: la colonna `manage_payments` è duplicata, c'è un `;` dentro la CREATE di `notifications` e manca `manage_orders`.
11. Endpoint chiamati dal frontend ma assenti nel backend: `PUT /api/admin/cycles/:id`, `POST /api/admin/catalog/validate` e `/bulk-import`.
12. La pagina "Ordini" del produttore non ha un backend: legge `/api/products` cercando `ordered_qty`, che non esiste.
13. Il socio non ha modo di richiedere una ricarica (nessun endpoint crea transazioni `pending`).
14. `public/contact` chiamava `sendEmail({...})` con un oggetto, invece che con argomenti posizionali.
15. Lo stock dei prodotti non viene mai scalato né controllato.
16. Il proxy di Vite punta a `gashub-backend` invece di `gashub-api`, e l'nginx del frontend non fa da proxy per `/api`.
17. Codice morto: `routes/contact.js`, `routes/admin/dashboard.js` e `routes/admin/products.js` non sono montati; nel frontend ci sono dei mock; `sendOTPLink` non viene usata.

### Qualità e manutenzione
- Nessun test e nessuna migrazione del DB.
- Pattern ripetuti (`getDb`, `getGasId`) e validazione degli input fatta a mano e in modo disomogeneo.
- I log stanno in un buffer in memoria che sovrascrive `console.log` a livello globale.

## 7. doliFarm e possibili punti di aggancio
`../dolifarm` è un modulo Dolibarr (PHP), ancora vicino allo scheletro del modulebuilder, con sottomoduli in `_CUSTOM` (doliprices, dolitrace, dolilogistic, addorder…). Corrispondenze naturali:
- Produttori ↔ terze parti (fornitori) di Dolibarr
- Prodotti e listini ↔ prodotti e prezzi fornitore (doliprices)
- Ordini aggregati del ciclo (G5) ↔ ordini fornitore
- Consegna ↔ ordini cliente o fatture ai soci; wallet ↔ pagamenti
- Tracciabilità ↔ dolitrace

Il canale tecnico più semplice è la REST API di Dolibarr chiamata dal backend Node.
