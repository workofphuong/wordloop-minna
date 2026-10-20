// Stage 2 plug-in point. Stage 1 never calls any API.
// Stage 2 will set `enabled` after the learner opts in, and fill in the two functions
// (each talks to the Cloudflare Worker, which enforces the daily caps).
import { h } from './ui/dom.js';

export const llm = {
  enabled: false,
  suggestMeanings: null, // async (words) => [{ wordId, meaning }], reviewed by the learner before saving
  generateExample: null, // async (word) => string
};

// Screens call this where an opt-in button belongs. Renders nothing in stage 1.
export function llmSlot(where, _ctx) {
  if (!llm.enabled) return null;
  return h('div', { class: 'llm-slot', 'data-slot': where });
}
