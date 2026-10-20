// Romaji to hiragana, converted live as the learner types.
// Anything that is not (yet) a complete syllable stays as typed, so "k" waits for "ka".

const VOWELS = 'aiueo';
const ROWS = {
  '': 'あいうえお', k: 'かきくけこ', s: 'さしすせそ', t: 'たちつてと', n: 'なにぬねの',
  h: 'はひふへほ', m: 'まみむめも', r: 'らりるれろ', g: 'がぎぐげご', z: 'ざじずぜぞ',
  d: 'だぢづでど', b: 'ばびぶべぼ', p: 'ぱぴぷぺぽ',
};
const SMALL_Y = { a: 'ゃ', u: 'ゅ', o: 'ょ' };

const TABLE = {};
for (const [c, kana] of Object.entries(ROWS)) {
  [...kana].forEach((k, i) => (TABLE[c + VOWELS[i]] = k));
}
Object.assign(TABLE, {
  ya: 'や', yu: 'ゆ', yo: 'よ', wa: 'わ', wo: 'を', n: 'ん',
  shi: 'し', chi: 'ち', tsu: 'つ', fu: 'ふ', ji: 'じ', '-': 'ー',
  xtsu: 'っ', ltsu: 'っ', xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ',
});
// Contracted sounds: ky, gy, ny, hy, by, py, my, ry (+ sh, ch, j)
for (const c of ['k', 'g', 'n', 'h', 'b', 'p', 'm', 'r']) {
  for (const v of 'aou') TABLE[c + 'y' + v] = ROWS[c][1] + SMALL_Y[v];
}
for (const v of 'aou') {
  TABLE['sh' + v] = 'し' + SMALL_Y[v];
  TABLE['ch' + v] = 'ち' + SMALL_Y[v];
  TABLE['j' + v] = 'じ' + SMALL_Y[v];
  TABLE['sy' + v] = 'し' + SMALL_Y[v];
  TABLE['ty' + v] = 'ち' + SMALL_Y[v];
  TABLE['jy' + v] = 'じ' + SMALL_Y[v];
}
// Common alternates
Object.assign(TABLE, { si: 'し', ti: 'ち', tu: 'つ', hu: 'ふ', zi: 'じ', she: 'しぇ', che: 'ちぇ', je: 'じぇ' });

const isVowel = (c) => c !== undefined && VOWELS.includes(c);

// final=true turns a trailing "n" into ん (use when checking an answer, not while typing).
export function toHiragana(input, { final = false } = {}) {
  const s = String(input).toLowerCase();
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    // small tsu: doubled consonant ("kk" -> っk) or "tch"
    if (/[bcdfghjklmpqrstvwxyz]/.test(c) && c === s[i + 1]) {
      out += 'っ';
      i++;
      continue;
    }
    if (c === 't' && s[i + 1] === 'c' && s[i + 2] === 'h') {
      out += 'っ';
      i++;
      continue;
    }
    if (c === 'n') {
      const next = s[i + 1];
      if (next === undefined) {
        out += final ? 'ん' : 'n';
        i++;
        continue;
      }
      if (next === "'") {
        out += 'ん';
        i += 2;
        continue;
      }
      if (next === 'n' && !isVowel(s[i + 2]) && s[i + 2] !== 'y') {
        out += 'ん';
        i += 2;
        continue;
      }
      if (!isVowel(next) && next !== 'y' && next !== 'n') {
        out += 'ん';
        i++;
        continue;
      }
      if (next === 'n') {
        out += 'ん';
        i++;
        continue;
      }
    }
    let matched = false;
    for (let len = 4; len >= 1; len--) {
      const k = TABLE[s.slice(i, i + len)];
      if (k && s.slice(i, i + len) !== 'n') {
        out += k;
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += s[i];
      i++;
    }
  }
  return out;
}
