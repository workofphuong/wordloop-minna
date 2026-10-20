// Glue between the data (lists, batches) and the engine: starting, finishing and summarising rounds.
import { allWords, findUnit, hasMeaning, uid } from './model.js';
import { buildCards, buildLearn, KINDS } from './exercises.js';
import { createRound, summary } from './engine.js';
import { daysFor, dueBatches, exerciseForRevisit, nextUpcoming } from './schedule.js';

export const ROUND_SIZE = 10;

// A first session that was never finished and is no longer the active round is abandoned: its words are free again.
const abandoned = (state, b) => !b.learned && !(state.activeRound && state.activeRound.batchId === b.id);

export const batchedIds = (state, listId) =>
  new Set(state.batches.filter((b) => b.listId === listId && !abandoned(state, b)).flatMap((b) => b.wordIds));

export function newWordsIn(state, list, unit) {
  const taken = batchedIds(state, list.id);
  return unit.words.filter((w) => hasMeaning(w) && !taken.has(w.id));
}

export const poolOf = (list) => allWords(list).filter(hasMeaning);

function wordsById(list) {
  return new Map(allWords(list).map((w) => [w.id, w]));
}

function setActive(state, round) {
  state.activeRound = { ...round, applied: false, finished: false, summary: null };
  return state.activeRound;
}

// First session of a new batch of up to ROUND_SIZE words from one unit.
export function startLearn(state, list, unit, today, rng = Math.random) {
  discardRound(state); // starting a new first session ends any unfinished one
  state.batches = state.batches.filter((b) => !abandoned(state, b));
  const words = newWordsIn(state, list, unit).slice(0, ROUND_SIZE);
  if (!words.length) return null;
  const batch = { id: uid(), listId: list.id, unitId: unit.id, wordIds: words.map((w) => w.id), startDate: today, learned: false, revisitsDone: 0, lastDate: null };
  state.batches.push(batch);
  list.currentUnitId = unit.id;
  return setActive(state, {
    type: 'learn', listId: list.id, unitId: unit.id, batchId: batch.id, kind: 'mc',
    round: createRound(buildLearn(words, poolOf(list), { rng })),
  });
}

export function startRevisit(state, list, batch, type = 'revisit', rng = Math.random) {
  const byId = wordsById(list);
  const words = batch.wordIds.map((id) => byId.get(id)).filter((w) => w && hasMeaning(w));
  const n = batch.revisitsDone + 1;
  const kind = exerciseForRevisit(n);
  const items = buildCards(kind, words, poolOf(list), { rng, rotate: n, readingTyped: true });
  if (!items.length) return null;
  return setActive(state, {
    type, listId: list.id, unitId: batch.unitId, batchId: batch.id, kind, revisit: n,
    round: createRound(items),
  });
}

// Practice never touches a batch or any date.
export function startPractice(state, list, { unitId = 'all', kind = 'type', count = ROUND_SIZE }, rng = Math.random) {
  const unit = unitId === 'all' ? null : findUnit(list, unitId);
  let words = (unit ? unit.words : allWords(list)).filter(hasMeaning);
  if (kind === 'blank') words = words.filter((w) => w.examples.length);
  if (!words.length) return null;
  const picked = words.slice().sort(() => rng() - 0.5).slice(0, Math.max(2, count));
  const items = buildCards(KINDS.includes(kind) ? kind : 'type', picked, poolOf(list), { rng, rotate: Math.floor(rng() * 10) });
  return setActive(state, {
    type: 'practice', listId: list.id, unitId: unit ? unit.id : null, batchId: null, kind,
    round: createRound(items), practiceOpts: { unitId, kind, count },
  });
}

// Apply calendar effects once, when a round reaches its end.
export function finishRound(state, today) {
  const a = state.activeRound;
  if (!a || a.applied) return a;
  a.applied = true;
  a.finished = true;
  a.summary = summary(a.round);
  const batch = a.batchId ? state.batches.find((b) => b.id === a.batchId) : null;
  if (batch) {
    if (a.type === 'learn') {
      batch.learned = true;
      batch.startDate = today;
    } else {
      batch.revisitsDone += 1;
      batch.lastDate = today;
    }
  }
  state.settings.roundsDone = (state.settings.roundsDone || 0) + 1;
  return a;
}

// Leaving a never-finished first session releases its words so they can be learned later.
export function discardRound(state) {
  const a = state.activeRound;
  if (a && a.type === 'learn' && !a.applied) {
    state.batches = state.batches.filter((b) => b.id !== a.batchId);
  }
  state.activeRound = null;
}

export function dueSummary(state, list, today) {
  const due = dueBatches(state.batches, list, today);
  // A list is one set of words to the learner, so every due batch is "here".
  const here = due;
  const other = [];
  const days = daysFor(list);
  return { here, other, upcoming: nextUpcoming(state.batches, list), days };
}

// The unit to learn new words from: the current one if it has any left, else the first that does.
export function nextLearnUnit(state, list) {
  const cur = list.currentUnitId && findUnit(list, list.currentUnitId);
  if (cur && newWordsIn(state, list, cur).length) return cur;
  return list.units.find((u) => newWordsIn(state, list, u).length) || null;
}

// 0..1: each word counts for the first session plus each finished revisit.
export function unitProgress(state, list, unit) {
  if (!unit.words.length) return 0;
  const total = daysFor(list).length + 1;
  const score = new Map();
  for (const b of state.batches) {
    if (b.listId !== list.id) continue;
    for (const id of b.wordIds) score.set(id, (b.learned ? 1 : 0) + b.revisitsDone);
  }
  const sum = unit.words.reduce((s, w) => s + (score.get(w.id) || 0), 0);
  return sum / (unit.words.length * total);
}
