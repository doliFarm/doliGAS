// Ripartizione della pesatura: test unitari, senza database
const { allocateProportionally } = require('../utils/allocation');

const sum = (a) => Number(a.reduce((x, y) => x + y, 0).toFixed(6));

describe('allocateProportionally', () => {
    test('la somma delle quote è esattamente il totale ricevuto', () => {
        const q = allocateProportionally(10, [1, 1, 1], 0.01);
        expect(sum(q)).toBe(10);
        expect(q).toEqual([3.34, 3.33, 3.33]); // il centesimo in più va al primo a parità di resto
    });

    test('ripartisce in proporzione all\'ordinato', () => {
        expect(allocateProportionally(9, [1, 2], 0.01)).toEqual([3, 6]);
        expect(allocateProportionally(13.5, [3, 6, 1.25, 1], 0.01).reduce((a, b) => a + b, 0)).toBeCloseTo(13.5, 9);
    });

    test('le unità discrete restano numeri interi', () => {
        const q = allocateProportionally(5, [1, 1, 1], 1);
        expect(q.every(Number.isInteger)).toBe(true);
        expect(sum(q)).toBe(5);
        expect(q).toEqual([2, 2, 1]);
    });

    test('totale zero o pesi nulli danno quote a zero', () => {
        expect(allocateProportionally(0, [1, 2], 0.01)).toEqual([0, 0]);
        expect(allocateProportionally(5, [0, 0], 0.01)).toEqual([0, 0]);
    });

    test('ricevuto più dell\'ordinato: l\'eccedenza è ripartita', () => {
        expect(allocateProportionally(6, [1, 2], 0.01)).toEqual([2, 4]);
    });
});
