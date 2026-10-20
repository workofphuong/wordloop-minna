// Builds self-contained cards (plain JSON) for each exercise type, so a half-finished
// round can be saved and resumed without looking anything up again.

export const KINDS = ['match', 'mc', 'hint', 'type', 'blank'];
export const KIND_LABELS = {
  match: 'Matching',
  mc: 'Multiple choice',
  hint: 'First-letter hint typing',
  type: 'Typing',
  blank: 'Fill the blank',
};

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const isSingleChar = (term) => [...term.trim()].length <= 1;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const typeCard = (w) => ({ kind: 'type', wordId: w.id, prompt: w.meaning, answer: w.term, accept: (w.reading || '').trim() || null });

export function hintCard(w) {
  if (isSingleChar(w.term)) return typeCard(w);
  const n = [...w.term].length > 5 ? 2 : 1;
  const chars = [...w.term];
  return { kind: 'hint', wordId: w.id, prompt: w.meaning, answer: w.term, accept: (w.reading || '').trim() || null, hint: chars.slice(0, n).join(''), length: chars.length };
}

// rotate picks which example to use, so a word with several examples varies per revisit.
export function blankCard(w, rotate = 0) {
  if (isSingleChar(w.term)) return typeCard(w);
  const re = new RegExp(escapeRe(w.term), 'gi');
  const usable = w.examples.filter((e) => new RegExp(escapeRe(w.term), 'i').test(e));
  if (!usable.length) return typeCard(w); // no usable example: second typing round
  const sentence = usable[rotate % usable.length];
  return { kind: 'blank', wordId: w.id, prompt: sentence.replace(re, '＿＿＿'), clue: w.meaning, answer: w.term };
}

// Distractors come from the learner's own words, preferring the words in this round
// (same unit, similar kind) before the rest of the list.
export function mcCard(w, pool, dirToTerm, rng = Math.random, prefer = []) {
  const answerText = dirToTerm ? w.term : w.meaning;
  const seen = new Set([answerText.toLowerCase()]);
  const distractors = [];
  const near = new Set(prefer.map((p) => p.id));
  const order = [...shuffle(prefer, rng), ...shuffle(pool.filter((p) => !near.has(p.id)), rng)];
  for (const o of order) {
    if (o.id === w.id) continue;
    const t = dirToTerm ? o.term : o.meaning;
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    distractors.push(t);
    if (distractors.length === 3) break;
  }
  if (distractors.length < 1) return typeCard(w);
  return {
    kind: 'mc',
    wordId: w.id,
    prompt: dirToTerm ? w.meaning : w.term,
    answer: answerText,
    options: shuffle([answerText, ...distractors], rng),
    dirToTerm,
  };
}

export function chunkSizes(n, max = 6) {
  if (n <= 0) return [];
  const groups = Math.ceil(n / max);
  const base = Math.floor(n / groups);
  const extra = n % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < extra ? 1 : 0));
}

// Reading phase: a word that has a reading (e.g. romaji) is first learned as term <-> reading.
// Typing its reading correctly sets word.readingKnown, and from then on it gets the normal meaning exercises.
export const needsReading = (w) => !!(w.reading && w.reading.trim()) && !w.readingKnown;

export const readingTypeCard = (w) => ({ kind: 'type', wordId: w.id, prompt: w.term, answer: w.reading.trim(), phase: 'reading' });

export function readingMcCard(w, pool, rng = Math.random, prefer = []) {
  const answer = w.reading.trim();
  const seen = new Set([answer.toLowerCase()]);
  const distractors = [];
  const near = new Set(prefer.map((p) => p.id));
  for (const o of [...shuffle(prefer, rng), ...shuffle(pool.filter((p) => !near.has(p.id)), rng)]) {
    const t = (o.reading || '').trim();
    if (o.id === w.id || !t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    distractors.push(t);
    if (distractors.length === 3) break;
  }
  if (!distractors.length) return readingTypeCard(w);
  return { kind: 'mc', wordId: w.id, prompt: w.term, answer, options: shuffle([answer, ...distractors], rng), dirToTerm: false, phase: 'reading' };
}

function readingMatchCards(ws, pool, rng) {
  if (ws.length < 2) return ws.map(readingTypeCard);
  const items = [];
  let at = 0;
  for (const size of chunkSizes(ws.length)) {
    const group = ws.slice(at, at + size);
    at += size;
    if (group.length < 2) { items.push(...group.map(readingTypeCard)); continue; }
    items.push({
      kind: 'match',
      phase: 'reading',
      pairs: group.map((w) => ({ wordId: w.id, term: w.term, meaning: w.reading.trim(), reading: '', retry: readingMcCard(w, pool, rng, ws) })),
    });
  }
  return items;
}

// words: the words in the round. pool: every word with a meaning in the list (for distractors).
// readingTyped: words still in the reading phase always get a typed reading card (used for revisits).
export function buildCards(kind, words, pool, opts = {}) {
  const { rng = Math.random, readingTyped = false } = opts;
  const rw = words.filter(needsReading);
  if (!rw.length) return buildMeaningCards(kind, words, pool, opts);
  const typed = readingTyped || kind === 'hint' || kind === 'type' || kind === 'blank';
  const rcards = typed ? rw.map(readingTypeCard) : kind === 'mc' ? rw.map((w) => readingMcCard(w, pool, rng, rw)) : readingMatchCards(shuffle(rw, rng), pool, rng);
  return shuffle([...buildMeaningCards(kind, words.filter((w) => !needsReading(w)), pool, opts), ...rcards], rng);
}

function buildMeaningCards(kind, words, pool, { rng = Math.random, rotate = 0 } = {}) {
  const ws = shuffle(words, rng);
  switch (kind) {
    case 'match': {
      if (ws.length < 2) return ws.map(typeCard);
      const items = [];
      let at = 0;
      for (const size of chunkSizes(ws.length)) {
        const group = ws.slice(at, at + size);
        at += size;
        if (group.length < 2) {
          items.push(...group.map(typeCard));
          continue;
        }
        items.push({
          kind: 'match',
          pairs: group.map((w, i) => ({
            wordId: w.id,
            term: w.term,
            meaning: w.meaning,
            reading: w.reading || '',
            retry: mcCard(w, pool, i % 2 === 0, rng, words),
          })),
        });
      }
      return items;
    }
    case 'mc': {
      const start = rng() < 0.5;
      return ws.map((w, i) => mcCard(w, pool, (i % 2 === 0) === start, rng, words));
    }
    case 'hint':
      return ws.map(hintCard);
    case 'blank':
      return ws.map((w) => blankCard(w, rotate));
    default:
      return ws.map(typeCard);
  }
}

export const studyCard = (w) => ({
  kind: 'study', wordId: w.id, term: w.term, meaning: w.meaning, reading: w.reading || '', examples: w.examples,
});

// First session of a batch: look at each word, then a multiple-choice check.
export function buildLearn(words, pool, opts = {}) {
  return [...words.map(studyCard), ...buildCards('mc', words, pool, opts)];
}
