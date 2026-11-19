# Sviluppo in locale sulla workstation

Flusso di lavoro: **si sviluppa in locale sulla workstation**, si valida sulla **VPS demo**,
e il passaggio tra le due avviene **tramite GitHub**. Niente modifiche fatte a mano sul server.

```
workstation (Docker, APP_ENV=dev)
      │  git push
      ▼
   GitHub  ──── pull request ──── main
      │  git pull (sul server)
      ▼
VPS demo (validazione)
```

## Prima installazione in locale

Serve Docker Desktop con WSL2.

**1. Prendi il codice**
```
git clone git@github.com:doliFarm/doliGAS.git
cd doliGAS
```

**2. Crea la rete del proxy.** Il file principale si aspetta una rete esterna, che sulla
VPS è quella del reverse proxy. In locale basta crearla una volta:
```
docker network create proxy_net
```

**3. Scrivi il `.env`** copiando `.env.example` e cambiando questi valori:
```
APP_ENV=dev
DB_ROOT_PASSWORD=locale
DB_NAME=doligas
DB_USER=doligas
DB_PASSWORD=locale
API_PORT=3000
PROXY_NETWORK_NAME=proxy_net
VITE_API_URL=
JWT_SECRET=      # generare con: openssl rand -hex 32
DEMO_SHOW_OTP=true
```
`APP_ENV=dev` fa partire nodemon per il backend e il server di sviluppo di Vite per il
frontend, con il ricaricamento automatico al salvataggio dei file.
`DEMO_SHOW_OTP=true` fa comparire il codice di accesso nella console di debug in basso a
destra: in locale non c'è SMTP, quindi è l'unico modo per entrare.

**4. Avvia**, nominando anche il file delle porte locali:
```
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
docker compose logs -f gashub-api
```
Nei log devi vedere le migrazioni applicate e `🚀 Backend doliGAS online`.

**5. Carica i dati dimostrativi**
```
docker compose exec gashub-api npm run seed:demo
```
Oppure, per partire da un GAS vuoto con il tuo utente come coordinatore:
```
docker compose exec gashub-api npm run create-gas -- \
  --name "GAS di prova" --slug demo \
  --admin-email tua@email.it --admin-first Nome --admin-last Cognome
```

**6. Apri** http://localhost:8080. Il GAS si sceglie dal campo nella pagina di accesso
(slug `demo`). Entra con un indirizzo del seed, per esempio `admin@gas.it` come
coordinatore o `giulia@socio.it` come socia, e leggi il codice dalla console di debug.

## Uso quotidiano

```
# avvio e spegnimento
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
docker compose down

# log
docker compose logs -f gashub-api

# dopo aver aggiunto una migrazione
docker compose restart gashub-api        # le applica all'avvio
docker compose exec gashub-api npm run migrate:status

# ripartire da dati demo puliti
docker compose exec gashub-api npm run seed:demo -- --reset

# il database a mano
docker compose exec gashub-db mysql -u root -p"$DB_ROOT_PASSWORD" doligas
```
Il codice di `backend/` e `frontend/` è montato dentro i container, quindi le modifiche ai
file si vedono subito senza ricostruire. Serve `--build` solo quando cambiano le dipendenze
(`package.json`) o i `Dockerfile`, e in quel caso aggiungi `-V`: i `node_modules` stanno in
un volume anonimo che altrimenti resterebbe quello vecchio, senza le dipendenze nuove.
```
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build -V gashub-api
```

## Test automatici

I test del backend (`backend/test/`, Jest + supertest) girano contro un MySQL vero, su un
database a parte, `doligas_test`, che viene creato al primo avvio con la password di root
del `.env`. Ogni file di test svuota quel database e ricarica il seed demo, quindi i dati
di sviluppo in `doligas` non vengono toccati. Per sicurezza i test si rifiutano di partire
se il nome del database non finisce con `_test`.
```
docker compose exec gashub-api npm test                         # tutti
docker compose exec gashub-api npx jest test/order.test.js      # un file, con i log
```
Cosa coprono: accesso con OTP e contesto GAS, ordine con addebito immediato e modifiche,
credito e GAS "di fiducia", stock, listino e validazione per ciclo, conferma della fornitura,
pesatura con ripartizione, consegna con conguaglio e coerenza fra saldo e movimenti,
ricarica del socio, scheduler G1-G7.

Per scrivere un test nuovo parti da `backend/test/helpers.js`: `resetDb()` ricarica i dati,
`as(USERS.giulia)` fa le richieste autenticate come quell'utente, `setPhase('chiuso')`
sposta il ciclo in corso in una fase (`listini`, `mercato`, `chiuso`), `sql()` legge e
scrive direttamente nel database.

Su GitHub gli stessi test girano a ogni push e pull request (`.github/workflows/ci.yml`),
insieme alla build del frontend.

## Ripartire da zero
```
docker compose -f docker-compose.yml -f docker-compose.local.yml down
rm -rf mysql-data
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```
Le migrazioni ricreano lo schema da sole.

## Differenze fra locale e VPS

| | workstation | VPS demo |
|---|---|---|
| `APP_ENV` | `dev` | `dev` (serve per la console di debug) |
| Porte | pubblicate su 127.0.0.1 via `docker-compose.local.yml` | solo `expose`, dietro il reverse proxy |
| `DEMO_SHOW_OTP` | `true` | `true` finché non c'è SMTP |
| `VITE_DEMO_MODE` | `false` | `true` (avviso "istanza dimostrativa") |
| Dati | seed demo | dati di prova condivisi |

## Portare il lavoro sulla VPS

```
# sulla workstation
git checkout -b nome-del-lavoro
git commit -m "..."
git push -u origin nome-del-lavoro
```
Poi pull request su GitHub e merge in `main`. **Sul server**, prima di aggiornare,
controlla sempre che non ci sia lavoro locale non pubblicato:
```
cd ~/doliGAS
git status
git log origin/main..main      # deve essere vuoto
git fetch origin && git reset --hard origin/main
docker compose up -d --build
docker compose logs -f gashub-api
```
Se `git log origin/main..main` mostra qualcosa, quel lavoro esiste solo sul server:
pubblicalo prima su un ramo (`git push origin main:nome-ramo`) e integralo da GitHub.

## Quando ci sarà SMTP
Configurando `SMTP_HOST` il codice arriva per email e `DEMO_SHOW_OTP` va spento, sia in
locale sia sulla demo. È la prima cosa da fare prima di aprire la demo a persone esterne.
