-- =============================================================================
-- doliGAS - Soppressione degli eventi già passati dei cicli attivi
--
-- Da eseguire UNA VOLTA, al primo avvio dello scheduler su un'installazione che
-- ha già cicli in corso. Senza questo, lo scheduler vede tappe con data passata
-- e mai notificate, e le recupera tutte insieme: i soci riceverebbero in blocco
-- avvisi vecchi ("il mercato è aperto", "chiude fra 3 ore") senza senso.
--
-- Marca come già inviati solo gli eventi la cui data è passata. Le tappe future
-- restano in attesa e partiranno al momento giusto.
--
-- Uso (dalla cartella del progetto, con i container avviati):
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
