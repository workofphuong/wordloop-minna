import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toHiragana } from '../js/romaji.js';
import { checkAnswer } from '../js/checker.js';
import { parsePaste, parseCsv, mergeIntoList, detectTable, parseTable } from '../js/importer.js';
import { newList, newState, resetListProgress, allWords } from '../js/model.js';
import { addDays, dueBatches, exerciseForRevisit, isDue, nextDueDate, PRESETS, daysBetween } from '../js/schedule.js';
import { createRound, current, answer, answerMatch, summary } from '../js/engine.js';
import { buildCards, chunkSizes, blankCard, hintCard, needsReading } from '../js/exercises.js';
import { makeSample } from '../js/sample.js';
import { newWordsIn, startLearn, startRevisit, finishRound, unitProgress, discardRound } from '../js/session.js';

// ---------- accents and other scripts ----------
test('checker: accents, ß, œ, đ are forgiving by default and strict on request', () => {
  assert.equal(checkAnswer('cafe', 'café'), 'correct');
  assert.equal(checkAnswer('strasse', 'Straße'), 'correct');
  assert.equal(checkAnswer('coeur', 'cœur'), 'correct');
  assert.equal(checkAnswer('dep', 'đẹp'), 'correct');
  assert.equal(checkAnswer('ano', 'año', { strictAccents: true }), 'almost');
  assert.equal(checkAnswer('ni hao', 'nǐ hǎo'), 'correct');
  assert.equal(checkAnswer('你好', '你好'), 'correct');
  assert.equal(checkAnswer('你们', '你好'), 'wrong');
});

test('import: decomposed accents become one character, full-width comma splits', () => {
  const w = parsePaste('café, coffee').units[0].words[0];
  assert.equal(w.term, 'café');
  assert.equal(w.term.length, 4);
  const zh = parsePaste('你好，hello，你好吗？').units[0].words[0];
  assert.deepEqual([zh.term, zh.meaning, zh.examples[0]], ['你好', 'hello', '你好吗？']);
  const fr = parsePaste('peut-être, maybe').units[0].words[0];
  assert.deepEqual([fr.term, fr.meaning], ['peut-être', 'maybe']);
});

// ---------- romaji ----------
test('romaji: basics', () => {
  assert.equal(toHiragana('sa'), 'さ');
  assert.equal(toHiragana('sakana'), 'さかな');
  assert.equal(toHiragana('shi'), 'し');
  assert.equal(toHiragana('tsu'), 'つ');
  assert.equal(toHiragana('kyou'), 'きょう');
  assert.equal(toHiragana('gakkou'), 'がっこう');
  assert.equal(toHiragana('matcha'), 'まっちゃ');
});
test('romaji: incomplete syllables stay as typed', () => {
  assert.equal(toHiragana('k'), 'k');
  assert.equal(toHiragana('sh'), 'sh');
  assert.equal(toHiragana('kak'), 'かk');
});
test('romaji: n handling', () => {
  assert.equal(toHiragana('n'), 'n');
  assert.equal(toHiragana('n', { final: true }), 'ん');
  assert.equal(toHiragana('kanji'), 'かんじ');
  assert.equal(toHiragana('konnichiha'), 'こんにちは');
  assert.equal(toHiragana('nn'), 'ん');
  assert.equal(toHiragana("kan'i"), 'かんい');
  assert.equal(toHiragana('nani'), 'なに');
});
test('romaji: already converted text is stable', () => {
  const once = toHiragana('sakana');
  assert.equal(toHiragana(once), once);
  assert.equal(toHiragana('いえ'), 'いえ');
});

// ---------- checker ----------
test('checker: case, spaces, accents are forgiven', () => {
  assert.equal(checkAnswer('  Café  ', 'cafe'), 'correct');
  assert.equal(checkAnswer('CAFE', 'café'), 'correct');
  assert.equal(checkAnswer('ice   cream', 'Ice cream'), 'correct');
});
test('checker: strict accents', () => {
  assert.equal(checkAnswer('cafe', 'café', { strictAccents: true }), 'almost');
  assert.equal(checkAnswer('café', 'café', { strictAccents: true }), 'correct');
});
test('checker: near miss is almost, far miss is wrong', () => {
  assert.equal(checkAnswer('recieve', 'receive'), 'almost'); // swapped letters
  assert.equal(checkAnswer('recive', 'receive'), 'almost'); // missing letter
  assert.equal(checkAnswer('banana', 'receive'), 'wrong');
  assert.equal(checkAnswer('', 'cat'), 'wrong');
});
test('checker: short answers do not get "almost"', () => {
  assert.equal(checkAnswer('car', 'cat'), 'wrong');
});
test('checker: kana dakuten are not accents', () => {
  assert.equal(checkAnswer('か', 'が'), 'wrong');
  assert.equal(checkAnswer('かお', 'かお'), 'correct');
});

// ---------- importer ----------
test('import: headings, commas, tabs, bullets', () => {
  const p = parsePaste('# Unit 1\nperro, dog, El perro come.\ngato\t cat\n\n# Unit 2\n• sol\n- luna\n3. mar');
  assert.equal(p.units.length, 2);
  assert.deepEqual(p.units[0].words[0], { term: 'perro', meaning: 'dog', examples: ['El perro come.'] });
  assert.equal(p.units[0].words[1].meaning, 'cat');
  assert.deepEqual(p.units[1].words.map((w) => w.term), ['sol', 'luna', 'mar']);
  assert.equal(p.units[1].words[0].meaning, '');
});
test('import: example may contain commas', () => {
  const p = parsePaste('a, b, c, d');
  assert.equal(p.units[0].words[0].examples[0], 'c, d');
});
test('import: Word table paste with several example columns', () => {
  const p = parsePaste('mitosis\tcell division\tex1\tex2');
  assert.deepEqual(p.units[0].words[0].examples, ['ex1', 'ex2']);
});
test('import: kana / kanji / Vietnamese table maps columns, with blank kanji cells and a header', () => {
  const t = 'Tiếng Nhật\tHán tự\tNghĩa tiếng Việt\nわたし\t私\ttôi\nあなた\t\tbạn, anh/chị\nエンジニア\t\tkỹ sư\nあのひと\tあの人\tngười kia, người đó';
  const d = detectTable(t);
  assert.equal(d.width, 3);
  assert.equal(d.hasHeader, true);
  assert.deepEqual(d.roles, ['term', 'reading', 'meaning']);
  const p = parseTable(t, d.roles, d.hasHeader);
  const w = p.units[0].words;
  assert.equal(w.length, 4);
  assert.deepEqual(w[0], { term: 'わたし', meaning: 'tôi', reading: '私', examples: [] });
  assert.equal(w[1].meaning, 'bạn, anh/chị');
  assert.equal(w[1].reading, '');
  assert.equal(w[3].meaning, 'người kia, người đó');
});
test('import: plain 3-column term/meaning/example table keeps the default mapping', () => {
  const d = detectTable('perro\tdog\tEl perro come.\ngato\tcat\tEl gato duerme.');
  assert.deepEqual(d.roles, ['term', 'meaning', 'example']);
  assert.equal(d.hasHeader, false);
  assert.equal(detectTable('a\tb\nc\td'), null);
});
test('import: csv with header, quotes and units', () => {
  const p = parseCsv('unit,term,definition,example\nU1,"hello, world",greeting,"Say ""hi"""\nU2,x,y,\n');
  assert.equal(p.units.length, 2);
  assert.equal(p.units[0].words[0].term, 'hello, world');
  assert.equal(p.units[0].words[0].examples[0], 'Say "hi"');
  assert.equal(p.units[1].words[0].examples.length, 0);
});
test('import: merge fills missing meanings and reports words still missing one', () => {
  const list = newList('L');
  let r = mergeIntoList(list, parsePaste('a\nb, bee'));
  assert.equal(r.added, 2);
  assert.equal(r.missing.length, 1);
  r = mergeIntoList(list, parsePaste('a, ay\nb, bee'));
  assert.equal(r.added, 0);
  assert.equal(list.units[0].words[0].meaning, 'ay');
  assert.equal(list.units[0].words.length, 2);
});

test('import: replace option repairs meanings of words already in the unit', () => {
  const list = newList('L');
  mergeIntoList(list, parsePaste('わたし\t私'), 'U'); // wrong columns: kanji became the meaning
  const fixed = parseTable('わたし\t私\ttôi', ['term', 'reading', 'meaning'], false);
  mergeIntoList(list, fixed, 'U');
  assert.equal(list.units[0].words[0].meaning, '私'); // default keeps what is there
  mergeIntoList(list, fixed, 'U', { replace: true });
  assert.equal(list.units[0].words[0].meaning, 'tôi');
  assert.equal(list.units[0].words[0].reading, '私');
  assert.equal(list.units[0].words.length, 1);
});

// ---------- schedule ----------
test('schedule: presets', () => {
  assert.deepEqual(PRESETS.standard.days, [1, 3, 7, 14, 30]);
  assert.deepEqual(PRESETS.fast.days, [1, 2, 4, 7, 14]);
});
test('schedule: dates, month and year rollover', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addDays('2026-02-27', 3), '2026-03-02');
  assert.equal(daysBetween('2026-10-01', '2026-10-31'), 30);
});
test('schedule: due logic follows a fixed calendar', () => {
  const days = PRESETS.standard.days;
  const b = { learned: true, startDate: '2026-10-01', revisitsDone: 0 };
  assert.equal(nextDueDate(b, days), '2026-10-02');
  assert.equal(isDue(b, days, '2026-10-01'), false);
  assert.equal(isDue(b, days, '2026-10-02'), true);
  assert.equal(isDue(b, days, '2026-10-20'), true); // overdue stays due
  b.revisitsDone = 2;
  assert.equal(nextDueDate(b, days), '2026-10-08');
  b.revisitsDone = 5;
  assert.equal(nextDueDate(b, days), null);
  assert.equal(nextDueDate({ ...b, learned: false, revisitsDone: 0 }, days), null);
});
test('schedule: exercise ladder', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(exerciseForRevisit), ['match', 'mc', 'hint', 'type', 'blank']);
});

// ---------- exercises ----------
test('exercises: chunk sizes keep matching screens at 6 or fewer', () => {
  assert.deepEqual(chunkSizes(10), [5, 5]);
  assert.deepEqual(chunkSizes(7), [4, 3]);
  assert.deepEqual(chunkSizes(13), [5, 4, 4]);
});
test('exercises: blank falls back to typing without a usable example or for single characters', () => {
  assert.equal(blankCard({ id: '1', term: 'house', meaning: 'm', examples: [] }).kind, 'type');
  assert.equal(blankCard({ id: '1', term: 'あ', meaning: 'a', examples: ['あ'] }).kind, 'type');
  const c = blankCard({ id: '1', term: 'house', meaning: 'm', examples: ['A big house.', 'My house is red.'] }, 1);
  assert.equal(c.kind, 'blank');
  assert.equal(c.prompt, 'My ＿＿＿ is red.');
});
test('exercises: hint skipped for single characters', () => {
  assert.equal(hintCard({ id: '1', term: 'か', meaning: 'ka' }).kind, 'type');
  assert.equal(hintCard({ id: '1', term: 'cat', meaning: 'x' }).hint, 'c');
  assert.equal(hintCard({ id: '1', term: 'elephant', meaning: 'x' }).hint, 'el');
});
test('exercises: multiple choice draws distractors from the pool and alternates direction', () => {
  const sample = makeSample();
  const words = sample.units[1].words;
  const pool = sample.units.flatMap((u) => u.words);
  words.forEach((w) => { w.readingKnown = true; }); // meaning exercises start once the reading is known
  const cards = buildCards('mc', words, pool);
  assert.equal(cards.length, words.length);
  for (const c of cards) {
    assert.equal(c.kind, 'mc');
    assert.equal(c.options.length, 4);
    assert.ok(c.options.includes(c.answer));
    assert.equal(new Set(c.options).size, 4);
  }
  const dirs = cards.map((c) => c.dirToTerm);
  assert.ok(dirs.includes(true) && dirs.includes(false));
});
test('exercises: matching builds pairs with retry cards', () => {
  const sample = makeSample();
  const cards = buildCards('match', sample.units[0].words, sample.units[0].words);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].pairs.length, 5);
  assert.ok(cards[0].pairs[0].retry);
});

// ---------- engine ----------
const typeItems = (n) => Array.from({ length: n }, (_, i) => ({ kind: 'type', wordId: 'w' + i, prompt: 'p', answer: 'a' }));

test('engine: all right finishes with no retries', () => {
  const r = createRound(typeItems(3));
  while (!r.done) answer(r, true);
  assert.equal(summary(r).right, 3);
  assert.equal(r.queue.length, 3);
});
test('engine: wrong card returns 3 or 4 cards later, up to 3 times, then once at the end', () => {
  const r = createRound(typeItems(12));
  answer(r, false); // w0 wrong
  assert.equal(r.queue.findIndex((c, i) => i > 0 && c.wordId === 'w0'), 4); // 3 cards between
  const seen = [];
  let guard = 0;
  while (!r.done && guard++ < 200) {
    const c = current(r);
    if (c.wordId === 'w0') {
      seen.push(c.kind);
      answer(r, false); // keeps failing
    } else answer(r, true);
  }
  // (the first wrong answer happened before the loop) 3 returns + one "look again" at the end
  assert.deepEqual(seen, ['type', 'type', 'type', 'look']);
  assert.deepEqual(summary(r).lookAgainWordIds, ['w0']);
  assert.equal(summary(r).wrongWordIds.length, 1);
});
test('engine: gaps alternate between 3 and 4 cards', () => {
  const r = createRound(typeItems(20));
  answer(r, false);
  const first = r.queue.findIndex((c, i) => i > 0 && c.wordId === 'w0');
  while (current(r).wordId !== 'w0') answer(r, true);
  const pos = r.pos;
  answer(r, false);
  const second = r.queue.findIndex((c, i) => i > pos && c.wordId === 'w0');
  assert.equal(first - 0 - 1, 3);
  assert.equal(second - pos - 1, 4);
});
test('engine: a wrong card answered right on return is not repeated and is counted wrong first-try', () => {
  const r = createRound(typeItems(6));
  answer(r, false);
  while (!r.done) answer(r, true);
  const s = summary(r);
  assert.deepEqual(s.wrongWordIds, ['w0']);
  assert.deepEqual(s.lookAgainWordIds, []);
  assert.equal(r.queue.filter((c) => c.wordId === 'w0').length, 2);
});
test('engine: matching misses come back as retry cards', () => {
  const sample = makeSample();
  const items = buildCards('match', sample.units[0].words, sample.units[0].words);
  const r = createRound(items);
  const missed = [items[0].pairs[0].wordId];
  const len = r.queue.length;
  answerMatch(r, missed);
  assert.equal(r.queue.length, len + 1);
  assert.equal(summary(r).wrongWordIds[0], missed[0]);
});
test('engine: state survives JSON round trip (resume)', () => {
  const r = createRound(typeItems(5));
  answer(r, false);
  answer(r, true);
  const back = JSON.parse(JSON.stringify(r));
  while (!back.done) answer(back, true);
  assert.equal(summary(back).total, 5);
});

// ---------- session / calendar ----------
test('session: learn creates a batch, finishing sets its calendar; wrong answers never move it', () => {
  const state = newState();
  const list = makeSample();
  state.lists.push(list);
  const unit = list.units[0];
  const a = startLearn(state, list, unit, '2026-10-01');
  assert.equal(state.batches.length, 1);
  assert.equal(a.round.queue.filter((c) => c.kind === 'study').length, 10);
  let missedOne = false; // get the first check card wrong, everything else right
  while (!a.round.done) {
    const c = current(a.round);
    const wrong = c.kind !== 'study' && !missedOne;
    if (wrong) missedOne = true;
    answer(a.round, !wrong);
  }
  finishRound(state, '2026-10-01');
  const b = state.batches[0];
  assert.equal(b.learned, true);
  assert.equal(b.startDate, '2026-10-01');
  assert.equal(dueBatches(state.batches, list, '2026-10-01').length, 0);
  assert.equal(dueBatches(state.batches, list, '2026-10-02').length, 1);
  // revisit 1 is matching
  const rv = startRevisit(state, list, b);
  assert.equal(rv.kind, 'match');
  while (!rv.round.done) {
    const c = current(rv.round);
    if (c.kind === 'match') answerMatch(rv.round, [c.pairs[0].wordId]);
    else answer(rv.round, false);
  }
  finishRound(state, '2026-10-02');
  assert.equal(b.revisitsDone, 1);
  assert.equal(b.startDate, '2026-10-01'); // unchanged
  assert.equal(dueBatches(state.batches, list, '2026-10-03').length, 0);
  assert.equal(dueBatches(state.batches, list, '2026-10-04').length, 1); // day 3
  finishRound(state, '2026-10-05'); // second call is a no-op
  assert.equal(b.revisitsDone, 1);
  assert.ok(unitProgress(state, list, unit) > 0);
});
test('session: discarding an unfinished first session frees its words', () => {
  const state = newState();
  const list = makeSample();
  state.lists.push(list);
  startLearn(state, list, list.units[0], '2026-10-01');
  discardRound(state);
  assert.equal(state.batches.length, 0);
  assert.equal(state.activeRound, null);
});
test('sample: content is the agreed size and every example contains its term', () => {
  const s = makeSample();
  assert.equal(s.units[0].words.length, 10);
  assert.equal(s.japaneseTyping, true);
  for (const w of s.units[1].words) {
    assert.equal(w.examples.length, 1);
    assert.ok(w.examples[0].includes(w.term), w.term);
  }
});

test('paste: dash and colon split term from meaning', () => {
  const p = parsePaste('perro - dog\ngato: cat\nsol – sun\nluna, moon, La luna: brilla.\nwell-known: famous').units[0].words;
  assert.deepEqual(p.map((w) => [w.term, w.meaning]), [['perro', 'dog'], ['gato', 'cat'], ['sol', 'sun'], ['luna', 'moon'], ['well-known', 'famous']]);
  assert.deepEqual(p[3].examples, ['La luna: brilla.']);
});

test('reading phase: words with an unknown reading get reading cards, then meaning cards once known', () => {
  const mk = (id, term, reading, meaning) => ({ id, term, reading, meaning, examples: [], readingKnown: false });
  const ws = [mk('1', 'いえ', 'ie', 'house'), mk('2', 'かお', 'kao', 'face'), mk('3', 'あお', 'ao', 'blue')];
  assert.ok(ws.every(needsReading));
  const typed = buildCards('match', ws, ws, { readingTyped: true });
  assert.ok(typed.every((c) => c.kind === 'type' && c.phase === 'reading'));
  assert.deepEqual(typed.map((c) => c.answer).sort(), ['ao', 'ie', 'kao']);
  const mc = buildCards('mc', ws, ws);
  assert.ok(mc.every((c) => c.kind === 'mc' && c.phase === 'reading' && c.options.includes(c.answer)));
  const match = buildCards('match', ws, ws);
  assert.equal(match[0].kind, 'match');
  assert.equal(match[0].phase, 'reading');
  ws.forEach((w) => { w.readingKnown = true; });
  const after = buildCards('type', ws, ws);
  assert.ok(after.every((c) => !c.phase && ['いえ', 'かお', 'あお'].includes(c.answer)));
});

test('paste: an example in brackets after the meaning is the default', () => {
  const w = parsePaste('perro, dog (El perro duerme.)\ngato - cat (El gato come.)\nmar\tsea (El mar es azul.)\nsol, sun ()\nbook, book (noun) ()\nluna, moon').units[0].words;
  assert.deepEqual(w.map((x) => [x.term, x.meaning, x.examples]), [
    ['perro', 'dog', ['El perro duerme.']],
    ['gato', 'cat', ['El gato come.']],
    ['mar', 'sea', ['El mar es azul.']],
    ['sol', 'sun', []],
    ['book', 'book (noun)', []],
    ['luna', 'moon', []],
  ]);
});

test('resetListProgress clears batches and flags but keeps words', () => {
  const state = newState();
  const list = makeSample();
  state.lists.push(list);
  const w = allWords(list)[0];
  w.readingKnown = true;
  startLearn(state, list, list.units[0], '2026-01-01');
  assert.ok(state.batches.length);
  resetListProgress(state, list.id);
  assert.equal(state.batches.length, 0);
  assert.equal(w.readingKnown, undefined);
  assert.ok(allWords(list).length > 0 && w.meaning);
});

test('an abandoned first session releases its words', () => {
  const state = newState();
  const list = makeSample();
  state.lists.push(list);
  startLearn(state, list, list.units[0], '2026-01-01');
  startLearn(state, list, list.units[1], '2026-01-01'); // overwrites the unfinished round
  assert.ok(state.activeRound.batchId);
  assert.equal(state.batches.length, 1);
  assert.equal(newWordsIn(state, list, list.units[0]).length, list.units[0].words.length);
});

// --- Minna copy: kanji/kana answers ---
import { checkAnswer as chk } from '../js/checker.js';
import { LESSONS } from '../js/minna.js';

test('katakana, wave dash and brackets are tolerated when typing', () => {
  assert.equal(chk('えんじにあ', 'エンジニア'), 'correct');
  assert.equal(chk('おくに', '[お]国'.replace('国', 'くに')), 'correct');
  assert.equal(chk('いい', 'いい[よい]'), 'correct');
  assert.equal(chk('よい', 'いい[よい]'), 'wrong');
  assert.equal(chk('さん', '〜さん'), 'correct');
});

test('lesson data: 25 lessons, 803 words, no empty meanings', () => {
  assert.equal(LESSONS.length, 25);
  assert.equal(LESSONS.reduce((n, l) => n + l.words.length, 0), 803);
  assert.ok(LESSONS.every((l) => l.words.every((w) => w[0] && w[2])));
});
