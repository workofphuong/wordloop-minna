// Fixed calendar per batch. Days are counted from the first session; right or wrong
// answers never move a date.

export const PRESETS = {
  standard: { label: 'Steady loop', days: [1, 3, 7, 14, 30], note: 'Revisits on day 1, 3, 7, 14 and 30.' },
  fast: {
    label: 'Exam loop',
    days: [1, 2, 4, 7, 14],
    note: 'Pick this if you have an exam coming up. Revisits on day 1, 2, 4, 7 and 14.',
  },
};

export const daysFor = (list) => (PRESETS[list.schedule] || PRESETS.standard).days;

const pad = (n) => String(n).padStart(2, '0');
export const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function dayNum(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function addDays(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export const daysBetween = (a, b) => dayNum(b) - dayNum(a);

// Date the next revisit falls due, or null when the batch is not learned yet or finished.
export function nextDueDate(batch, days) {
  if (!batch.learned || batch.revisitsDone >= days.length) return null;
  return addDays(batch.startDate, days[batch.revisitsDone]);
}

export function isDue(batch, days, today) {
  const due = nextDueDate(batch, days);
  return due !== null && due <= today;
}

// Revisit number (1-based) decides the exercise.
export const EXERCISE_LADDER = ['match', 'mc', 'hint', 'type', 'blank'];
export const exerciseForRevisit = (n) => EXERCISE_LADDER[Math.min(Math.max(n, 1), 5) - 1];

export function dueBatches(batches, list, today) {
  const days = daysFor(list);
  return batches
    .filter((b) => b.listId === list.id && isDue(b, days, today))
    .sort((a, b) => nextDueDate(a, days).localeCompare(nextDueDate(b, days)));
}

export function nextUpcoming(batches, list) {
  const days = daysFor(list);
  const dates = batches
    .filter((b) => b.listId === list.id)
    .map((b) => nextDueDate(b, days))
    .filter(Boolean)
    .sort();
  return dates[0] || null;
}
