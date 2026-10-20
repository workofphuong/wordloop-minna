import { h, mount, go, header, toast, tabInserts } from './dom.js';
import { getState, save, activeList } from '../store.js';
import { parsePaste, parseCsv, mergeIntoList, detectTable, parseTable, ROLES, ROLE_LABELS } from '../importer.js';
import { formatHelp } from './words.js';

let tab = 'paste';
// A list is one set of words to the learner; new words go into its first unit.
const defaultUnit = (list) => (list.units.length ? list.units[0].name : 'Words');

function afterImport(list, res) {
  save();
  toast(`Added ${res.added} word${res.added === 1 ? '' : 's'}.`);
  go(`#/review/${list.id}`);
}

export function renderAdd() {
  const state = getState();
  const list = activeList(state);
  const root = h('div', { class: 'screen' }, header('Add words'));
  if (!list) {
    root.append(h('p', null, 'Create a list first.'), h('a', { class: 'btn primary', href: '#/new' }, 'Create a list'));
    return mount(root);
  }

  const tabs = h('div', { class: 'tabs', role: 'tablist' },
    [['paste', 'Paste'], ['csv', 'CSV file']].map(([id, label]) =>
      h('button', { class: 'tab' + (tab === id ? ' on' : ''), role: 'tab', 'aria-selected': tab === id, onclick: () => { tab = id; renderAdd(); } }, label)));
  root.append(h('p', { class: 'muted' }, `Adding to: ${list.name}`), tabs);

  if (tab === 'paste') {
    const ta = tabInserts(h('textarea', { id: 'paste', rows: 10, placeholder: 'perro, dog (El perro duerme.)\ngato, cat (El gato come.)\nmitosis', title: 'Tab types a tab character. Press Esc then Tab to leave this box.', 'data-autofocus': true }));
    // Tables with 3+ columns: the learner says what each column is.
    const replace = h('input', { type: 'checkbox', id: 'replace' });
    const mapBox = h('div', { class: 'mapbox' });
    let table = null; // { roles, hasHeader } while a multi-column table is pasted
    const drawMap = () => {
      const det = detectTable(ta.value);
      if (!det) { table = null; mapBox.replaceChildren(); return; }
      if (!table || table.width !== det.width) table = { width: det.width, roles: det.roles.slice(), hasHeader: det.hasHeader };
      const first = det.sample[table.hasHeader && det.sample[1] ? 1 : 0];
      mapBox.replaceChildren(
        h('p', null, h('strong', null, `${det.width} columns found.`), ' Tell me what each one is:'),
        h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: table.hasHeader, onchange: (e) => { table.hasHeader = e.target.checked; drawMap(); } }),
          'First row is a header'),
        ...table.roles.map((role, i) => h('label', { class: 'field' },
          `Column ${i + 1}: ${first[i] || '(empty)'}`,
          h('select', { onchange: (e) => { table.roles[i] = e.target.value; } },
            ROLES.map((r) => h('option', { value: r, selected: r === role }, ROLE_LABELS[r]))))));
    };
    ta.addEventListener('input', drawMap);
    root.append(
      h('div', { class: 'field' }, h('label', { for: 'paste' }, 'Paste your words'), formatHelp(), ta),
      mapBox,
      h('label', { class: 'check' }, replace, 'Replace the meaning of words already in this list (use this to fix an earlier import)'),
      h('button', { class: 'btn primary', onclick: () => {
        if (table && !table.roles.includes('term')) return toast('Pick which column is the Term.');
        const parsed = table ? parseTable(ta.value, table.roles, table.hasHeader) : parsePaste(ta.value);
        if (!parsed.units.length) return toast('Nothing to import yet.');
        afterImport(list, mergeIntoList(list, parsed, defaultUnit(list), { replace: replace.checked }));
      } }, 'Import'),
      h('details', { class: 'how' },
        h('summary', null, 'How to import from Word'),
        h('p', null, 'Select the table or list in Word, copy it, and paste it here. Columns arrive separated by tabs, which the importer understands.')));
  } else {
    const file = h('input', { type: 'file', accept: '.csv,text/csv', id: 'csv', 'data-autofocus': true });
    root.append(
      h('p', { class: 'muted' }, 'Columns: group (ignored), term, definition, example (a header row is optional).'),
      h('label', { class: 'field' }, 'CSV file', file),
      h('button', { class: 'btn primary', onclick: async () => {
        if (!file.files[0]) return toast('Choose a file first.');
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.files[0].arrayBuffer()); }
        catch { return toast('This file is not UTF-8, so accents and Chinese characters would break. In Excel choose Save As, then "CSV UTF-8".'); }
        const parsed = parseCsv(text);
        if (!parsed.units.length) return toast('No words found in that file.');
        afterImport(list, mergeIntoList(list, parsed, defaultUnit(list)));
      } }, 'Import'));
  }
  mount(root);
}
