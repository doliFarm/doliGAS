/**
 * @file backend/utils/csv.js
 * @description Lettura di file CSV per l'import del catalogo.
 * Nessuna dipendenza esterna: il formato accettato è semplice e definito qui.
 *
 * Caratteristiche:
 * - separatore riconosciuto automaticamente fra ';' (quello di Excel in italiano) e ',';
 * - campi fra doppi apici, con "" per un apice letterale;
 * - BOM iniziale ignorato (Excel lo aggiunge salvando in UTF-8);
 * - intestazioni normalizzate (minuscole, senza accenti né spazi).
 */

/** Rimuove accenti e spazi dalle intestazioni, così "Unità di misura" diventa "unitadimisura". */
const normalizeHeader = (h) => String(h)
    .replace(/^﻿/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\s_-]+/g, '');

/** Divide una riga tenendo conto degli apici. */
const splitLine = (line, sep) => {
    const out = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += ch;
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === sep) {
            out.push(field); field = '';
        } else field += ch;
    }
    out.push(field);
    return out.map(f => f.trim());
};

/**
 * @param {string} text contenuto del file
 * @returns {{headers: string[], rows: object[], separator: string}}
 *          rows: un oggetto per riga, con le chiavi normalizzate; `_line` è il numero di riga nel file
 */
const parseCsv = (text) => {
    const clean = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const lines = clean.split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return { headers: [], rows: [], separator: ';' };

    // Separatore: quello più frequente nella riga di intestazione
    const separator = (lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',';
    const headers = splitLine(lines[0], separator).map(normalizeHeader);

    const rows = lines.slice(1).map((line, idx) => {
        const values = splitLine(line, separator);
        const row = { _line: idx + 2 }; // +2: la riga 1 è l'intestazione
        headers.forEach((h, i) => { row[h] = values[i] !== undefined ? values[i] : ''; });
        return row;
    });

    return { headers, rows, separator };
};

/** Legge un numero accettando sia la virgola sia il punto come separatore decimale. */
const parseNumber = (value) => {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const n = Number(String(value).trim().replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
};

/** Legge un valore vero/falso scritto in vari modi. */
const parseBool = (value, fallback = true) => {
    const s = String(value ?? '').trim().toLowerCase();
    if (s === '') return fallback;
    if (['1', 'si', 'sì', 'yes', 'true', 'vero', 'x', 'attivo'].includes(s)) return true;
    if (['0', 'no', 'false', 'falso', 'disattivo'].includes(s)) return false;
    return fallback;
};

module.exports = { parseCsv, parseNumber, parseBool, normalizeHeader };
