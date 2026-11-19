-- =============================================================================
-- doliGAS - Migrazione 002: il codice OTP non deve essere unico a livello globale
-- Con UNIQUE(token), due utenti che ricevono per caso lo stesso codice a 6 cifre
-- nello stesso momento facevano fallire il login del secondo (errore 500).
-- Il codice è unico per utente, non per tutto il sistema.
-- =============================================================================

ALTER TABLE `magic_links`
    DROP INDEX `token`,
    ADD INDEX `idx_magic_user_token` (`user_id`, `token`);
