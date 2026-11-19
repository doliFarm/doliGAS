-- =============================================================================
-- doliGAS - Migrazione 004: fornitura confermata dal produttore, per ciclo
-- Dopo la chiusura del mercato (G4) il produttore conferma quanto consegnerà
-- davvero di ogni prodotto. Prima questa quantità veniva scritta sopra
-- products.stock, che però è la disponibilità del LISTINO e vale per tutti i
-- cicli: la conferma di un ciclo finiva per limitare anche i successivi.
-- Ora products.stock resta il tetto impostato nel listino, e la conferma vive
-- qui, legata al ciclo.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `producer_cycle_supply` (
    `cycle_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `confirmed_qty` DECIMAL(10,3) NOT NULL,
    `confirmed_by` INT DEFAULT NULL,
    `confirmed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`cycle_id`, `product_id`),
    KEY `idx_supply_product` (`product_id`),
    CONSTRAINT `producer_cycle_supply_ibfk_1` FOREIGN KEY (`cycle_id`) REFERENCES `cycles` (`id`) ON DELETE CASCADE,
    CONSTRAINT `producer_cycle_supply_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
