// 단어 목록과 6단계 규칙. 단어를 바꾸려면 여기만 고치면 된다.
// 각 묶음의 마지막 2개는 세 글자 "보스 단어" — 항상 19·20번에 나온다.
import { BASIC_CONSONANTS, BASIC_VOWELS, EXTRA_VOWELS, DOUBLE_CONSONANTS } from './hangul.js';

export const GOAL = 20;
export const PEEKS_PER_STAGE = 5;

const SET_A = [
  ['나무', '🌳'], ['바다', '🌊'], ['오리', '🦆'], ['우유', '🥛'], ['기차', '🚂'],
  ['모자', '🎩'], ['하마', '🦛'], ['사자', '🦁'], ['가지', '🍆'], ['포도', '🍇'],
  ['나비', '🦋'], ['거미', '🕷️'], ['바지', '👖'], ['아기', '👶'], ['치마', '👗'],
  ['구두', '🥿'], ['여우', '🦊'], ['버스', '🚌'],
  ['고구마', '🍠'], ['피아노', '🎹'],
];

const SET_B = [
  ['게임', '🎮'], ['풍선', '🎈'], ['학교', '🏫'], ['가방', '🎒'], ['연필', '✏️'],
  ['공책', '📒'], ['수박', '🍉'], ['사탕', '🍬'], ['기린', '🦒'], ['우산', '☂️'],
  ['구름', '☁️'], ['사슴', '🦌'], ['문어', '🐙'], ['상어', '🦈'], ['김밥', '🍙'],
  ['선물', '🎁'], ['책상', '📚'], ['눈사람', '⛄'],
  ['냉장고', '🧊'], ['자동차', '🚗'],
];

const SET_C = [
  ['과자', '🍪'], ['사과', '🍎'], ['의자', '🪑'], ['시계', '⏰'], ['가위', '✂️'],
  ['바퀴', '🛞'], ['돼지', '🐷'], ['열쇠', '🔑'], ['전화', '☎️'], ['땅콩', '🥜'],
  ['토끼', '🐰'], ['까치', '🐦'], ['딸기', '🍓'], ['뽀뽀', '😘'], ['찐빵', '🍞'],
  ['꽃게', '🦀'], ['꿀벌', '🐝'], ['병원', '🏥'],
  ['원숭이', '🐒'], ['외계인', '👽'],
];

const SETS = {
  A: { words: SET_A, title: '받침 없는 단어', decoyPool: [...BASIC_CONSONANTS, ...BASIC_VOWELS] },
  B: { words: SET_B, title: '받침 있는 단어', decoyPool: [...BASIC_CONSONANTS, ...BASIC_VOWELS, ...EXTRA_VOWELS] },
  C: { words: SET_C, title: '복잡한 모음 · 쌍자음', decoyPool: [...BASIC_CONSONANTS, ...BASIC_VOWELS, ...EXTRA_VOWELS, ...DOUBLE_CONSONANTS] },
};

// picture: true면 그림만 보여 준다. ghostSpeed는 1초에 움직이는 칸 수.
export const STAGES = [
  { level: 1, set: 'A', picture: false, ghosts: 2, ghostSpeed: 1.7, decoyCount: 5, color: '#FFB3D1', deep: '#E8609A' },
  { level: 2, set: 'A', picture: true, ghosts: 2, ghostSpeed: 1.9, decoyCount: 6, color: '#FFB3D1', deep: '#E8609A' },
  { level: 3, set: 'B', picture: false, ghosts: 2, ghostSpeed: 2.1, decoyCount: 6, color: '#A9DCFF', deep: '#3D97D6' },
  { level: 4, set: 'B', picture: true, ghosts: 3, ghostSpeed: 2.2, decoyCount: 7, color: '#A9DCFF', deep: '#3D97D6' },
  { level: 5, set: 'C', picture: false, ghosts: 3, ghostSpeed: 2.4, decoyCount: 7, color: '#B9EDB3', deep: '#46A93E' },
  { level: 6, set: 'C', picture: true, ghosts: 3, ghostSpeed: 2.6, decoyCount: 8, color: '#B9EDB3', deep: '#46A93E' },
].map((s) => ({ ...s, ...SETS[s.set], words: undefined, setTitle: SETS[s.set].title }));

export const getStage = (level) => STAGES[level - 1];

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// 문제 순서: 1~18번은 랜덤, 19·20번은 보스 단어 (둘의 순서도 랜덤)
export function wordOrder(stage) {
  const list = SETS[stage.set].words.map(([word, emoji]) => ({ word, emoji }));
  return [...shuffle(list.slice(0, 18)), ...shuffle(list.slice(18))];
}

export const sampleWord = (stage) => {
  const [word, emoji] = SETS[stage.set].words[0];
  return { word, emoji };
};
