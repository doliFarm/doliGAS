/*
 * doliGAS - Solidarity purchasing group (GAS) management platform
 * Copyright (C) 2026 Luigi Grillo (doliFarm)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * @file backend/utils/csv.js
 * @description CSV reader for the catalog import.
 * No external dependencies: the accepted format is simple and defined here.
 *
 * Features:
 * - separator detected automatically between ';' (Excel with Italian locale) and ',';
 * - fields in double quotes, with "" for a literal quote;
 * - leading BOM ignored (Excel adds it when saving as UTF-8);
 * - normalized headers (lower case, no accents or spaces).
 */

/** Removes accents and spaces from headers, so "Unità di misura" becomes "unitadimisura". */
const normalizeHeader = (h) => String(h)
    .replace(/^﻿/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\s_-]+/g, '');

/** Splits a line, taking quotes into account. */
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
 * @param {string} text file content
 * @returns {{headers: string[], rows: object[], separator: string}}
 *          rows: one object per line, with normalized keys; `_line` is the line number in the file
 */
const parseCsv = (text) => {
    const clean = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const lines = clean.split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return { headers: [], rows: [], separator: ';' };

    // Separator: the most frequent one in the header line
    const separator = (lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',';
    const headers = splitLine(lines[0], separator).map(normalizeHeader);

    const rows = lines.slice(1).map((line, idx) => {
        const values = splitLine(line, separator);
        const row = { _line: idx + 2 }; // +2: line 1 is the header
        headers.forEach((h, i) => { row[h] = values[i] !== undefined ? values[i] : ''; });
        return row;
    });

    return { headers, rows, separator };
};

/** Reads a number accepting either a comma or a dot as decimal separator. */
const parseNumber = (value) => {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const n = Number(String(value).trim().replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
};

/** Reads a true/false value written in several ways. */
const parseBool = (value, fallback = true) => {
    const s = String(value ?? '').trim().toLowerCase();
    if (s === '') return fallback;
    if (['1', 'si', 'sì', 'yes', 'true', 'vero', 'x', 'attivo'].includes(s)) return true;
    if (['0', 'no', 'false', 'falso', 'disattivo'].includes(s)) return false;
    return fallback;
};

module.exports = { parseCsv, parseNumber, parseBool, normalizeHeader };
