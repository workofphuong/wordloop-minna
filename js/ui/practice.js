import { h, mount, go, header, toast } from './dom.js';
import { getState, save, activeList } from '../store.js';
import { KINDS, KIND_LABELS } from '../exercises.js';
import { startPractice } from '../session.js';
import { exampleShare, BLANK_SHARE } from '../examples.js';

export function renderPractice(listId) {
  const state = getState();
  const list = state.lists.find((l) => l.id === listId) || activeList(state);
  if (!list) return go('#/');
  const root = h('div', { class: 'screen' }, header('Practice', `#/list/${list.id}`));
  root.append(h('p', { class: 'muted' }, `Practice ${list.name} any time. It never changes your revisit dates.`));

  // Fill the blank needs example sentences, so it only appears once most words have one.
  const share = exampleShare(list);
  const blankOk = share >= BLANK_SHARE;
  const kind = h('select', { id: 'p-kind' }, KINDS.filter((k) => k !== 'blank' || blankOk).map((k) => h('option', { value: k, selected: k === 'type' }, KIND_LABELS[k])));
  const count = h('input', { id: 'p-count', type: 'number', min: 2, max: 50, value: 10, inputmode: 'numeric' });

  root.append(
    h('label', { class: 'field' }, 'Exercise', kind),
    ...(blankOk ? [] : [h('p', { class: 'muted' }, `Fill the blank unlocks when ${Math.round(BLANK_SHARE * 100)}% of your words have an example (now ${Math.round(share * 100)}%). Tap a word in the list to add one.`)]),
    h('label', { class: 'field' }, 'Number of cards', count),
    h('button', { class: 'btn primary big', onclick: () => {
      const n = Math.min(50, Math.max(2, Number(count.value) || 10));
      const a = startPractice(state, list, { unitId: 'all', kind: kind.value, count: n });
      if (!a) return toast(kind.value === 'blank' ? 'No words with an example in this list.' : 'No words with a meaning in this list yet.');
      save();
      go('#/round');
    } }, 'Start practice'));
  mount(root);
}
