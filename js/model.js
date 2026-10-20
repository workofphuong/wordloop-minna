// Data shapes. Everything is plain JSON so it can be stored and backed up as-is.

export const uid = () =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export function newState() {
  return {
    version: 1,
    settings: {
      backupOptIn: null, // null = not asked yet
      lastBackup: null,
      installHintSeen: false,
      sampleSeeded: false,
      roundsDone: 0,
    },
    lists: [],
    batches: [],
    activeRound: null,
    activeListId: null,
  };
}

export function newList(name, opts = {}) {
  return {
    id: uid(),
    name,
    explainLang: 'English',
    schedule: 'standard',
    japaneseTyping: false,
    strictAccents: false,
    isSample: false,
    currentUnitId: null,
    units: [],
    ...opts,
  };
}

export const newUnit = (name) => ({ id: uid(), name, words: [] });

// reading: optional pronunciation (e.g. romaji) shown before the meaning on study and matching screens.
export const newWord = (term, meaning = '', examples = [], reading = '') => ({
  id: uid(),
  term: term.normalize('NFC').trim(),
  meaning: (meaning || '').normalize('NFC').trim(),
  examples: examples.map((e) => e.normalize('NFC').trim()).filter(Boolean),
  reading: (reading || '').normalize('NFC').trim(),
});

export const hasMeaning = (w) => w.meaning.trim() !== '';
export const findUnit = (list, id) => list.units.find((u) => u.id === id) || null;
export const allWords = (list) => list.units.flatMap((u) => u.words);

export function findOrCreateUnit(list, name) {
  const key = name.trim().toLowerCase();
  let unit = list.units.find((u) => u.name.trim().toLowerCase() === key);
  if (!unit) {
    unit = newUnit(name.trim());
    list.units.push(unit);
  }
  return unit;
}

export function removeWord(state, list, unitId, wordId) {
  const unit = findUnit(list, unitId);
  if (unit) unit.words = unit.words.filter((w) => w.id !== wordId);
  for (const b of state.batches) b.wordIds = b.wordIds.filter((id) => id !== wordId);
  state.batches = state.batches.filter((b) => b.wordIds.length > 0);
}

export function removeList(state, listId) {
  state.lists = state.lists.filter((l) => l.id !== listId);
  state.batches = state.batches.filter((b) => b.listId !== listId);
  if (state.activeRound && state.activeRound.listId === listId) state.activeRound = null;
  if (state.activeListId === listId) state.activeListId = state.lists[0] ? state.lists[0].id : null;
}

// Start a list over: words, meanings, readings and examples stay; batches, dates and learned flags go.
export function resetListProgress(state, listId) {
  state.batches = state.batches.filter((b) => b.listId !== listId);
  if (state.activeRound && state.activeRound.listId === listId) state.activeRound = null;
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return;
  for (const w of allWords(list)) { delete w.readingKnown; delete w.exAsked; }
}

// Basic shape check used when restoring a backup file.
export function looksLikeState(s) {
  return (
    s &&
    typeof s === 'object' &&
    Array.isArray(s.lists) &&
    Array.isArray(s.batches) &&
    s.settings &&
    typeof s.settings === 'object' &&
    s.lists.every((l) => l && Array.isArray(l.units))
  );
}
