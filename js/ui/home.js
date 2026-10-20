import { h, mount, go, askFirst } from './dom.js';
import { getState, save } from '../store.js';
import { backupAgeText, backupNeeded, downloadBackup } from '../backup.js';
import { installCard } from '../pwa.js';
import { listStatus, nextStep } from './list.js';
import { removeList } from '../model.js';

let managing = false;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function renderHome() {
  if (location.hash && location.hash !== '#/' && location.hash !== '#') managing = false;
  const state = getState();
  const root = h('div', { class: 'screen' });

  // Block 1: Wordloop hero. The most prominent part: resume a round, or see what is waiting.
  const hero = h('section', { class: 'card hero' });
  const ar = state.activeRound;
  const arList = ar && state.lists.find((l) => l.id === ar.listId);
  const statuses = state.lists.map((l) => ({ list: l, st: listStatus(state, l) }));
  const waiting = statuses.filter((x) => x.st.due);
  if (ar && arList && !ar.finished) {
    const left = ar.round.queue.length - ar.round.pos;
    hero.append(
      h('p', null, `${ar.type === 'practice' ? 'Practice' : 'Your round'} in ${arList.name} has about ${plural(Math.max(left, 1), 'card', 'cards')} left.`),
      h('div', { class: 'row' },
        h('a', { class: 'btn big', href: '#/round' }, 'Resume'),
        h('button', { class: 'btn ghost', onclick: () => discardAndRefresh() }, 'Discard')));
  } else if (ar && arList && ar.finished) {
    hero.append(h('p', null, 'You have a finished round to look at.'), h('a', { class: 'btn big', href: '#/round' }, 'See results'));
  } else if (waiting.length) {
    // One next step. Due reviews come before new words.
    const steps = state.lists.map((l) => ({ list: l, step: nextStep(state, l) })).filter((x) => x.step);
    const pickStep = steps.find((x) => x.step.kind === 'due') || steps[0];
    const more = steps.length - 1;
    hero.append(
      h('p', null, `${pickStep.step.text} in `, ...(pickStep.list.isSample ? [pickStep.list.name, ' (', h('strong', null, 'Hiragana'), ' is the basic Japanese alphabet: one character per sound, like か = "ka")'] : [pickStep.list.name])),
      h('button', { class: 'btn big', 'data-autofocus': true, onclick: () => {
        if (pickStep.step.run()) { save(); go('#/round'); } else go(`#/list/${pickStep.list.id}`);
      } }, 'Start looping'),
      ...(more > 0 ? [h('p', { class: 'hero-more' }, `${plural(more, 'other list has', 'other lists have')} something waiting too.`)] : []));
  } else {
    hero.append(h('p', null, state.lists.length ? 'Loop closed. Practice any time.' : 'No word lists yet. Create one below.'));
  }
  root.append(
    h('header', { class: 'brand' },
      h('h1', { class: 'app-name', 'aria-label': 'Wordloop' },
        h('span', { 'aria-hidden': 'true' }, 'Word'),
        h('span', { class: 'lp', 'aria-hidden': 'true' }, 'l', h('i', { class: 'ring a' }), h('i', { class: 'ring b' }), 'p')),
      h('p', { class: 'tagline' }, 'Learn it. Loop it. Keep it.')),
    hero);

  // Block 2: Your word lists, with the create button at the end.
  const lists = h('section', { class: 'card' },
    h('div', { class: 'list-head' },
      h('h2', null, 'Your word lists'),
      ...(statuses.length ? [h('button', { class: 'btn small plain', onclick: () => { managing = !managing; renderHome(); } }, managing ? 'Done' : 'Manage')] : [])));
  if (statuses.length) {
    const ul = h('ul', { class: 'units' });
    for (const { list, st } of statuses) {
      ul.append(h('li', null, managing
        ? h('div', { class: 'manage-row' },
          h('span', { class: 'unit-name' }, list.name),
          h('span', { class: 'row' },
            h('a', { class: 'btn small', href: `#/edit/${list.id}` }, 'Edit'),
            h('button', { class: 'btn small ghost', onclick: (e) => {
              askFirst(e.currentTarget.closest('li'), `Delete "${list.name}" and all its progress?`, 'Yes, delete', () => {
                removeList(state, list.id);
                save();
                renderHome();
              });
            } }, 'Delete')))
        : h('a', { class: 'unit-link', href: `#/list/${list.id}` },
          h('span', { class: 'unit-name' }, list.name),
          h('span', { class: 'muted', 'aria-hidden': 'true' }, '›'))));
    }
    lists.append(ul);
  }
  const practiceList = state.lists.find((l) => l.id === state.activeListId) || state.lists[0];
  lists.append(h('div', { class: 'list-actions row' }, createListButton(),
    ...(practiceList ? [h('a', { class: 'btn', href: `#/practice/${practiceList.id}` }, 'Extra practice')] : [])));
  root.append(lists);

  const s = state.settings;
  if (s.backupOptIn === true && backupNeeded()) {
    root.append(h('section', { class: 'backup-note' },
      h('p', null, backupAgeText() + '.'),
      h('button', { class: 'btn small', onclick: () => { downloadBackup(); renderHome(); } }, 'Download backup')));
  }

  root.append(h('p', { class: 'muted' }, h('a', { href: '#/settings' }, 'Backup and restore')));
  const ic = installCard();
  if (ic) root.append(ic);
  root.append(h('p', { class: 'muted credit' }, 'Built by Phuong Le with Claude'));
  mount(root);
}

function createListButton() {
  return h('a', { class: 'btn', href: '#/new' }, '+ Create new list');
}

function discardAndRefresh() {
  import('../session.js').then(({ discardRound }) => {
    discardRound(getState());
    save();
    renderHome();
  });
}
