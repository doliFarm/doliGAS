-- doliGAS - Solidarity purchasing group (GAS) management platform
-- Copyright (C) 2026 Luigi Grillo (doliFarm)
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU Affero General Public License as published
-- by the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU Affero General Public License for more details.
--
-- You should have received a copy of the GNU Affero General Public License
-- along with this program.  If not, see <https://www.gnu.org/licenses/>.
--
-- SPDX-License-Identifier: AGPL-3.0-or-later

-- =============================================================================
-- doliGAS - Demo data
-- Dates are RELATIVE to when the seed runs, so the demo is always "alive":
--   - a past cycle, already delivered;
--   - a cycle in progress with the market open (orders can be placed right away).
-- Run with:  npm run seed:demo        (refuses if the database already has data)
--            npm run seed:demo -- --reset   (empties the tables first: development ONLY)
-- Member balances match the transactions: top-up - orders.
-- =============================================================================

-- GAS
INSERT INTO gas (id, name, slug, description, iban, website, email_contact) VALUES
(1, 'GAS Demo doliFarm', 'demo', 'Gruppo di Acquisto Solidale dimostrativo.', 'IT00X1234567890123456789012', 'www.dolifarm.com', 'info@dolifarm.com');

-- Users: 1 coordinator, 4 producers, 5 members
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

-- GAS memberships (balance = initial top-up - orders)
INSERT INTO gas_memberships (gas_id, user_id, role_id, balance, created_by) VALUES
(1, 1, 1, 0.00, 1),
(1, 2, 2, 0.00, 1), (1, 3, 2, 0.00, 1), (1, 4, 2, 0.00, 1), (1, 5, 2, 0.00, 1),
(1, 6, 3, 124.00, 1),  -- 150.00 - 26.00
(1, 7, 3, 60.00, 1),   -- 80.50 - 20.50
(1, 8, 3, 95.00, 1),   -- 200.00 - 105.00
(1, 9, 3, 45.00, 1),
(1, 10, 3, 108.50, 1); -- 120.00 - 11.50

-- Producers and categories
INSERT INTO producers (id, gas_id, user_id, business_name, contact_email, created_by) VALUES
(1, 1, 2, 'Azienda Agricola Sole', 'bio@agrisole.it', 1),
(2, 1, 3, 'Caseificio Valli', 'info@caseificio.it', 1),
(3, 1, 4, 'Il Forno Antico', 'forno@antico.it', 1),
(4, 1, 5, 'Cantina Sociale', 'cantina@vino.it', 1);

INSERT INTO product_categories (id, gas_id, name, created_by) VALUES
(1, 1, 'Ortofrutta', 1), (2, 1, 'Latticini', 1), (3, 1, 'Forno', 1), (4, 1, 'Bevande', 1);

-- Catalog (units: 1=kg, 4=pz, 5=bt, 6=conf, 7=sac, 8=lat, 9=vas)
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

-- Cycles: one past (delivered) and one in progress with the market open
INSERT INTO cycles (id, gas_id, name, is_active, start_at, producers_deadline, market_open_at, market_close_at, orders_sent_at, confirmation_at, delivery_at, created_by) VALUES
(1, 1, 'Ciclo precedente', 0,
    NOW() - INTERVAL 24 DAY, NOW() - INTERVAL 22 DAY, NOW() - INTERVAL 21 DAY, NOW() - INTERVAL 16 DAY,
    NOW() - INTERVAL 16 DAY, NOW() - INTERVAL 15 DAY, NOW() - INTERVAL 14 DAY, 1),
(2, 1, 'Ciclo in corso', 1,
    NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 3 DAY, NOW() + INTERVAL 2 DAY,
    NOW() + INTERVAL 2 DAY + INTERVAL 1 HOUR, NOW() + INTERVAL 3 DAY, NOW() + INTERVAL 4 DAY, 1);

-- Price lists validated for the current cycle (Cantina Sociale has NOT validated: its products are not in the shop)
INSERT INTO producer_cycle_validations (producer_id, cycle_id, is_validated, validated_at) VALUES
(1, 2, 1, NOW() - INTERVAL 5 DAY),
(2, 2, 1, NOW() - INTERVAL 5 DAY),
(3, 2, 1, NOW() - INTERVAL 4 DAY);

-- Confirmed orders in the current cycle
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

-- Wallet transactions consistent with the balances
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
-- A top-up awaiting the coordinator's approval
(1, 9, 50.00, 'DEPOSIT', 'pending', 'Bonifico in arrivo', NOW() - INTERVAL 1 DAY, 9);

-- Automatic notification templates (as create-gas.js creates them for a new GAS)
INSERT INTO notification_templates (gas_id, event_key, subject, body) VALUES
(1, 'G1_OPEN', 'Apertura Listini - {{cycle_name}}', 'Ciao, è aperta la fase di aggiornamento listini per il ciclo {{cycle_name}}. Hai tempo fino al {{deadline}}.'),
(1, 'G3_SHOP_OPEN', 'Mercato Aperto! 🛒', 'Cari soci, il mercato per {{cycle_name}} è aperto. Chiusura prevista: {{close_date}}.'),
(1, 'G4_REMINDER', '⏳ 3 Ore alla Chiusura', 'Affrettati! Il mercato per {{cycle_name}} chiude tra 3 ore. Controlla il tuo carrello.'),
(1, 'G5_PROD_ORDER', 'Nuovi Ordini da Preparare 📦', 'Gli ordini per {{cycle_name}} sono confermati. Accedi alla dashboard per scaricare la lista di preparazione.');

-- Sample notifications
INSERT INTO notifications (gas_id, user_id, target_profile, title, message, type, is_read) VALUES
(1, 6, 'member', 'Benvenuta in doliGAS!', 'Il mercato del ciclo in corso è aperto. Buona spesa!', 'success', 0),
(1, 7, 'member', 'Attenzione al credito', 'Il tuo saldo sta scendendo. Ricorda di ricaricare.', 'warning', 0),
(1, 5, 'producer', 'Listino da validare', 'Il listino della Cantina Sociale non è stato validato per il ciclo in corso.', 'warning', 0);
