// Turns pasted text or CSV into { units: [{ name, words: [{term, meaning, examples}] }] },
// then merges that into a list.
import { findOrCreateUnit, newWord, hasMeaning } from './model.js';

const BULLET = /^\s*(?:[•·●▪‣◦]\s*|[-–—*]\s+|\(?\d+[.)]\s+)/;
const HEADING = /^\s*#{1,6}\s*(.*?)\s*$/;

// "meaning (example sentence)": text in a trailing ( ) is the example. An empty () just marks that the brackets belong to the meaning.
const TRAILING_PAREN = /^(.*?)\s*[(\uFF08]([^()\uFF08\uFF09]*)[)\uFF09]\s*$/s;

function withParenExample(w) {
  const m = w.meaning.match(TRAILING_PAREN);
  if (!m) return w;
  const example = m[2].trim();
  return { ...w, meaning: m[1].trim(), examples: example ? [example, ...w.examples] : w.examples };
}

const splitLine = (line) => withParenExample(splitCore(line));

function splitCore(line) {
  if (line.includes('	')) {
    const parts = line.split('	').map((p) => p.trim());
    return { term: parts[0], meaning: parts[1] || '', examples: parts.slice(2).filter(Boolean) };
  }
  // The earliest of comma, spaced dash or colon splits term from meaning.
  const comma = line.search(/[,，]/); // ASCII or full-width comma
  const dash = line.search(/\s[-–—]\s/);
  const colon = line.search(/[:：]/);
  const hits = [comma, dash, colon].filter((i) => i !== -1);
  if (!hits.length) return { term: line.trim(), meaning: '', examples: [] };
  const at = Math.min(...hits);
  if (at !== comma) return { term: line.slice(0, at).trim(), meaning: line.slice(at + 1).trim().replace(/^[-–—]\s*/, ''), examples: [] };
  // term, definition, example: only the first two commas split, so examples may contain commas.
  const first = comma;
  const secondAt = line.slice(first + 1).search(/[,，]/);
  const second = secondAt === -1 ? -1 : first + 1 + secondAt;
  const term = line.slice(0, first).trim();
  if (second === -1) return { term, meaning: line.slice(first + 1).trim(), examples: [] };
  const meaning = line.slice(first + 1, second).trim();
  const example = line.slice(second + 1).trim();
  return { term, meaning, examples: example ? [example] : [] };
}

export function parsePaste(text) {
  const units = [];
  let current = null;
  const ensure = (name = '') => {
    current = { name, words: [] };
    units.push(current);
  };
  for (const raw of String(text || '').normalize('NFC').replace(/^﻿/, '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const head = raw.match(HEADING);
    if (head) {
      if (head[1]) ensure(head[1]);
      continue;
    }
    const line = raw.replace(BULLET, '');
    const w = splitLine(line);
    if (!w.term) continue;
    if (!current) ensure('');
    current.words.push(w);
  }
  return { units: units.filter((u) => u.words.length > 0) };
}

// ---- Tables with 3+ tab-separated columns (e.g. kana / kanji / meaning) ----
// The learner maps each column to a role. detectTable() proposes a mapping.

export const ROLES = ['term', 'meaning', 'reading', 'example', 'ignore'];
export const ROLE_LABELS = {
  term: 'Term',
  meaning: 'Meaning',
  reading: 'Reading / other form',
  example: 'Example',
  ignore: 'Ignore',
};

const HEADER_WORD = /^(term|word|meaning|definition|example|reading|nghĩa|tiếng|hán|kanji)/i;
const dataLines = (text) =>
  String(text || '').normalize('NFC').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() && !HEADING.test(l));

export function detectTable(text) {
  const rows = dataLines(text).map((l) => l.split('\t').map((c) => c.trim()));
  const tabbed = rows.filter((r) => r.length >= 3);
  if (rows.length === 0 || tabbed.length * 2 < rows.length) return null;
  const width = Math.max(...tabbed.map((r) => r.length));
  const hasHeader = rows[0].some((c) => HEADER_WORD.test(c));
  const body = rows.slice(hasHeader ? 1 : 0);
  const col = (i) => body.map((r) => r[i] || '').filter(Boolean);

  let roles = Array.from({ length: width }, (_, i) => (i === 0 ? 'term' : i === 1 ? 'meaning' : 'example'));
  // A middle column with no Latin letters but some Han characters is another form of the
  // term (kanji), and the last column holds the meaning.
  const form = [...Array(Math.max(width - 2, 0)).keys()].map((i) => i + 1).find((i) => {
    const cells = col(i);
    return cells.length && cells.every((c) => !/\p{Script=Latin}/u.test(c)) && cells.some((c) => /\p{Script=Han}/u.test(c));
  });
  if (form !== undefined && col(width - 1).some((c) => /\p{Script=Latin}/u.test(c))) {
    roles = Array(width).fill('ignore');
    roles[0] = 'term';
    roles[form] = 'reading';
    roles[width - 1] = 'meaning';
  }
  return { width, roles, hasHeader, sample: rows.slice(0, 3) };
}

export function parseTable(text, roles, hasHeader) {
  const units = [];
  let current = null;
  let skipped = !hasHeader;
  const ensure = (name = '') => {
    current = { name, words: [] };
    units.push(current);
  };
  for (const raw of String(text || '').normalize('NFC').replace(/^﻿/, '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const head = raw.match(HEADING);
    if (head) {
      if (head[1]) ensure(head[1]);
      continue;
    }
    if (!skipped) {
      skipped = true;
      continue;
    }
    const cells = raw.split('\t').map((c) => c.trim());
    const pick = (role) => cells.filter((_, i) => roles[i] === role).find(Boolean) || '';
    const term = pick('term');
    if (!term) continue;
    if (!current) ensure('');
    current.words.push({
      term,
      meaning: pick('meaning'),
      reading: pick('reading'),
      examples: cells.filter((c, i) => roles[i] === 'example' && c),
    });
  }
  return { units: units.filter((u) => u.words.length > 0) };
}

// Minimal CSV parser: quotes, escaped quotes, commas and newlines inside quotes.
export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const s = String(text || '').normalize('NFC').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

export function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) return { units: [] };
  let cols = { unit: 0, term: 1, meaning: 2, example: 3 };
  const head = rows[0].map((c) => c.trim().toLowerCase());
  if (head.includes('term')) {
    const at = (...names) => head.findIndex((h) => names.includes(h));
    cols = {
      unit: at('unit'),
      term: at('term'),
      meaning: at('definition', 'meaning'),
      example: at('example', 'examples'),
    };
    rows.shift();
  }
  const byUnit = new Map();
  for (const r of rows) {
    const get = (i) => (i >= 0 && r[i] != null ? r[i].trim() : '');
    const term = get(cols.term);
    if (!term) continue;
    const unitName = get(cols.unit);
    if (!byUnit.has(unitName)) byUnit.set(unitName, { name: unitName, words: [] });
    const example = get(cols.example);
    byUnit.get(unitName).words.push({
      term,
      meaning: get(cols.meaning),
      examples: example ? [example] : [],
    });
  }
  return { units: [...byUnit.values()] };
}

// Merge parsed units into a list. Words with no unit heading go to defaultUnitName.
// A repeated term in the same unit fills in a missing meaning and adds new examples.
// replace: for a term already in the unit, overwrite its meaning and reading with the imported ones
// (use it to repair a list that was imported with the wrong columns).
export function mergeIntoList(list, parsed, defaultUnitName = 'Unit 1', { replace = false } = {}) {
  let added = 0;
  const missing = [];
  for (const pu of parsed.units) {
    const unit = findOrCreateUnit(list, pu.name || defaultUnitName);
    for (const pw of pu.words) {
      const existing = unit.words.find((w) => w.term.toLowerCase() === pw.term.toLowerCase());
      if (existing) {
        if ((replace || !hasMeaning(existing)) && pw.meaning) existing.meaning = pw.meaning;
        if ((replace || !existing.reading) && pw.reading) existing.reading = pw.reading;
        for (const ex of pw.examples) if (!existing.examples.includes(ex)) existing.examples.push(ex);
        continue;
      }
      const w = newWord(pw.term, pw.meaning, pw.examples, pw.reading);
      unit.words.push(w);
      added++;
      if (!hasMeaning(w)) missing.push(w.id);
    }
  }
  return { added, missing };
}
