-- =============================================================================
-- doliGAS - Migrazione 003: registro degli eventi del ciclo
-- Serve allo scheduler (backend/cron/scheduler.js) per sapere quali eventi
-- G1-G7 sono già stati notificati. La chiave unica (cycle_id, event_key)
-- garantisce che ogni evento parta una volta sola, anche se il server viene
-- riavviato o se due processi girano insieme.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `cycle_events` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `cycle_id` INT NOT NULL,
    `event_key` VARCHAR(50) NOT NULL COMMENT 'G1_OPEN, G2_DEADLINE, G3_SHOP_OPEN, G4_REMINDER, G4_CLOSE, G5_PROD_ORDER',
    `sent_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `recipients` INT DEFAULT NULL COMMENT 'Quanti destinatari sono stati raggiunti',
    PRIMARY KEY (`id`),
    UNIQUE KEY `unq_cycle_event` (`cycle_id`, `event_key`),
    CONSTRAINT `cycle_events_ibfk_1` FOREIGN KEY (`cycle_id`) REFERENCES `cycles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
