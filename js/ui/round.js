import { h, mount, go, pick, bar } from './dom.js';
import { getState, save } from '../store.js';
import { current, answer, answerMatch, progress } from '../engine.js';
import { checkAnswer } from '../checker.js';
import { toHiragana } from '../romaji.js';
import { finishRound, discardRound, startPractice } from '../session.js';
import { todayStr } from '../schedule.js';
import { shuffle, KIND_LABELS } from '../exercises.js';
import { allWords } from '../model.js';
import { examplePrompt } from './examples.js';

const RIGHT = ['Right.', 'Nice, that one is sticking.', 'Yes, well done.', 'Correct.', 'Good recall.', 'You had it.'];
const WRONG = ['Not yet, this one will come back.', 'Not quite. Seeing it again will help.', 'That one is tricky. We will see it again.', 'No worries, seeing it again helps it stick.'];
let lastMsg = null;
const say = (arr) => (lastMsg = pick(arr, lastMsg));

const TITLES = { learn: 'Start the loop', revisit: 'Review', practice: 'Practice' };

export function renderRound() {
  const state = getState();
  const a = state.activeRound;
  if (!a) return go('#/');
  const list = state.lists.find((l) => l.id === a.listId);
  if (!list) { state.activeRound = null; save(); return go('#/'); }
  const r = a.round;

  if (r.done && !a.finished) {
    finishRound(state, todayStr());
    save();
  }
  if (a.finished) return renderResults(state, list, a);

  const card = current(r);
  const root = h('div', { class: 'screen round' });
  const label = a.type === 'revisit' ? `${TITLES[a.type]} ${a.revisit}: ${KIND_LABELS[a.kind]}` : a.type === 'practice' ? `Practice: ${KIND_LABELS[a.kind]}` : TITLES.learn;
  root.append(
    h('header', { class: 'top' },
      h('a', { class: 'back', href: `#/list/${list.id}` }, 'Pause'),
      h('h1', { class: 'round-title' }, label)),
    h('p', { class: 'round-meta' },
      h('strong', null, list.name),
      ` · ${card.kind === 'match' ? `${card.pairs.length} words to match` : `Card ${Math.min(r.pos + 1, r.queue.length)} of ${r.queue.length}`}`),
    bar(progress(r), 'Round progress'));

  const next = (fn) => () => { fn(); save(); renderRound(); };
  const body = h('div', { class: 'stage' });
  root.append(body);
  const ctx = { list, root, body, card, done: next(() => answer(r, true)), doneWrong: next(() => answer(r, false)) };

  if (card.kind === 'study') studyView(ctx);
  else if (card.kind === 'match') matchView(ctx, (missed) => { answerMatch(r, missed); save(); renderRound(); });
  else if (card.kind === 'mc') mcView(ctx);
  else if (card.kind === 'look') lookView(ctx);
  else typedView(ctx);
  mount(root);
}

function studyView({ body, card, done }) {
  body.append(
    h('p', { class: 'muted' }, 'Take a look. You will be asked about these next.'),
    h('div', { class: 'card big-card' },
      h('p', { class: 'term' }, card.term),
      card.reading ? h('p', { class: 'reading' }, card.reading) : null,
      h('p', { class: 'meaning' }, card.meaning),
      card.examples.length ? h('ul', { class: 'examples-list' }, card.examples.map((e) => h('li', null, e))) : null),
    h('button', { class: 'btn primary big', 'data-autofocus': true, onclick: done }, 'Next'));
}

function lookView({ body, card, done }) {
  body.append(
    h('p', { class: 'muted' }, 'Worth another look'),
    h('div', { class: 'card big-card' },
      h('p', { class: 'prompt' }, card.prompt),
      h('p', { class: 'answer-line' }, card.answer)),
    h('button', { class: 'btn primary big', 'data-autofocus': true, onclick: done }, 'Got it'));
}

// Wrong answer: show the answer, learner types or taps it once, then continues.
function feedback(box, ok, extra) {
  box.replaceChildren(h('p', { class: ok ? 'msg good' : 'msg bad', role: 'status' }, ok ? say(RIGHT) : say(WRONG)), ...(extra ? [extra] : []));
}

function mcView({ list, body, card, done, doneWrong }) {
  const fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const wrongState = { on: false };
  const btns = shuffle(card.options).map((opt, i) => {
    const b = h('button', { class: 'opt', onclick: () => pickOpt(opt, b) }, h('span', { class: 'key' }, String(i + 1)), opt);
    return b;
  });
  function pickOpt(opt, b) {
    const right = opt === card.answer;
    if (wrongState.on) {
      if (!right) return;
      b.classList.add('right');
      fb.replaceChildren(h('button', { class: 'btn primary big', 'data-autofocus': true, onclick: doneWrong }, 'Continue'));
      fb.querySelector('button').focus();
      return;
    }
    btns.forEach((x) => (x.disabled = true));
    if (right) {
      b.classList.add('right');
      feedback(fb, true, h('div', null, h('button', { class: 'btn primary big', onclick: done }, 'Continue'), examplePrompt(list, card)));
    } else {
      b.classList.add('wrong');
      wrongState.on = true;
      btns.forEach((x) => { x.disabled = false; });
      b.disabled = true;
      feedback(fb, false, h('p', null, 'The answer is ', h('strong', null, card.answer), '. Tap it to continue.'));
      btns.find((x) => x.textContent.slice(1) === card.answer)?.classList.add('hint-right');
    }
    fb.querySelector('button')?.focus();
  }
  body.append(
    h('p', { class: 'muted' }, card.phase === 'reading' ? 'How do you read this?' : card.dirToTerm ? 'Which term matches this meaning?' : 'What does this mean?'),
    h('div', { class: 'card big-card' }, h('p', { class: 'prompt' }, card.prompt)),
    h('div', { class: 'opts' }, btns), fb);
  const onKey = (e) => {
    if (!document.body.contains(body)) return document.removeEventListener('keydown', onKey);
    if (e.target && e.target.tagName === 'INPUT') return;
    const n = Number(e.key);
    if (n >= 1 && n <= btns.length && !btns[n - 1].disabled) btns[n - 1].click();
  };
  document.addEventListener('keydown', onKey);
}

function typedView({ list, body, card, done: finish, doneWrong }) {
  // Typing a word's reading correctly unlocks its meaning exercises.
  const done = () => {
    if (card.phase === 'reading') {
      const w = allWords(list).find((x) => x.id === card.wordId);
      if (w) w.readingKnown = true;
    }
    finish();
  };
  const reading = card.phase === 'reading';
  const kana = list.japaneseTyping && (!reading || /[぀-ヿ]/.test(card.answer)); // readings are typed as romaji, not converted
  const fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const input = h('input', { class: 'answer', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Your answer', 'data-autofocus': true, lang: kana ? 'ja' : null,
    placeholder: card.kind === 'blank' ? 'Type the missing word here' : kana ? 'Type here in romaji (it turns into hiragana)' : reading ? 'Type the reading here' : 'Type the term here' });
  const check = h('button', { class: 'btn primary', onclick: () => submit() }, 'Check');
  const dontKnow = h('button', { class: 'btn ghost', onclick: () => fail() }, "I don't know");
  const actions = h('div', { class: 'row' }, check, dontKnow);
  const value = () => (kana ? toHiragana(input.value, { final: true }) : input.value);
  let mode = 'answer'; // answer | copy | settled
  if (kana) input.addEventListener('input', () => { input.value = toHiragana(input.value); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });

  const opts = { strictAccents: list.strictAccents };
  // A kanji word can be answered with its hiragana; the answer is shown as 漢字 (かんじ).
  const grade = (v) => {
    const r = [checkAnswer(v, card.answer, opts)];
    if (card.accept) r.push(checkAnswer(v, card.accept, opts));
    return r.includes('correct') ? 'correct' : r.includes('almost') ? 'almost' : 'wrong';
  };
  const shown = card.accept ? `${card.answer} (${card.accept})` : card.answer;
  function lock() { input.disabled = true; actions.replaceChildren(); }

  function fail(almostText) {
    mode = 'copy';
    input.value = '';
    input.disabled = false;
    actions.replaceChildren(check);
    check.textContent = 'Check';
    feedback(fb, false, h('div', null,
      almostText ? h('p', null, almostText) : null,
      h('p', null, 'The answer is ', h('strong', { class: 'answer-big' }, shown), '. Type it once to continue.')));
    input.focus();
  }

  function submit() {
    if (mode === 'copy') {
      const res = grade(value());
      if (res === 'wrong') { input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400); return; }
      lock();
      return doneWrong();
    }
    const res = grade(value());
    if (res === 'correct') {
      lock();
      feedback(fb, true, h('div', null, h('button', { class: 'btn primary big', 'data-autofocus': true, onclick: done }, 'Continue'), examplePrompt(list, card)));
      fb.querySelector('button').focus();
    } else if (res === 'almost') {
      lock();
      fb.replaceChildren(
        h('p', { class: 'msg almost', role: 'status' }, 'Almost, check the spelling.'),
        h('p', null, 'The answer is ', h('strong', { class: 'answer-big' }, shown), '.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', 'data-autofocus': true, onclick: done }, 'I knew it'),
          h('button', { class: 'btn', onclick: () => fail() }, 'Not quite')));
      fb.querySelector('button').focus();
    } else fail();
  }

  const prompt = card.kind === 'blank'
    ? [h('p', { class: 'muted' }, 'Type the missing word.'), h('div', { class: 'card big-card' }, h('p', { class: 'prompt sentence' }, card.prompt), h('p', { class: 'muted' }, card.clue))]
    : [h('p', { class: 'muted' }, reading ? 'Type the reading of this word.' : 'Type the term for this meaning.'), h('div', { class: 'card big-card' }, h('p', { class: 'prompt' }, card.prompt),
        card.kind === 'hint' ? h('p', { class: 'hint-line', 'aria-label': `Hint: starts with ${card.hint}` }, card.hint, '＿'.repeat(Math.max(card.length - [...card.hint].length, 0))) : null)];
  body.append(...prompt, input, actions, fb);
}

function matchView({ body, card }, finish) {
  const missed = new Set();
  const pairs = card.pairs;
  const terms = shuffle(pairs);
  const meanings = shuffle(pairs);
  let sel = null; // { side, id, el }
  let matched = 0;
  const fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const progressText = h('p', { class: 'match-progress', 'aria-live': 'polite' });
  const showProgress = () => (progressText.textContent = `Matched ${matched} of ${pairs.length}`);
  // The reading (e.g. romaji) goes before the meaning, in case the learner cannot say the word yet.
  const make = (p, side) => {
    const label = side === 't' ? p.term : p.reading ? [h('span', { class: 'reading' }, p.reading), ' · ', p.meaning] : p.meaning;
    const el = h('button', { class: 'tile', 'data-id': p.wordId, onclick: () => tap(side, p.wordId, el) }, label);
    return el;
  };
  const colT = h('div', { class: 'col' }, terms.map((p) => make(p, 't')));
  const colM = h('div', { class: 'col' }, meanings.map((p) => make(p, 'm')));
  function tap(side, id, el) {
    if (el.classList.contains('done')) return;
    if (!sel || sel.side === side) {
      sel?.el.classList.remove('sel');
      sel = { side, id, el };
      el.classList.add('sel');
      return;
    }
    if (sel.id === id) {
      for (const e of [sel.el, el]) { e.classList.remove('sel'); e.classList.add('done'); e.disabled = true; }
      sel = null;
      matched++;
      showProgress();
      if (matched === pairs.length) {
        feedback(fb, true, h('button', { class: 'btn primary big', 'data-autofocus': true, onclick: () => finish([...missed]) }, 'Continue'));
        fb.querySelector('button').focus();
      }
    } else {
      missed.add(sel.id);
      missed.add(id);
      const a = sel.el;
      a.classList.remove('sel');
      for (const e of [a, el]) { e.classList.add('nope'); setTimeout(() => e.classList.remove('nope'), 500); }
      sel = null;
      fb.replaceChildren(h('p', { class: 'msg bad' }, 'Not a pair. Have another go.'));
    }
  }
  showProgress();
  body.append(
    h('div', { class: 'match-head' }, progressText, h('p', { class: 'muted' }, card.phase === 'reading' ? 'Tap a word, then its reading.' : 'Tap a term, then its meaning.')),
    h('div', { class: 'match' }, colT, colM), fb);
}

function renderResults(state, list, a) {
  const s = a.summary;
  const byId = new Map(allWords(list).map((w) => [w.id, w]));
  const name = (id) => (byId.get(id) ? byId.get(id).term : '');
  const root = h('div', { class: 'screen' }, h('header', { class: 'top' }, h('h1', null, a.type === 'learn' ? 'Loop started' : 'Round complete')));
  const praise = s.total && s.right === s.total ? 'All of them right first time. Lovely.' : s.right / Math.max(s.total, 1) >= 0.6 ? 'Good work. The ones you missed will keep coming back.' : 'Every attempt helps. Seeing words again is how they stick.';
  root.append(h('section', { class: 'card' },
    h('p', { class: 'big-num' }, `${s.right} of ${s.total}`),
    h('p', null, 'right the first time.'),
    h('p', null, praise)));
  if (s.wrongWordIds.length) root.append(h('section', { class: 'card' }, h('h2', null, 'Missed on the first try'), h('p', null, s.wrongWordIds.map(name).join('  ·  '))));
  if (s.lookAgainWordIds.length) root.append(h('section', { class: 'card' }, h('h2', null, 'Worth another look'), h('p', null, s.lookAgainWordIds.map(name).join('  ·  '))));
  if (a.type === 'learn') root.append(h('p', { class: 'muted' }, 'Your first revisit is tomorrow.'));
  if (a.type === 'practice') root.append(h('p', { class: 'muted' }, 'Practice never changes your revisit dates.'));
  const row = h('div', { class: 'row wrap' });
  if (a.type === 'practice') {
    row.append(h('button', { class: 'btn', onclick: () => { const o = a.practiceOpts; state.activeRound = null; startPractice(state, list, o); save(); renderRound(); } }, 'Practise again'));
  }
  row.append(h('button', { class: 'btn primary', 'data-autofocus': true, onclick: () => { state.activeRound = null; save(); go(`#/list/${list.id}`); } }, 'Done'));
  root.append(row);
  mount(root);
}

export { discardRound };
