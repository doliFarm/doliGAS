# mysql-init

Questa cartella è montata dal container MySQL su `/docker-entrypoint-initdb.d`: tutto quello
che c'è dentro viene eseguito **una sola volta**, alla creazione del volume dati.

**Qui non va più lo schema delle tabelle.** Lo schema è gestito dalle migrazioni in
`backend/db/migrations`, applicate dal backend all'avvio (vedi `backend/db/migrate.js`).
I vecchi file `01_schema.sql` e `02_demo_data.sql.KEEP` sono stati sostituiti da:

- `backend/db/migrations/001_schema_iniziale.sql` — lo schema, ricavato dal database reale;
- `backend/db/seeds/demo.sql` — i dati dimostrativi (`npm run seed:demo`).

Lo schema di riferimento della demo, come fotografato il 19/11/2026, resta in
`db/schema_produzione_2026-11-19.sql` a fini di confronto.
