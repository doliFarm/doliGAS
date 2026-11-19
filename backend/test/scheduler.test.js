// Scheduler G1-G7: ogni tappa notificata una volta sola, anche con più giri o processi
const { resetDb, closePool, sql, setPhase, CYCLE_ID } = require('./helpers');
const { runOnce } = require('../cron/scheduler');

afterAll(closePool);
beforeEach(resetDb);

const events = async () =>
    (await sql('SELECT event_key FROM cycle_events WHERE cycle_id = ? ORDER BY event_key', [CYCLE_ID])).map(r => r.event_key);

test('mercato aperto: partono G1, G2 e G3, e solo una volta', async () => {
    await setPhase('mercato');
    const sent = await runOnce();
    expect(sent).toBe(3);
    expect(await events()).toEqual(['G1_OPEN', 'G2_DEADLINE', 'G3_SHOP_OPEN']);
    expect(await runOnce()).toBe(0);
});

test('due giri in parallelo non duplicano le notifiche', async () => {
    await setPhase('mercato');
    const [a, b] = await Promise.all([runOnce(), runOnce()]);
    expect(a + b).toBe(3);
    expect(await events()).toHaveLength(3);
});

test('tappe mancate durante un fermo vengono recuperate, il promemoria scaduto no', async () => {
    await setPhase('chiuso');
    await runOnce();
    expect(await events()).toEqual(['G1_OPEN', 'G2_DEADLINE', 'G3_SHOP_OPEN', 'G4_CLOSE', 'G5_PROD_ORDER']);
});

test('i soci ricevono l\'avviso di apertura del mercato', async () => {
    await setPhase('mercato');
    const before = (await sql("SELECT COUNT(*) AS n FROM notifications"))[0].n;
    await runOnce();
    const after = (await sql("SELECT COUNT(*) AS n FROM notifications"))[0].n;
    expect(after).toBeGreaterThan(before);
});
