// Persistence: one JSON object in localStorage, saved after every answer.
import { newState, looksLikeState } from './model.js';
import { LESSONS } from './minna.js';
import { newList, newUnit, newWord } from './model.js';

const KEY = 'minna-wordloop-v1';
let state = null;
export let storageError = null;

// One word list per lesson. A kanji word is the kanji with the hiragana as its reading;
// a kana-only word is the hiragana itself.
const toWord = ([kana, kanji, meaning]) => newWord(kanji || kana, meaning, [], kanji ? kana : '');

function seedLesson(lesson, i) {
  const list = newList(lesson.name, { japaneseTyping: true, explainLang: 'Tiếng Việt', seedKey: 'minna-' + (i + 1) });
  const unit = newUnit(lesson.name);
  unit.words = lesson.words.map(toWord);
  list.units = [unit];
  return list;
}

// Adds lessons and words that are missing and refreshes meanings/readings of existing ones,
// so a corrected list reaches the student without losing her progress.
function syncLessons(s) {
  LESSONS.forEach((lesson, i) => {
    const key = 'minna-' + (i + 1);
    const list = s.lists.find((l) => l.seedKey === key);
    if (!list) return void s.lists.splice(i, 0, seedLesson(lesson, i));
    const unit = list.units[0];
    const have = new Map(unit.words.map((w) => [w.term, w]));
    for (const row of lesson.words) {
      const fresh = toWord(row);
      const cur = have.get(fresh.term);
      if (!cur) unit.words.push(fresh);
      else { cur.meaning = fresh.meaning; cur.reading = fresh.reading; }
    }
  });
  if (!s.activeListId || !s.lists.some((l) => l.id === s.activeListId)) s.activeListId = s.lists[0].id;
}

function fresh() {
  const s = newState();
  syncLessons(s);
  return s;
}

function load() {
  try {
    const raw = globalThis.localStorage && localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (looksLikeState(parsed)) return { ...newState(), ...parsed, settings: { ...newState().settings, ...parsed.settings } };
    }
  } catch (e) {
    storageError = e;
  }
  return fresh();
}

export function getState() {
  if (!state) {
    state = load();
    syncLessons(state);
  }
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageError = null;
    return true;
  } catch (e) {
    storageError = e;
    return false;
  }
}

export function replaceState(next) {
  state = { ...newState(), ...next, settings: { ...newState().settings, ...next.settings } };
  save();
  return state;
}

export function activeList(s = getState()) {
  return s.lists.find((l) => l.id === s.activeListId) || s.lists[0] || null;
}
