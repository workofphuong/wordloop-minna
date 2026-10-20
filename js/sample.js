// Built-in hiragana sample for first-time visitors.
import { newList, newUnit, newWord } from './model.js';

const w = (term, meaning, example, reading) => newWord(term, meaning, example ? [example] : [], reading);

export function makeSample() {
  const list = newList('Hiragana sample', { japaneseTyping: true, isSample: true, explainLang: 'English' });

  const u1 = newUnit('Unit 1: vowels and K row');
  u1.words = [
    w('あ', 'a'), w('い', 'i'), w('う', 'u'), w('え', 'e'), w('お', 'o'),
    w('か', 'ka'), w('き', 'ki'), w('く', 'ku'), w('け', 'ke'), w('こ', 'ko'),
  ];

  const u2 = newUnit('Unit 2: short words');
  u2.words = [
    w('いえ', 'house', 'これはわたしのいえです。 (This is my house.)', 'ie'),
    w('かお', 'face', 'かおをあらいます。 (I wash my face.)', 'kao'),
    w('あお', 'blue', 'そらはあおいです。 (The sky is blue.)', 'ao'),
    w('いけ', 'pond', 'いけにさかながいます。 (There are fish in the pond.)', 'ike'),
    w('あき', 'autumn', 'あきはすずしいです。 (Autumn is cool.)', 'aki'),
    w('こえ', 'voice', 'おおきなこえですね。 (What a loud voice.)', 'koe'),
    w('うえ', 'above, up', 'つくえのうえにほんがあります。 (There is a book on the desk.)', 'ue'),
  ];

  list.units = [u1, u2];
  return list;
}
