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
-- doliGAS - Suppression of the already past events of active cycles
--
-- Run it ONCE, when the scheduler starts for the first time on an installation
-- that already has cycles in progress. Without it, the scheduler sees steps with
-- a past date that were never notified and catches up on all of them at once:
-- members would receive a batch of stale notices ("the market is open", "closes
-- in 3 hours") that make no sense.
--
-- Marks as sent only the events whose date has passed. Future steps stay
-- pending and will go out at the right time.
--
-- Usage (from the project folder, with the containers running):
--   docker compose exec -T gashub-db sh -c \
--     'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
--     < backend/db/tools/sopprimi-eventi-passati.sql
-- =============================================================================

INSERT IGNORE INTO cycle_events (cycle_id, event_key)
SELECT c.id, k.event_key
FROM cycles c
JOIN (
    SELECT 'G1_OPEN' AS event_key
    UNION ALL SELECT 'G2_DEADLINE'
    UNION ALL SELECT 'G3_SHOP_OPEN'
    UNION ALL SELECT 'G4_REMINDER'
    UNION ALL SELECT 'G4_CLOSE'
    UNION ALL SELECT 'G5_PROD_ORDER'
) k
WHERE c.is_active = 1
  AND (
       (k.event_key = 'G1_OPEN'       AND c.start_at           <= NOW())
    OR (k.event_key = 'G2_DEADLINE'   AND c.producers_deadline <= NOW())
    OR (k.event_key = 'G3_SHOP_OPEN'  AND c.market_open_at     <= NOW())
    OR (k.event_key = 'G4_REMINDER'   AND c.market_close_at    <= NOW())
    OR (k.event_key = 'G4_CLOSE'      AND c.market_close_at    <= NOW())
    OR (k.event_key = 'G5_PROD_ORDER' AND c.orders_sent_at     <= NOW())
  );

SELECT cycle_id, event_key, sent_at FROM cycle_events ORDER BY cycle_id, event_key;
