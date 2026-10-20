import { h, mount, go, header, bar, askFirst } from './dom.js';
import { wordList } from './words.js';
import { getState, save } from '../store.js';
import { todayStr } from '../schedule.js';
import { dueSummary, nextLearnUnit, newWordsIn, startLearn, startRevisit, unitProgress, ROUND_SIZE } from '../session.js';
import { removeList, allWords, hasMeaning } from '../model.js';
import { withoutExample } from '../examples.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const unstarted = (state, list) => list.units.reduce((n, u) => n + newWordsIn(state, list, u).length, 0);

// What this list wants next: due reviews first, else new words, else nothing. run() starts that round.
export function nextStep(state, list, today = todayStr()) {
  const sum = dueSummary(state, list, today);
  if (sum.here.length) return { kind: 'due', text: `${plural(sum.here.length, 'revisit', 'revisits')} due`, run: () => startRevisit(state, list, sum.here[0]) };
  const unit = nextLearnUnit(state, list);
  if (unit) {
    const n = Math.min(ROUND_SIZE, newWordsIn(state, list, unit).length);
    return { kind: 'new', text: `${plural(n, 'new word', 'new words')} ready`, run: () => startLearn(state, list, unit, today) };
  }
  return null;
}

// One line for the library button: what, if anything, is waiting in this list.
export function listStatus(state, list, today = todayStr()) {
  const step = nextStep(state, list, today);
  if (step) return { due: true, kind: step.kind, text: step.text };
  if (!list.units.some((u) => u.words.length)) return { due: false, text: 'No words yet' };
  const upcoming = dueSummary(state, list, today).upcoming;
  return { due: false, text: upcoming ? `Next revisit: ${upcoming}` : 'Nothing due' };
}

// 0..1 across the whole list, each unit weighted by its word count.
function listProgress(state, list) {
  const total = allWords(list).length;
  return total ? list.units.reduce((n, u) => n + unitProgress(state, list, u) * u.words.length, 0) / total : 0;
}

export function renderList(listId) {
  const state = getState();
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return go('#/');
  if (state.activeListId !== list.id) { state.activeListId = list.id; save(); }
  const today = todayStr();
  const root = h('div', { class: 'screen' }, header(list.name));

  root.append(todayCard(state, list, today));

  const words = allWords(list);
  const ready = words.filter(hasMeaning);
  const needs = words.filter((w) => !hasMeaning(w));
  if (words.length) root.append(bar(listProgress(state, list), 'List progress'));

  if (needs.length) {
    root.append(h('section', { class: 'card' },
      h('h2', null, `${plural(needs.length, 'word has', 'words have')} no meaning`),
      h('p', { class: 'muted' }, 'They stay out of exercises until they have one.'),
      h('a', { class: 'btn', href: `#/edit/${list.id}` }, 'Add meanings')));
  }

  const noEx = withoutExample(list).length;
  if (noEx) {
    root.append(h('p', { class: 'muted' }, `${plural(noEx, 'word has', 'words have')} no example. Examples are optional, but highly recommended. `, h('a', { href: `#/examples/${list.id}` }, 'Add examples')));
  }
  root.append(h('div', { class: 'row wrap' },
    h('a', { class: 'btn', href: '#/add' }, 'Add words'),
    h('a', { class: 'btn', href: `#/practice/${list.id}` }, 'Practice'),
    h('a', { class: 'btn', href: `#/edit/${list.id}` }, 'Edit list')));
  root.append(h('h2', { class: 'section' }, `Words (${ready.length})`), wordList(state, list, ready, () => renderList(list.id)));
  if (needs.length) root.append(h('h2', { class: 'section' }, 'No meaning yet'), wordList(state, list, needs, () => renderList(list.id)));

  if (list.isSample) {
    root.append(h('section', { class: 'card subtle' },
      h('p', null, 'This is a small hiragana sample. Type romaji and it turns into kana.'),
      h('button', { class: 'btn ghost', onclick: (e) => {
        askFirst(e.currentTarget.closest('section'), 'Delete the sample list and its progress?', 'Yes, delete', () => {
          removeList(state, list.id);
          save();
          go('#/');
        });
      } }, 'Delete sample')));
  }
  mount(root);
}

function todayCard(state, list, today) {
  const sum = dueSummary(state, list, today);
  const learnUnit = nextLearnUnit(state, list);
  const card = h('section', { class: 'card today' });

  // A round that was started here and not finished comes first, so its words are never left hanging.
  const ar = state.activeRound;
  if (ar && ar.listId === list.id) {
    if (ar.finished) {
      card.append(h('h2', null, 'You have a finished round'), h('a', { class: 'btn primary big', 'data-autofocus': true, href: '#/round' }, 'See results'));
    } else {
      const left = Math.max(ar.round.queue.length - ar.round.pos, 1);
      card.append(
        h('h2', null, ar.type === 'practice' ? 'Practice in progress' : 'Round in progress'),
        h('p', null, `About ${plural(left, 'card', 'cards')} left.`),
        h('a', { class: 'btn primary big', 'data-autofocus': true, href: '#/round' }, 'Resume'));
    }
    return card;
  }

  if (sum.here.length) {
    const n = sum.here.length;
    card.append(
      h('h2', null, `${plural(n, 'revisit', 'revisits')} due today`),
      h('p', null, `About ${Math.max(2, n * 3)} minutes.`),
      h('button', { class: 'btn primary big', 'data-autofocus': true, onclick: () => { startRevisit(state, list, sum.here[0]); save(); go('#/round'); } }, 'Start'));
    return card;
  }

  if (learnUnit) {
    const n = Math.min(ROUND_SIZE, newWordsIn(state, list, learnUnit).length);
    const first = !state.batches.some((b) => b.listId === list.id);
    card.append(
      h('h2', null, first && list.isSample ? 'Try the sample, or paste your own words' : `Ready for ${plural(n, 'new word', 'new words')}`),
      h('p', null, `About 2 minutes.${unstarted(state, list) > n ? ` ${unstarted(state, list) - n} more words come after this batch.` : ''}`),
      h('button', { class: 'btn primary big', 'data-autofocus': true, onclick: () => { startLearn(state, list, learnUnit, today); save(); go('#/round'); } }, first && list.isSample ? 'Start the sample' : 'Start'));
    return card;
  }

  const empty = !list.units.some((u) => u.words.length);
  card.append(
    h('h2', null, empty ? 'Paste your own words' : 'Nothing due today'),
    h('p', null, empty ? 'Add some words to get started.' :
      sum.upcoming ? `Next revisit: ${sum.upcoming}. You can still use Practice any time.` : 'Add more words, or use Practice any time.'),
    ...(empty ? [h('a', { class: 'btn primary big', href: '#/add' }, 'Add words')] : []));
  return card;
}
