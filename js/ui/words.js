import { h, toast, askFirst } from './dom.js';
import { save } from '../store.js';
import { removeWord } from '../model.js';

export function wordList(state, list, words, rerender) {
  const ul = h('ul', { class: 'words' });
  for (const w of words) {
    const term = h('input', { value: w.term, 'aria-label': 'Term' });
    const meaning = h('input', { value: w.meaning, 'aria-label': 'Meaning' });
    const reading = h('input', { value: w.reading || '', 'aria-label': 'Reading' });
    const exs = h('textarea', { rows: 3, 'aria-label': 'Examples, one per line' }, w.examples.join('\n'));
    ul.append(h('li', null,
      h('details', null,
        h('summary', null, h('span', { class: 'term-s' }, w.term), h('span', { class: 'muted' }, [w.reading, w.meaning || 'no meaning yet'].filter(Boolean).join(' \u00b7 '))),
        h('div', { class: 'edit' },
          h('label', { class: 'field' }, 'Term', term),
          h('label', { class: 'field' }, 'Meaning', meaning),
          h('label', { class: 'field' }, 'Reading, e.g. romaji (optional)', reading),
          h('label', { class: 'field' }, 'Examples (one per line)', exs),
          h('div', { class: 'row' },
            h('button', { class: 'btn small primary', onclick: () => {
              if (!term.value.trim()) return toast('A word needs a term.');
              w.term = term.value.normalize('NFC').trim();
              w.meaning = meaning.value.normalize('NFC').trim();
              w.reading = reading.value.normalize('NFC').trim();
              w.examples = exs.value.normalize('NFC').split('\n').map((x) => x.trim()).filter(Boolean);
              save();
              rerender();
            } }, 'Save'),
            h('button', { class: 'btn small ghost', onclick: (e) => {
              askFirst(e.currentTarget.closest('.edit'), `Delete "${w.term}"?`, 'Yes, delete', () => {
                removeWord(state, list, list.units.find((u) => u.words.includes(w)).id, w.id);
                save();
                rerender();
              });
            } }, 'Delete'))))));
  }
  return ul;
}

// Short "how to type your words" help, shared by the new-list page and Add words.
export function formatHelp() {
  const code = (t) => h('code', null, t);
  return h('div', { class: 'format-help' },
    h('p', null, 'One word per line, like this:'),
    h('p', { class: 'chips' }, code('word, meaning (example)'), code('word [Tab] meaning (example)')),
    h('p', { class: 'muted' }, 'The (example) is optional but highly recommended. A dash or colon also works instead of the comma.'));
}
