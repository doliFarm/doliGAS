-- =============================================================================
-- doliGAS - Dati dimostrativi
-- Le date sono RELATIVE a quando si esegue il seed, così la demo è sempre "viva":
--   - un ciclo passato, già consegnato;
--   - un ciclo in corso con il mercato aperto (si può ordinare subito).
-- Eseguire con:  npm run seed:demo        (rifiuta se il database contiene già dati)
--                npm run seed:demo -- --reset   (svuota prima le tabelle: SOLO sviluppo)
-- I saldi dei soci sono coerenti con i movimenti: ricarica - ordini.
-- =============================================================================

-- GAS
INSERT INTO gas (id, name, slug, description, iban, website, email_contact) VALUES
(1, 'GAS Demo doliFarm', 'demo', 'Gruppo di Acquisto Solidale dimostrativo.', 'IT00X1234567890123456789012', 'www.dolifarm.com', 'info@dolifarm.com');

-- Utenti: 1 coordinatore, 4 produttori, 5 soci
INSERT INTO users (id, first_name, last_name, email, phone) VALUES
(1, 'Marco', 'Rossi', 'admin@gas.it', '3330000001'),
(2, 'Giovanni', 'Verga', 'bio@agrisole.it', '3330000002'),
(3, 'Elena', 'Bianchi', 'info@caseificio.it', '3330000003'),
(4, 'Pietro', 'Neri', 'forno@antico.it', '3330000004'),
(5, 'Carla', 'Bruni', 'cantina@vino.it', '3330000005'),
(6, 'Giulia', 'Verdi', 'giulia@socio.it', '3330000006'),
(7, 'Roberto', 'Gialli', 'roberto@socio.it', '3330000007'),
(8, 'Sara', 'Blu', 'sara@socio.it', '3330000008'),
(9, 'Luca', 'Viola', 'luca@socio.it', '3330000009'),
(10, 'Anna', 'Rosa', 'anna@socio.it', '3330000010');

-- Iscrizioni al GAS (saldo = ricarica iniziale - ordini)
INSERT INTO gas_memberships (gas_id, user_id, role_id, balance, created_by) VALUES
(1, 1, 1, 0.00, 1),
(1, 2, 2, 0.00, 1), (1, 3, 2, 0.00, 1), (1, 4, 2, 0.00, 1), (1, 5, 2, 0.00, 1),
(1, 6, 3, 124.00, 1),  -- 150.00 - 26.00
(1, 7, 3, 60.00, 1),   -- 80.50 - 20.50
(1, 8, 3, 95.00, 1),   -- 200.00 - 105.00
(1, 9, 3, 45.00, 1),
(1, 10, 3, 108.50, 1); -- 120.00 - 11.50

-- Produttori e categorie
INSERT INTO producers (id, gas_id, user_id, business_name, contact_email, created_by) VALUES
(1, 1, 2, 'Azienda Agricola Sole', 'bio@agrisole.it', 1),
(2, 1, 3, 'Caseificio Valli', 'info@caseificio.it', 1),
(3, 1, 4, 'Il Forno Antico', 'forno@antico.it', 1),
(4, 1, 5, 'Cantina Sociale', 'cantina@vino.it', 1);

INSERT INTO product_categories (id, gas_id, name, created_by) VALUES
(1, 1, 'Ortofrutta', 1), (2, 1, 'Latticini', 1), (3, 1, 'Forno', 1), (4, 1, 'Bevande', 1);

-- Catalogo (unità: 1=kg, 4=pz, 5=bt, 6=conf, 7=sac, 8=lat, 9=vas)
INSERT INTO products (id, producer_id, category_id, unit_id, name, price, min_order_qty, is_active, created_by) VALUES
(1, 1, 1, 1, 'Arance Navel', 2.00, 1, 1, 1),
(2, 1, 1, 1, 'Mele Golden', 2.50, 1, 1, 1),
(3, 1, 1, 7, 'Patate Bio (sacco 5 kg)', 6.00, 1, 1, 1),
(4, 2, 2, 4, 'Pecorino Stagionato', 12.00, 1, 1, 1),
(5, 2, 2, 1, 'Ricotta Fresca', 9.00, 1, 1, 1),
(6, 2, 2, 9, 'Yogurt Naturale', 1.50, 1, 1, 1),
(7, 3, 3, 1, 'Pane Toscano', 3.50, 1, 1, 1),
(8, 3, 3, 4, 'Focaccia', 5.00, 1, 1, 1),
(9, 3, 3, 6, 'Biscotti Secchi', 4.00, 1, 1, 1),
(10, 4, 4, 5, 'Vino Rosso Chianti', 8.50, 1, 1, 1),
(11, 4, 4, 8, 'Olio Extravergine (latta 5 L)', 45.00, 1, 1, 1),
(12, 4, 4, 5, 'Succo di Mele', 3.00, 1, 1, 1);

-- Cicli: uno passato (consegnato) e uno in corso con il mercato aperto
INSERT INTO cycles (id, gas_id, name, is_active, start_at, producers_deadline, market_open_at, market_close_at, orders_sent_at, confirmation_at, delivery_at, created_by) VALUES
(1, 1, 'Ciclo precedente', 0,
    NOW() - INTERVAL 24 DAY, NOW() - INTERVAL 22 DAY, NOW() - INTERVAL 21 DAY, NOW() - INTERVAL 16 DAY,
    NOW() - INTERVAL 16 DAY, NOW() - INTERVAL 15 DAY, NOW() - INTERVAL 14 DAY, 1),
(2, 1, 'Ciclo in corso', 1,
    NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 3 DAY, NOW() + INTERVAL 2 DAY,
    NOW() + INTERVAL 2 DAY + INTERVAL 1 HOUR, NOW() + INTERVAL 3 DAY, NOW() + INTERVAL 4 DAY, 1);

-- Listini validati per il ciclo in corso (la Cantina Sociale NON ha validato: i suoi prodotti non sono in bottega)
INSERT INTO producer_cycle_validations (producer_id, cycle_id, is_validated, validated_at) VALUES
(1, 2, 1, NOW() - INTERVAL 5 DAY),
(2, 2, 1, NOW() - INTERVAL 5 DAY),
(3, 2, 1, NOW() - INTERVAL 4 DAY);

-- Ordini confermati nel ciclo in corso
INSERT INTO orders (id, gas_id, user_id, cycle_id, total_amount, status, created_at) VALUES
(1, 1, 6, 2, 26.00, 'confirmed', NOW() - INTERVAL 2 DAY),
(2, 1, 7, 2, 20.50, 'confirmed', NOW() - INTERVAL 2 DAY),
(3, 1, 8, 2, 105.00, 'confirmed', NOW() - INTERVAL 1 DAY),
(4, 1, 10, 2, 11.50, 'confirmed', NOW() - INTERVAL 1 DAY);

INSERT INTO order_items (order_id, product_id, quantity, price_at_order) VALUES
(1, 1, 3.00, 2.00), (1, 2, 2.00, 2.50), (1, 4, 1.00, 12.00), (1, 6, 2.00, 1.50),
(2, 7, 2.00, 3.50), (2, 8, 1.00, 5.00), (2, 3, 1.00, 6.00), (2, 2, 1.00, 2.50),
(3, 4, 5.00, 12.00), (3, 5, 3.00, 9.00), (3, 1, 6.00, 2.00), (3, 6, 4.00, 1.50),
(4, 2, 2.00, 2.50), (4, 9, 1.00, 4.00), (4, 1, 1.25, 2.00);

-- Movimenti wallet coerenti con i saldi
INSERT INTO wallet_transactions (gas_id, user_id, amount, type, status, description, created_at, created_by) VALUES
(1, 6, 150.00, 'DEPOSIT', 'completed', 'Ricarica iniziale', NOW() - INTERVAL 10 DAY, 1),
(1, 7, 80.50, 'DEPOSIT', 'completed', 'Ricarica iniziale', NOW() - INTERVAL 10 DAY, 1),
(1, 8, 200.00, 'DEPOSIT', 'completed', 'Ricarica iniziale', NOW() - INTERVAL 10 DAY, 1),
(1, 9, 45.00, 'DEPOSIT', 'completed', 'Ricarica iniziale', NOW() - INTERVAL 10 DAY, 1),
(1, 10, 120.00, 'DEPOSIT', 'completed', 'Ricarica iniziale', NOW() - INTERVAL 10 DAY, 1),
(1, 6, -26.00, 'SPESA', 'completed', 'Nuovo Ordine Ciclo #2', NOW() - INTERVAL 2 DAY, NULL),
(1, 7, -20.50, 'SPESA', 'completed', 'Nuovo Ordine Ciclo #2', NOW() - INTERVAL 2 DAY, NULL),
(1, 8, -105.00, 'SPESA', 'completed', 'Nuovo Ordine Ciclo #2', NOW() - INTERVAL 1 DAY, NULL),
(1, 10, -11.50, 'SPESA', 'completed', 'Nuovo Ordine Ciclo #2', NOW() - INTERVAL 1 DAY, NULL),
-- Una ricarica in attesa di approvazione del coordinatore
(1, 9, 50.00, 'DEPOSIT', 'pending', 'Bonifico in arrivo', NOW() - INTERVAL 1 DAY, 9);

-- Template delle notifiche automatiche (come li crea create-gas.js per un GAS nuovo)
INSERT INTO notification_templates (gas_id, event_key, subject, body) VALUES
(1, 'G1_OPEN', 'Apertura Listini - {{cycle_name}}', 'Ciao, è aperta la fase di aggiornamento listini per il ciclo {{cycle_name}}. Hai tempo fino al {{deadline}}.'),
(1, 'G3_SHOP_OPEN', 'Mercato Aperto! 🛒', 'Cari soci, il mercato per {{cycle_name}} è aperto. Chiusura prevista: {{close_date}}.'),
(1, 'G4_REMINDER', '⏳ 3 Ore alla Chiusura', 'Affrettati! Il mercato per {{cycle_name}} chiude tra 3 ore. Controlla il tuo carrello.'),
(1, 'G5_PROD_ORDER', 'Nuovi Ordini da Preparare 📦', 'Gli ordini per {{cycle_name}} sono confermati. Accedi alla dashboard per scaricare la lista di preparazione.');

-- Notifiche di esempio
INSERT INTO notifications (gas_id, user_id, target_profile, title, message, type, is_read) VALUES
(1, 6, 'member', 'Benvenuta in doliGAS!', 'Il mercato del ciclo in corso è aperto. Buona spesa!', 'success', 0),
(1, 7, 'member', 'Attenzione al credito', 'Il tuo saldo sta scendendo. Ricorda di ricaricare.', 'warning', 0),
(1, 5, 'producer', 'Listino da validare', 'Il listino della Cantina Sociale non è stato validato per il ciclo in corso.', 'warning', 0);
