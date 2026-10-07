// 한글 음절 ↔ 자모 나누기·합치기
const BASE = 0xac00;
const CHO = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const JUNG = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const JONG = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

// 복잡한 모음은 나눠서 먹는다 (ㅐ ㅔ ㅒ ㅖ는 한 글자)
const VOWEL_SPLIT = { ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ' };
// 겹받침도 나눠서 먹는다 (지금 단어 목록에는 없음)
const JONG_SPLIT = { ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ' };

const VOWEL_JOIN = Object.fromEntries(Object.entries(VOWEL_SPLIT).map(([k, v]) => [v, k]));
const JONG_JOIN = Object.fromEntries(Object.entries(JONG_SPLIT).map(([k, v]) => [v, k]));

export const isVowel = (j) => JUNG.includes(j);

function compose(cho, jung, jong = '') {
  return String.fromCharCode(BASE + (CHO.indexOf(cho) * 21 + JUNG.indexOf(jung)) * 28 + JONG.indexOf(jong));
}

// 단어 → 먹어야 할 자모 순서. 예) 과자 → [ㄱ, ㅗ, ㅏ, ㅈ, ㅏ]
export function splitWord(word) {
  const syllables = [];
  const tokens = [];
  [...word].forEach((ch, si) => {
    const code = ch.charCodeAt(0) - BASE;
    const cho = CHO[Math.floor(code / 588)];
    const jung = JUNG[Math.floor((code % 588) / 28)];
    const jong = JONG[code % 28];
    const parts = [cho, ...(VOWEL_SPLIT[jung] || jung), ...(jong ? JONG_SPLIT[jong] || jong : '')];
    syllables.push({ cho, vowelParts: [...(VOWEL_SPLIT[jung] || jung)], jongParts: jong ? [...(JONG_SPLIT[jong] || jong)] : [] });
    parts.forEach((j) => tokens.push({ jamo: j, syl: si }));
  });
  return { syllables, tokens };
}

// 지금까지 먹은 개수(eaten)만큼 조합한 글자들. 예) 게임, 3개 → ['게', 'ㅇ']
export function buildPartial(split, eaten) {
  const out = [];
  let left = eaten;
  for (const s of split.syllables) {
    const total = 1 + s.vowelParts.length + s.jongParts.length;
    const n = Math.min(left, total);
    left -= n;
    if (n <= 0) {
      out.push('');
      continue;
    }
    if (n === 1) {
      out.push(s.cho);
      continue;
    }
    const vn = Math.min(n - 1, s.vowelParts.length);
    const vp = s.vowelParts.slice(0, vn).join('');
    const vowel = vn === 1 ? vp : VOWEL_JOIN[vp];
    const jp = s.jongParts.slice(0, n - 1 - vn).join('');
    const jong = jp.length <= 1 ? jp : JONG_JOIN[jp];
    out.push(compose(s.cho, vowel, jong));
  }
  return out;
}

// 방해 글자 후보 (단계에 맞는 쉬운 글자)
export const BASIC_CONSONANTS = [...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'];
export const BASIC_VOWELS = [...'ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ'];
export const EXTRA_VOWELS = [...'ㅐㅔ'];
export const DOUBLE_CONSONANTS = [...'ㄲㄸㅃㅆㅉ'];
