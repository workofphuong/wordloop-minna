import { h, mount, go, header, toast, bar } from './dom.js';
import { getState, save } from '../store.js';
import { withoutExample, exampleShare, notifyUnlock, MAX_ASKS } from '../examples.js';

let ex = null; // { listId, queue, idx, total, added }

export function startExamples(list) {
  const queue = withoutExample(list).map((w) => w.id);
  ex = { listId: list.id, queue, idx: 0, total: queue.length, added: 0 };
}

// One word at a time: type an example or skip. Optional, but it helps words stick.
export function renderExamples(listId) {
  const state = getState();
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return go('#/');
  if (!ex || ex.listId !== listId) startExamples(list);
  const words = new Map(list.units.flatMap((u) => u.words).map((w) => [w.id, w]));
  const back = `#/list/${list.id}`;
  const root = h('div', { class: 'screen' }, header('Add examples', back));
  const word = ex.idx < ex.queue.length ? words.get(ex.queue[ex.idx]) : null;

  if (!ex.total) {
    root.append(h('p', null, 'Every word has an example already.'), h('a', { class: 'btn primary', href: back }, 'Back to the list'));
    return mount(root);
  }
  root.append(h('p', { class: 'muted', 'aria-live': 'polite' }, `${ex.added} added, ${ex.idx} of ${ex.total} seen`), bar(ex.idx / ex.total, 'Examples progress'));

  if (!word) {
    root.append(
      h('section', { class: 'card' },
        h('h2', null, ex.added ? 'Nice work' : 'All skipped for now'),
        h('p', null, `${Math.round(exampleShare(list) * 100)}% of your words have an example.`)),
      h('a', { class: 'btn primary', href: back }, 'Back to the list'));
    return mount(root);
  }

  const before = exampleShare(list);
  const input = h('input', { id: 'example', autocomplete: 'off', 'data-autofocus': true, placeholder: `A sentence using "${word.term}"` });
  const next = () => { ex.idx++; renderExamples(listId); };
  const saveIt = () => {
    if (!input.value.trim()) return toast('Type a sentence, or Skip.');
    word.examples.push(input.value.trim());
    ex.added++;
    save();
    notifyUnlock(list, before);
    next();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveIt(); });
  root.append(h('section', { class: 'card' },
    h('p', { class: 'term' }, word.term),
    word.reading ? h('p', { class: 'reading' }, word.reading) : null,
    h('p', { class: 'meaning' }, word.meaning),
    h('label', { class: 'field' }, 'Example sentence (optional, but highly recommended)', input),
    h('p', { class: 'muted' }, 'Use the word exactly as spelled so it works in Fill the blank.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: saveIt }, 'Save and next'),
      h('button', { class: 'btn ghost', onclick: next }, 'Skip'))));
  mount(root);
}

// A small, skippable link under a correct answer, at most once per round and three times per word.
export function examplePrompt(list, card) {
  const state = getState();
  const a = state.activeRound;
  const word = list.units.flatMap((u) => u.words).find((w) => w.id === card.wordId);
  if (!a || a.exPrompted || !word || !word.meaning || word.examples.length || (word.exAsked || 0) >= MAX_ASKS) return null;
  a.exPrompted = true;
  word.exAsked = (word.exAsked || 0) + 1;
  const box = h('div', { class: 'ex-prompt' });
  const link = h('button', { class: 'linklike', onclick: () => {
    const input = h('input', { autocomplete: 'off', 'aria-label': 'Example sentence', placeholder: `A sentence using "${word.term}"` });
    const saveIt = () => {
      if (!input.value.trim()) return;
      const before = exampleShare(list);
      word.examples.push(input.value.trim());
      save();
      box.replaceChildren(h('span', { class: 'muted' }, 'Example saved.'));
      notifyUnlock(list, before);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveIt(); } });
    box.replaceChildren(h('div', { class: 'row' }, input, h('button', { class: 'btn small', onclick: saveIt }, 'Save')));
    input.focus();
  } }, 'Add an example sentence (optional)');
  box.append(link);
  return box;
}
