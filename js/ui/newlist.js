import { h, mount, go, header, toast, tabInserts, askFirst } from './dom.js';
import { wordList, formatHelp } from './words.js';
import { getState, save } from '../store.js';
import { newList, newWord, allWords, hasMeaning, removeWord, removeList, resetListProgress, findOrCreateUnit } from '../model.js';
import { PRESETS } from '../schedule.js';
import { parsePaste, mergeIntoList } from '../importer.js';
import { llmSlot } from '../llm-slot.js';
import { withoutExample, exampleShare, notifyUnlock } from '../examples.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const renderNewList = () => renderListForm(null);
export const renderEdit = (id) => {
  const list = getState().lists.find((l) => l.id === id);
  return list ? renderListForm(list) : go('#/');
};

// Edit text: term<TAB>meaning (example). An empty () keeps a meaning that ends in brackets from being read as an example.
const wordsToText = (list) => allWords(list).map((w) => {
  let m = w.meaning;
  if (w.examples[0]) m += ` (${w.examples[0]})`;
  else if (/[)\uFF09]\s*$/.test(m)) m += ' ()';
  return `${w.term}\t${m}`;
}).join('\n');

// Apply edited text to an existing list: keep words whose term is unchanged (so progress and readings survive),
// update meanings, add new lines, and drop lines that were deleted.
function applyWords(state, list, text) {
  const parsed = parsePaste(text).units.flatMap((u) => u.words);
  const key = (t) => t.trim().toLowerCase();
  const old = new Map(allWords(list).map((w) => [key(w.term), w]));
  const keep = new Set();
  let dupes = 0;
  for (const pw of parsed) {
    const w = old.get(key(pw.term));
    if (w && keep.has(w.id)) dupes++;
    else if (w) {
      keep.add(w.id);
      w.term = pw.term;
      w.meaning = pw.meaning;
      if (pw.examples.length && pw.examples[0] !== w.examples[0]) w.examples = pw.examples;
      if (!pw.examples.length) w.examples = [];
    } else {
      const nw = newWord(pw.term, pw.meaning, pw.examples);
      (list.units[0] || findOrCreateUnit(list, 'Words')).words.push(nw);
      keep.add(nw.id);
    }
  }
  for (const u of list.units.slice()) for (const w of u.words.slice()) if (!keep.has(w.id)) removeWord(state, list, u.id, w.id);
  return dupes;
}

// One page for everything a list needs: name, words and settings. Used to create and to edit.
function renderListForm(existing) {
  const state = getState();
  const editing = !!existing;
  const root = h('div', { class: 'screen' }, header(editing ? 'Edit list' : 'New list', editing ? `#/list/${existing.id}` : '#/'));

  const name = h('input', { id: 'nl-name', value: editing ? existing.name : '', placeholder: 'e.g. Spanish 4', autocomplete: 'off', 'data-autofocus': true });
  const lang = h('input', { id: 'nl-lang', value: editing ? existing.explainLang : 'English' });
  const cur = editing ? existing.schedule : 'standard';
  const sched = h('div', { class: 'radios', role: 'radiogroup', 'aria-label': 'Loop schedule' },
    Object.entries(PRESETS).map(([id, p]) => h('label', { class: 'radio' },
      h('input', { type: 'radio', name: 'sched', value: id, checked: id === cur }),
      h('span', null, h('strong', null, p.label), h('br'), h('span', { class: 'muted' }, p.note)))));
  const ai = h('input', { type: 'checkbox', id: 'nl-ai', checked: editing && existing.wantsAiMeanings });
  const jp = h('input', { type: 'checkbox', id: 'nl-jp', checked: editing && existing.japaneseTyping });
  const strict = h('input', { type: 'checkbox', id: 'nl-strict', checked: editing && existing.strictAccents });
  const words = tabInserts(h('textarea', { id: 'nl-words', rows: 8, title: 'Tab types a tab character. Press Esc then Tab to leave this box.', placeholder: 'perro, dog (El perro duerme.)\ngato, cat (El gato come.)\nmitosis' }, editing ? wordsToText(existing) : ''));

  root.append(
    h('label', { class: 'field' }, 'List name', name),
    h('div', { class: 'field' }, h('label', { for: 'nl-words' }, 'Your words'), formatHelp(), words),
    ...(editing ? [h('p', { class: 'muted' }, "Changing a word's spelling restarts its progress.")] : []),
    h('label', { class: 'check' }, ai, 'Fill missing meanings with AI (coming soon)'),
    h('label', { class: 'field' }, 'Explanation language', lang),
    h('fieldset', { class: 'field' }, h('legend', null, 'Schedule'), sched),
    h('label', { class: 'check' }, jp, 'Japanese typing (romaji to hiragana)'),
    h('label', { class: 'check' }, strict, 'Strict accents (a missing accent counts as "Almost")'),
    h('button', { class: 'btn primary big', onclick: () => {
      if (!name.value.trim()) return toast('Give the list a name.');
      if (!words.value.trim()) return toast('Add at least one word.');
      const settings = {
        name: name.value.trim(),
        explainLang: lang.value.trim() || 'English',
        schedule: sched.querySelector('input:checked').value,
        japaneseTyping: jp.checked,
        strictAccents: strict.checked,
        wantsAiMeanings: ai.checked,
      };
      let list = existing;
      if (editing) {
        Object.assign(list, settings);
        const before = exampleShare(list);
        const dupes = applyWords(state, list, words.value);
        notifyUnlock(list, before);
        if (dupes) toast(`${plural(dupes, 'duplicate word was', 'duplicate words were')} skipped.`);
      } else {
        const { name: n, ...opts } = settings;
        list = newList(n, opts);
        mergeIntoList(list, parsePaste(words.value), 'Words');
        state.lists.push(list);
      }
      state.activeListId = list.id;
      save();
      go(`#/review/${list.id}`);
    } }, editing ? 'Save changes' : 'Create list'),
    ...(editing ? [h('button', { class: 'btn', onclick: (e) => {
      askFirst(e.currentTarget.parentElement, `Start "${existing.name}" over? Your words, meanings and examples are kept. Progress and revisit dates are cleared.`, 'Yes, start over', () => {
        resetListProgress(state, existing.id);
        save();
        go(`#/list/${existing.id}`);
      });
    } }, 'Start this list over')] : []),
    ...(editing ? [h('button', { class: 'btn ghost', onclick: (e) => {
      askFirst(e.currentTarget.parentElement, `Delete "${existing.name}" and all its progress?`, 'Yes, delete', () => {
        removeList(state, existing.id);
        save();
        go('#/');
      });
    } }, 'Delete this list')] : []));
  mount(root);
}

// Shown right after creating a list: check the words and meanings, then see the settings.
export function renderReview(listId) {
  const state = getState();
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return go('#/');
  const words = allWords(list);
  const missing = words.filter((w) => !hasMeaning(w));
  const root = h('div', { class: 'screen' }, header('Check your list', null));
  root.append(h('p', { class: 'muted' }, `${list.name}: ${words.length} ${words.length === 1 ? 'word' : 'words'}. Tap a word to fix it, or use Edit list to change anything.`));
  if (!words.length) root.append(h('p', null, 'No words yet. Add some from the list page.'));
  if (missing.length) {
    root.append(h('p', { class: 'msg almost' }, list.wantsAiMeanings
      ? `${plural(missing.length, 'word has', 'words have')} no meaning. AI will fill them in once it is switched on.`
      : `${plural(missing.length, 'word has', 'words have')} no meaning. Tap it to add one.`));
    const slot = llmSlot('check-meanings', { list, words: missing });
    if (slot) root.append(slot);
  }
  const noEx = withoutExample(list);
  if (noEx.length && !list.examplesPrompted) {
    list.examplesPrompted = true; // ask once; the list screen keeps a link for later
    save();
    root.append(h('section', { class: 'card' },
      h('h2', null, 'Add example sentences?'),
      h('p', null, `${noEx.length === words.length ? 'None of your words has an example.' : `${noEx.length} of your words have no example.`} Examples are optional, but highly recommended: they help words stick and unlock Fill the blank.`),
      h('div', { class: 'row' },
        h('a', { class: 'btn primary', href: `#/examples/${list.id}` }, 'Add examples'),
        h('span', { class: 'muted' }, 'or skip, you can do it later'))));
  }
  if (words.length) {
    root.append(h('p', { class: 'muted' }, 'Tap a word to add a reading (like romaji) or edit its example.'));
  }
  const again = () => renderReview(listId);
  if (words.length) root.append(wordList(state, list, words, again));

  const yes = (b) => (b ? 'On' : 'Off');
  root.append(
    h('h2', { class: 'section' }, 'Settings'),
    h('dl', { class: 'summary' },
      h('dt', null, 'List name'), h('dd', null, list.name),
      h('dt', null, 'Explanation language'), h('dd', null, list.explainLang),
      h('dt', null, 'Schedule'), h('dd', null, PRESETS[list.schedule] ? `${PRESETS[list.schedule].label} (${PRESETS[list.schedule].note})` : list.schedule),
      h('dt', null, 'Japanese typing'), h('dd', null, yes(list.japaneseTyping)),
      h('dt', null, 'Strict accents'), h('dd', null, yes(list.strictAccents)),
      h('dt', null, 'AI fills missing meanings'), h('dd', null, list.wantsAiMeanings ? 'Yes (not switched on yet)' : 'No')),
    h('div', { class: 'row wrap' },
      h('a', { class: 'btn primary big', href: `#/list/${list.id}`, 'data-autofocus': true }, 'Done'),
      h('a', { class: 'btn', href: `#/edit/${list.id}` }, 'Edit list')));
  mount(root);
}
