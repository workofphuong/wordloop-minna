// Round state machine. All state is plain JSON (saved after every answer).
//
// Wrong card: it returns up to 3 more times, 3 or 4 cards apart. If it is still wrong after
// the last return it is shown once more at the end as "worth another look".

export const MAX_RETURNS = 3;

export function createRound(items) {
  return {
    queue: items.map((it) => ({ ...it })),
    pos: 0,
    returns: {}, // wordId -> how many times it has been put back
    firstTry: {}, // wordId -> 'right' | 'wrong'
    tail: [], // cards still wrong after the last return
    tailAdded: false,
    done: items.length === 0,
  };
}

export const current = (r) => (r.done ? null : r.queue[r.pos] || null);

export const progress = (r) => (r.queue.length ? Math.min(r.pos, r.queue.length) / r.queue.length : 1);

function markFirst(r, wordId, ok) {
  if (!(wordId in r.firstTry)) r.firstTry[wordId] = ok ? 'right' : 'wrong';
}

function putBack(r, card, offset) {
  // offset = cards between the wrong answer and its return (3 or 4)
  const at = Math.min(r.queue.length, r.pos + 1 + offset);
  r.queue.splice(at, 0, { ...card, retry: true });
}

function scheduleWrong(r, card, slot) {
  const n = r.returns[card.wordId] || 0;
  if (n < MAX_RETURNS) {
    r.returns[card.wordId] = n + 1;
    putBack(r, card, 3 + (n % 2) + slot);
  } else if (!r.tail.some((c) => c.wordId === card.wordId)) {
    r.tail.push(card);
  }
}

function advance(r) {
  r.pos++;
  if (r.pos >= r.queue.length) {
    if (r.tail.length && !r.tailAdded) {
      r.tailAdded = true;
      for (const c of r.tail) r.queue.push({ ...c, kind: 'look', lookAgain: true });
    } else {
      r.done = true;
    }
  }
}

// Answer for study / mc / hint / type / blank / look cards.
export function answer(r, correct) {
  const card = current(r);
  if (!card) return r;
  if (card.kind === 'study' || card.lookAgain) {
    advance(r);
    return r;
  }
  markFirst(r, card.wordId, correct);
  if (!correct) scheduleWrong(r, card, 0);
  advance(r);
  return r;
}

// Answer for a matching screen: missedIds are the words the learner paired wrongly at least once.
export function answerMatch(r, missedIds) {
  const card = current(r);
  if (!card || card.kind !== 'match') return r;
  let slot = 0;
  for (const p of card.pairs) {
    const missed = missedIds.includes(p.wordId);
    markFirst(r, p.wordId, !missed);
    if (missed) {
      scheduleWrong(r, p.retry, slot * 2);
      slot++;
    }
  }
  advance(r);
  return r;
}

export function summary(r) {
  const ids = Object.keys(r.firstTry);
  const wrong = ids.filter((id) => r.firstTry[id] === 'wrong');
  return {
    total: ids.length,
    right: ids.length - wrong.length,
    wrongWordIds: wrong,
    lookAgainWordIds: r.tail.map((c) => c.wordId),
  };
}
