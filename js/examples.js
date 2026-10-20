// Example sentences are optional but encouraged. Fill the blank unlocks in Practice once most words have one.
import { allWords, hasMeaning } from './model.js';
import { toast } from './ui/dom.js';

export const BLANK_SHARE = 0.8;
export const MAX_ASKS = 3; // how many rounds may offer the "add an example" link for one word

const ready = (list) => allWords(list).filter(hasMeaning);
export const withoutExample = (list) => ready(list).filter((w) => !w.examples.length);
export function exampleShare(list) {
  const r = ready(list);
  return r.length ? r.filter((w) => w.examples.length).length / r.length : 0;
}

// Call with the share from before a change; says so once when the list crosses the line.
export function notifyUnlock(list, before) {
  if (before < BLANK_SHARE && exampleShare(list) >= BLANK_SHARE) toast('Fill the blank is now unlocked in Practice.');
}
