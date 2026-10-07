// 게임 진행: 미로, 글자 먹기, 유령, 별사탕, 20문제 흐름
import { randomMaze, DIRS, DIR_LIST } from './maze.js';
import { splitWord, buildPartial } from './hangul.js';
import { getStage, wordOrder, GOAL, PEEKS_PER_STAGE } from './words.js';
import { drawBackground, renderMaze, drawTile, drawPacman, drawGhost, drawStar, roundRect, FONT, GHOST_COLORS } from './art.js';
import { sfx, speak } from './audio.js';

const PLAYER_SPEED = 4.2; // 1초에 4.2칸
const POWER_SEC = 6;
const PEEK_SEC = 2;
const HINT_WORDS = 2; // 1번, 2번 문제만 다음 글자가 반짝인다
const GHOST_RELEASE = [2.5, 5.5, 8.5];
// 유령이 팩맨 쪽으로 갈 확률 (나머지는 아무 데로). 1단계 0.3 → 6단계 0.55
const chaseOf = (level) => 0.3 + (level - 1) * 0.05;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const same = (a, b) => a.x === b.x && a.y === b.y;
const ZERO = { x: 0, y: 0 };

// 칸에서 칸으로 움직이는 캐릭터 (from → to, t = 0~1)
function mover(cell) {
  return { from: { ...cell }, to: { ...cell }, t: 0, dir: { ...ZERO } };
}
const posOf = (m) => ({ x: m.from.x + (m.to.x - m.from.x) * m.t, y: m.from.y + (m.to.y - m.from.y) * m.t });

function advance(m, dist, choose, onArrive) {
  let guard = 0;
  while (dist > 1e-6 && guard++ < 8) {
    if (same(m.from, m.to)) {
      const d = choose(m.from, m.dir);
      if (!d) {
        m.dir = { ...ZERO };
        return;
      }
      m.dir = d;
      m.to = { x: m.from.x + d.x, y: m.from.y + d.y };
      m.t = 0;
    }
    const step = Math.min(dist, 1 - m.t);
    m.t += step;
    dist -= step;
    if (m.t >= 1 - 1e-6) {
      m.from = { ...m.to };
      m.t = 0;
      onArrive?.(m.from);
    }
  }
}

export class Game {
  constructor(canvas, hooks) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.time = 0;
    this.state = 'idle';
    this.paused = false;
    this.blinkHints = true;
    this.texts = [];
    this.particles = [];
    this._raf = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ---------- 화면 크기 ----------
  resize() {
    const rect = this.cv.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = rect.width;
    this.H = rect.height;
    this.cv.width = Math.round(this.W * dpr);
    this.cv.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout();
  }

  layout() {
    if (!this.maze || !this.W) return;
    const { cols, rows } = this.maze;
    const top = clamp(this.H * 0.15, 84, 130);
    const landscape = this.W > this.H * 1.15;
    const side = landscape ? this.W * 0.13 : 10;
    const bottomRoom = landscape ? 10 : this.H * 0.26; // 세로 화면은 아래에 방향키 자리
    this.cell = Math.floor(Math.min((this.H - top - bottomRoom) / rows, (this.W - side * 2) / cols));
    this.ox = Math.round((this.W - cols * this.cell) / 2);
    this.oy = Math.round(top + (this.H - top - bottomRoom - rows * this.cell) / 2);
    this.mazeImg = renderMaze(this.maze, this.cell, this.stage.color);
  }

  px(p) {
    return { x: this.ox + (p.x + 0.5) * this.cell, y: this.oy + (p.y + 0.5) * this.cell };
  }

  // ---------- 진행 ----------
  start() {
    if (this._raf) return;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.render();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  idle() {
    this.state = 'idle';
    this.paused = false;
  }

  play(level) {
    this.stage = getStage(level);
    this.words = wordOrder(this.stage);
    this.index = 0;
    this.caught = 0;
    this.score = 0;
    this.peeks = PEEKS_PER_STAGE;
    this.peekUntil = 0;
    this.paused = false;
    this.particles = [];
    this.newWord();
  }

  newWord() {
    const w = this.words[this.index];
    this.word = w;
    this.split = splitWord(w.word);
    this.eaten = 0;
    this.maze = randomMaze();
    this.layout();
    this.texts = [];
    this.power = 0;
    this.peekUntil = 0;
    this.placeItems();
    this.resetActors();
    this.ready(this.index === 0 ? `${this.stage.level}단계 시작!` : null);
    if (!this.stage.picture) speak(w.word);
    this.emitHud();
  }

  ready(msg) {
    this.state = 'ready';
    this.stateT = 1.4;
    this.banner = msg || '준비!';
    sfx.ready();
  }

  resetActors() {
    this.player = mover(this.maze.start);
    this.player.want = null;
    this.player.face = { ...DIRS.left };
    this.player.mouth = 0;
    this.ghosts = Array.from({ length: this.stage.ghosts }, (_, i) => ({
      ...mover(this.maze.ghostHome),
      color: GHOST_COLORS[i % GHOST_COLORS.length],
      wait: GHOST_RELEASE[i],
      slot: i,
      scared: false,
    }));
    this.playerDist = this.maze.distances(this.maze.start);
  }

  // 글자 타일과 별사탕 놓기
  placeItems() {
    const m = this.maze;
    const nearStart = m.distances(m.start);
    const nearHome = m.distances(m.ghostHome);
    const cornerKey = new Set(m.corners.map((c) => `${c.x},${c.y}`));
    const free = m.openCells().filter((c) => nearStart[c.y][c.x] > 1 && nearHome[c.y][c.x] > 1 && !cornerKey.has(`${c.x},${c.y}`));

    const inWord = new Set(this.split.tokens.map((t) => t.jamo));
    const pool = this.stage.decoyPool.filter((j) => !inWord.has(j));
    const decoys = [];
    while (decoys.length < this.stage.decoyCount && pool.length) decoys.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);

    const letters = [...this.split.tokens.map((t) => t.jamo), ...decoys];
    const taken = [];
    this.tiles = [];
    for (const jamo of letters) {
      let cell = null;
      for (let minD = 4; minD >= 0 && !cell; minD--) {
        const ok = free.filter((c) => taken.every((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) >= minD));
        if (ok.length) cell = ok[Math.floor(Math.random() * ok.length)];
      }
      if (!cell) break;
      taken.push(cell);
      free.splice(free.indexOf(cell), 1);
      this.tiles.push({ x: cell.x, y: cell.y, jamo, eaten: false, wiggle: 0 });
    }

    const corners = [...m.corners].sort(() => Math.random() - 0.5).slice(0, 2);
    this.candies = corners.map((c) => ({ ...c, eaten: false }));
  }

  get nextJamo() {
    return this.split.tokens[this.eaten]?.jamo;
  }

  get remaining() {
    return this.split.tokens.slice(this.eaten).map((t) => t.jamo);
  }

  setWant(name) {
    if (!this.player) return;
    this.player.want = DIRS[name];
  }

  usePeek() {
    if (!this.stage?.picture || this.peeks <= 0 || this.peekUntil > this.time) return false;
    if (!['ready', 'play', 'caught'].includes(this.state)) return false;
    this.peeks--;
    this.peekUntil = this.time + PEEK_SEC;
    this.emitHud();
    return true;
  }

  // ---------- 매 프레임 ----------
  update(dt) {
    this.time += dt;
    if (this.paused || this.state === 'idle' || !this.maze) return;
    if (this.peekUntil && this.time >= this.peekUntil) {
      this.peekUntil = 0;
      this.emitHud();
    }
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0);
    this.particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
    });
    this.texts = this.texts.filter((t) => (t.life -= dt) > 0);
    this.tiles.forEach((t) => (t.wiggle = Math.max(0, t.wiggle - dt * 2.2)));

    if (this.state === 'ready') {
      if ((this.stateT -= dt) <= 0) this.state = 'play';
      return;
    }
    if (this.state === 'caught') {
      if ((this.stateT -= dt) <= 0) {
        this.resetActors();
        this.ready('다시 출발!');
      }
      return;
    }
    if (this.state === 'done') {
      if ((this.stateT -= dt) <= 0) this.afterWord();
      return;
    }
    if (this.state !== 'play') return;

    this.movePlayer(dt);
    this.checkTiles();
    if (this.state !== 'play') return;
    if (this.power > 0) {
      this.power -= dt;
      if (this.power <= 0) this.ghosts.forEach((g) => (g.scared = false));
    }
    this.moveGhosts(dt);
    this.checkGhosts();
  }

  movePlayer(dt) {
    const p = this.player;
    const m = this.maze;
    // 반대 방향은 언제든 바로 돌아설 수 있다
    if (p.want && p.t > 0 && p.want.x === -p.dir.x && p.want.y === -p.dir.y) {
      [p.from, p.to] = [p.to, p.from];
      p.t = 1 - p.t;
      p.dir = p.want;
    }
    const before = { ...posOf(p) };
    advance(
      p,
      PLAYER_SPEED * dt,
      (c, cur) => {
        if (p.want && m.open(c.x + p.want.x, c.y + p.want.y)) return p.want;
        if ((cur.x || cur.y) && m.open(c.x + cur.x, c.y + cur.y)) return cur;
        return null;
      },
      (c) => {
        this.playerDist = m.distances(c);
        const candy = this.candies.find((k) => !k.eaten && same(k, c));
        if (candy) this.eatCandy(candy);
      },
    );
    const now = posOf(p);
    const moved = Math.hypot(now.x - before.x, now.y - before.y);
    if (moved > 0) {
      p.face = p.dir;
      p.mouth += moved * 4.5;
    }
  }

  checkTiles() {
    const pos = posOf(this.player);
    const tile = this.tiles.find((t) => !t.eaten && Math.abs(t.x - pos.x) + Math.abs(t.y - pos.y) < 0.4);
    if (!tile) {
      this.blockedTile = null;
      return;
    }
    if (tile.jamo === this.nextJamo) {
      this.eatLetter(tile);
    } else if (this.remaining.includes(tile.jamo)) {
      if (this.blockedTile !== tile) {
        this.blockedTile = tile;
        tile.wiggle = 1;
        sfx.notYet();
        this.floatText('아직이야!', tile, '#FFE08A');
      }
    } else {
      tile.eaten = true;
      sfx.munch();
      this.burst(tile, '#C9B8FF', 8);
    }
  }

  eatLetter(tile) {
    tile.eaten = true;
    const tok = this.split.tokens[this.eaten];
    this.eaten++;
    this.score += 10;
    this.burst(tile, '#FFE08A', 16);
    const done = this.eaten >= this.split.tokens.length;
    const sylDone = done || this.split.tokens[this.eaten].syl !== tok.syl;
    if (done) {
      this.finishWord();
      return;
    }
    if (sylDone) {
      sfx.syllable();
      speak(buildPartial(this.split, this.eaten)[tok.syl]);
    } else sfx.eat();
    this.emitHud();
  }

  finishWord() {
    this.score += 50;
    this.state = 'done';
    this.stateT = 2.2;
    this.peekUntil = 0;
    sfx.correct();
    speak(this.word.word);
    const c = this.px({ x: (this.maze.cols - 1) / 2, y: (this.maze.rows - 1) / 2 });
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 150 + Math.random() * 300;
      this.particles.push({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, life: 1.4, color: ['#FFB3D1', '#A9DCFF', '#FFE08A', '#B9EDB3'][i % 4] });
    }
    this.emitHud();
  }

  afterWord() {
    this.index++;
    if (this.index >= GOAL) {
      this.state = 'clear';
      sfx.levelup();
      const stars = this.caught <= 3 ? 3 : this.caught <= 8 ? 2 : 1;
      this.hooks.onClear({ stars, caught: this.caught, score: this.score });
      return;
    }
    this.newWord();
  }

  eatCandy(candy) {
    candy.eaten = true;
    this.power = POWER_SEC;
    this.ghosts.forEach((g) => {
      if (g.wait <= 0) {
        g.scared = true;
        // 무서워지면 바로 뒤로 돌아선다
        if (g.t > 0) {
          [g.from, g.to] = [g.to, g.from];
          g.t = 1 - g.t;
          g.dir = { x: -g.dir.x, y: -g.dir.y };
        }
      }
    });
    sfx.power();
    this.burst(candy, '#FFE08A', 20);
  }

  moveGhosts(dt) {
    const m = this.maze;
    const pd = this.playerDist;
    for (const g of this.ghosts) {
      if (g.wait > 0) {
        g.wait -= dt;
        continue;
      }
      const speed = this.stage.ghostSpeed * (g.scared ? 0.6 : 1);
      advance(g, speed * dt, (c, cur) => {
        let opts = DIR_LIST.filter((d) => m.open(c.x + d.x, c.y + d.y) && !(d.x === -cur.x && d.y === -cur.y && (cur.x || cur.y)));
        if (!opts.length) opts = DIR_LIST.filter((d) => m.open(c.x + d.x, c.y + d.y));
        const distAfter = (d) => pd[c.y + d.y][c.x + d.x];
        if (g.scared) {
          opts.sort((a, b) => distAfter(b) - distAfter(a));
          return Math.random() < 0.8 ? opts[0] : opts[Math.floor(Math.random() * opts.length)];
        }
        if (Math.random() < chaseOf(this.stage.level)) {
          opts.sort((a, b) => distAfter(a) - distAfter(b));
          return opts[0];
        }
        return opts[Math.floor(Math.random() * opts.length)];
      });
    }
  }

  checkGhosts() {
    const pp = posOf(this.player);
    for (const g of this.ghosts) {
      if (g.wait > 0) continue;
      const gp = posOf(g);
      if (Math.hypot(gp.x - pp.x, gp.y - pp.y) > 0.6) continue;
      if (g.scared) {
        this.score += 100;
        sfx.ghost();
        this.burst(gp, g.color, 18);
        this.floatText('+100', gp, '#FFFFFF');
        Object.assign(g, mover(this.maze.ghostHome), { wait: 3, scared: false });
      } else {
        this.caught++;
        this.state = 'caught';
        this.stateT = 1.3;
        sfx.caught();
        this.emitHud();
        return;
      }
    }
  }

  burst(cell, color, n) {
    const c = this.px(cell);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 160;
      this.particles.push({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.5 + Math.random() * 0.3, color });
    }
  }

  floatText(text, cell, color) {
    this.texts.push({ text, cell: { x: cell.x, y: cell.y }, life: 1, color });
  }

  emitHud() {
    const total = this.split.tokens.length;
    this.hooks.onHud({
      level: this.stage.level,
      picture: this.stage.picture,
      index: this.index,
      goal: GOAL,
      emoji: this.word.emoji,
      word: this.word.word,
      showWord: !this.stage.picture || this.peekUntil > this.time || this.state === 'done',
      built: buildPartial(this.split, this.eaten),
      sylDone: this.split.syllables.map((_, si) => this.split.tokens.every((t, i) => t.syl !== si || i < this.eaten)),
      complete: this.eaten >= total,
      score: this.score,
      caught: this.caught,
      peeks: this.peeks,
      canPeek: this.stage.picture && this.peeks > 0 && this.peekUntil <= this.time,
    });
  }

  // ---------- 그리기 ----------
  render() {
    const { ctx, W, H } = this;
    if (!W) return;
    drawBackground(ctx, W, H);
    if (this.state === 'idle' || !this.maze) return;
    const cell = this.cell;
    const t = this.time;
    ctx.drawImage(this.mazeImg.canvas, this.ox, this.oy, this.mazeImg.w, this.mazeImg.h);

    for (const k of this.candies) {
      if (k.eaten) continue;
      const c = this.px(k);
      drawStar(ctx, c.x, c.y, cell * (0.3 + Math.sin(t * 5) * 0.04), t * 0.8);
    }

    const glowJamo = this.blinkHints && this.index < HINT_WORDS && this.state !== 'done' ? this.nextJamo : null;
    for (const tile of this.tiles) {
      if (tile.eaten) continue;
      const c = this.px(tile);
      drawTile(ctx, tile, c.x, c.y, cell, t, tile.jamo === glowJamo);
    }

    for (const g of this.ghosts) {
      let c = this.px(posOf(g));
      if (g.wait > 0) c = { x: c.x + (g.slot - (this.ghosts.length - 1) / 2) * cell * 0.5, y: c.y };
      const blink = g.scared && this.power < 1.5 && Math.floor(t * 6) % 2 === 0;
      drawGhost(ctx, c.x, c.y, cell * (g.wait > 0 ? 0.8 : 1), g.color, g.dir, t + g.slot, g.scared, blink);
    }

    const p = this.player;
    const pc = this.px(posOf(p));
    if (this.state === 'caught') {
      const k = clamp(this.stateT / 1.3, 0, 1);
      drawPacman(ctx, pc.x, pc.y, cell, { x: 0, y: -1 }, 1 - k * 0.3, k);
    } else {
      drawPacman(ctx, pc.x, pc.y, cell, p.face, (Math.sin(p.mouth) + 1) / 2);
    }

    for (const q of this.particles) {
      ctx.globalAlpha = clamp(q.life * 2, 0, 1);
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, cell * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const tx of this.texts) {
      const c = this.px(tx.cell);
      ctx.globalAlpha = clamp(tx.life * 2, 0, 1);
      ctx.font = `${Math.round(cell * 0.45)}px ${FONT}`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#3A2E66';
      ctx.strokeText(tx.text, c.x, c.y - cell * 0.6 - (1 - tx.life) * cell * 0.6);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, c.x, c.y - cell * 0.6 - (1 - tx.life) * cell * 0.6);
    }
    ctx.globalAlpha = 1;

    if (this.state === 'ready' || this.state === 'caught') this.drawBanner(this.state === 'caught' ? '앗, 잡혔다!' : this.banner);
    if (this.state === 'done') this.drawWordCard();
  }

  drawBanner(text) {
    const { ctx } = this;
    const cx = this.ox + (this.maze.cols * this.cell) / 2;
    const cy = this.oy + (this.maze.rows * this.cell) / 2;
    ctx.font = `${Math.round(this.cell * 0.75)}px ${FONT}`;
    const w = ctx.measureText(text).width + this.cell * 1.2;
    const h = this.cell * 1.2;
    roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.fillStyle = '#E8609A';
    ctx.fillText(text, cx, cy + this.cell * 0.04);
  }

  drawWordCard() {
    const { ctx, cell } = this;
    const k = clamp((2.2 - this.stateT) / 0.3, 0, 1);
    const cx = this.ox + (this.maze.cols * cell) / 2;
    const cy = this.oy + (this.maze.rows * cell) / 2;
    const w = cell * 7 * (0.7 + 0.3 * k);
    const h = cell * 4.2 * (0.7 + 0.3 * k);
    ctx.globalAlpha = k;
    roundRect(ctx, cx - w / 2, cy - h / 2, w, h, cell * 0.8);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = cell * 0.12;
    ctx.strokeStyle = '#FFE08A';
    ctx.stroke();
    ctx.font = `${Math.round(cell * 1.5)}px ${FONT}`;
    ctx.fillText(this.word.emoji, cx, cy - cell * 0.85);
    ctx.font = `${Math.round(cell * 1.15)}px ${FONT}`;
    ctx.fillStyle = '#3A2E66';
    ctx.fillText(this.word.word, cx, cy + cell * 0.85);
    ctx.globalAlpha = 1;
  }
}
