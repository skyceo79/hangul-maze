// 화면 방향키 (위치·크기 바꾸기, 좌우 반전) + 미로 위 스와이프
const PAD = 190;

const dominant = (dx, dy) => {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
};

export class Controls {
  constructor(root, game, { getLayout, saveLayout }) {
    this.root = root;
    this.game = game;
    this.getLayout = getLayout;
    this.saveLayout = saveLayout;
    this.pad = root.querySelector('#pad');
    this.editing = false;
    this.bindPad();
    this.bindDrag(this.pad, 'pad');
    this.bindSwipe(root.ownerDocument.querySelector('#cv'));
    window.addEventListener('resize', () => this.apply());
  }

  apply() {
    const L = this.getLayout();
    const rect = this.root.getBoundingClientRect();
    const s = PAD * L.scale;
    const half = s / 2;
    this.pad.style.width = `${s}px`;
    this.pad.style.height = `${s}px`;
    this.pad.style.left = `${Math.max(half, Math.min(rect.width - half, L.pad.x * rect.width))}px`;
    this.pad.style.top = `${Math.max(half, Math.min(rect.height - half, L.pad.y * rect.height))}px`;
  }

  setEditing(on) {
    this.editing = on;
    this.root.classList.toggle('editing', on);
    this.release();
  }

  release() {
    this.pad.dataset.dir = '';
  }

  bindPad() {
    let id = null;
    const move = (e) => {
      const r = this.pad.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      if (Math.hypot(dx, dy) < 0.2) return;
      const dir = dominant(dx, dy);
      this.pad.dataset.dir = dir[0];
      this.game.setWant(dir);
    };
    this.pad.addEventListener('pointerdown', (e) => {
      if (this.editing) return;
      e.preventDefault();
      id = e.pointerId;
      this.pad.setPointerCapture(id);
      move(e);
    });
    this.pad.addEventListener('pointermove', (e) => {
      if (e.pointerId === id && !this.editing) move(e);
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.pad.dataset.dir = '';
    };
    this.pad.addEventListener('pointerup', end);
    this.pad.addEventListener('pointercancel', end);
  }

  // 미로 아무 데나 손가락으로 쓱 밀어도 방향이 바뀐다
  bindSwipe(cv) {
    let s = null;
    cv.addEventListener('pointerdown', (e) => {
      if (this.editing || !this.root.classList.contains('active')) return;
      s = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    cv.addEventListener('pointermove', (e) => {
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.hypot(dx, dy) < 24) return;
      this.game.setWant(dominant(dx, dy));
      s.x = e.clientX;
      s.y = e.clientY;
    });
    const end = (e) => {
      if (s && e.pointerId === s.id) s = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }

  bindDrag(el, key) {
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      if (!this.editing) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      drag = { id: e.pointerId, ox: e.clientX - (r.left + r.width / 2), oy: e.clientY - (r.top + r.height / 2) };
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const rr = this.root.getBoundingClientRect();
      const L = this.getLayout();
      L[key] = {
        x: Math.max(0.03, Math.min(0.97, (e.clientX - drag.ox - rr.left) / rr.width)),
        y: Math.max(0.1, Math.min(0.97, (e.clientY - drag.oy - rr.top) / rr.height)),
      };
      this.apply();
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      this.saveLayout();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  swapSides() {
    const L = this.getLayout();
    L.pad = { x: 1 - L.pad.x, y: L.pad.y };
    this.apply();
    this.saveLayout();
  }

  resize(delta) {
    const L = this.getLayout();
    L.scale = Math.max(0.7, Math.min(1.5, Math.round((L.scale + delta) * 10) / 10));
    this.apply();
    this.saveLayout();
  }
}
