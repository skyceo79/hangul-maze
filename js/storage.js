// 프로필·진도 저장 (기기 안 localStorage)
const KEY = 'hangulmaze-v1';

export const defaultLayout = () => ({ pad: { x: 0.1, y: 0.72 }, scale: 1 });

export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.profiles)) return d;
  } catch {
    /* 저장소를 못 쓰는 환경 */
  }
  return { profiles: [], currentId: null };
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 저장 실패해도 게임은 계속 */
  }
}

export function newProfile(name, avatar) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    avatar,
    stars: {},
    sound: true,
    voice: true,
    blink: true,
    layout: defaultLayout(),
  };
}

export const totalStars = (p) => Object.values(p.stars).reduce((s, n) => s + n, 0);
export const isUnlocked = (p, level) => level === 1 || (p.stars[level - 1] || 0) > 0;
