/**
 * @file backend/utils/allocation.js
 * @description Ripartizione proporzionale di una quantità ricevuta tra più ordini
 * (metodo dei resti maggiori). Garantisce che la somma delle quote sia ESATTAMENTE
 * il totale ricevuto, senza centesimi o pezzi persi negli arrotondamenti.
 */

/**
 * @param {number} total   quantità totale da ripartire (es. 13.5 kg ricevuti)
 * @param {number[]} weights quantità ordinate da ciascun socio (pesi della ripartizione)
 * @param {number} step    granularità: 0.01 per kg/litri, 1 per unità discrete (pezzi, bottiglie)
 * @returns {number[]} quote assegnate, nello stesso ordine di `weights`
 */
const allocateProportionally = (total, weights, step = 0.01) => {
    const units = Math.round(total / step);
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    if (units <= 0 || sumWeights <= 0) return weights.map(() => 0);

    const raw = weights.map(w => (w / sumWeights) * units);
    const base = raw.map(r => Math.floor(r + 1e-9));
    const rest = units - base.reduce((a, b) => a + b, 0);

    // Le unità residue vanno a chi ha il resto frazionario più alto (a parità, al primo)
    const order = raw
        .map((r, i) => ({ i, frac: r - base[i] }))
        .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));
    for (let k = 0; k < rest; k++) base[order[k % order.length].i] += 1;

    const decimals = step >= 1 ? 0 : Math.round(-Math.log10(step));
    return base.map(u => Number((u * step).toFixed(decimals)));
};

module.exports = { allocateProportionally };
