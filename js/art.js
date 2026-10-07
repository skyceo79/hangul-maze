// 그림: 미로, 글자 타일, 팩맨, 유령, 별사탕
import { isVowel } from './hangul.js';

export const FONT = "'Jua', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const INK = '#3A2E66';
const PATH = '#2E2C66';
export const GHOST_COLORS = ['#FF8FB8', '#7CC6FF', '#FFB86B'];

export function drawBackground(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2B2A5E');
  g.addColorStop(1, '#4A3D80');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// 미로는 단어마다 한 번만 그려 두고 재사용한다
export function renderMaze(maze, cell, wallColor) {
  const w = maze.cols * cell;
  const h = maze.rows * cell;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * dpr);
  c.height = Math.ceil(h * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  roundRect(ctx, 0, 0, w, h, cell * 0.45);
  ctx.fillStyle = wallColor;
  ctx.fill();

  const center = (x) => (x + 0.5) * cell;
  const corridors = (width, color) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let y = 0; y < maze.rows; y++) {
      for (let x = 0; x < maze.cols; x++) {
        if (!maze.open(x, y)) continue;
        if (maze.open(x + 1, y)) {
          ctx.moveTo(center(x), center(y));
          ctx.lineTo(center(x + 1), center(y));
        }
        if (maze.open(x, y + 1)) {
          ctx.moveTo(center(x), center(y));
          ctx.lineTo(center(x), center(y + 1));
        }
      }
    }
    ctx.stroke();
  };
  corridors(cell * 0.96, 'rgba(255,255,255,0.75)');
  corridors(cell * 0.8, PATH);
  return { canvas: c, w, h };
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 글자 타일: 자음은 분홍, 모음은 하늘색
export function drawTile(ctx, tile, x, y, cell, t, glow) {
  const vowel = isVowel(tile.jamo);
  const wig = tile.wiggle > 0 ? Math.sin(t * 45) * tile.wiggle * cell * 0.12 : 0;
  const pulse = glow ? 1 + Math.sin(t * 7) * 0.1 : 1;
  const r = cell * 0.4 * pulse;
  ctx.save();
  ctx.translate(x + wig, y);
  if (glow) {
    ctx.shadowColor = '#FFE08A';
    ctx.shadowBlur = cell * 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + cell * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 224, 138, ${0.55 + Math.sin(t * 7) * 0.35})`;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  roundRect(ctx, -r, -r, r * 2, r * 2, r * 0.42);
  ctx.fillStyle = vowel ? '#E2F3FF' : '#FFE3EE';
  ctx.fill();
  ctx.lineWidth = Math.max(2, cell * 0.06);
  ctx.strokeStyle = vowel ? '#3D97D6' : '#E8609A';
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `${Math.round(cell * 0.52 * pulse)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tile.jamo, 0, cell * 0.03);
  ctx.restore();
}

export function drawPacman(ctx, x, y, cell, dir, mouth, scale = 1) {
  const r = cell * 0.42 * scale;
  if (r <= 0.5) return;
  const ang = Math.atan2(dir.y, dir.x || (dir.y ? 0 : 1));
  const m = 0.08 + mouth * 0.32;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, m * Math.PI, (2 - m) * Math.PI);
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#FFF3B8');
  g.addColorStop(1, '#FFD23F');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, cell * 0.04);
  ctx.strokeStyle = '#D99A12';
  ctx.stroke();
  // 눈과 볼 (왼쪽을 볼 때 뒤집히지 않게)
  const flip = Math.cos(ang) < -0.1 ? -1 : 1;
  ctx.scale(1, flip);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(r * 0.12, -r * 0.5, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 140, 170, 0.55)';
  ctx.beginPath();
  ctx.arc(-r * 0.25, -r * 0.1, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawGhost(ctx, x, y, cell, color, dir, t, scared, blinkWhite) {
  const r = cell * 0.42;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 6) * cell * 0.03);
  ctx.beginPath();
  ctx.arc(0, -r * 0.15, r, Math.PI, 0);
  const bottom = r * 0.85;
  ctx.lineTo(r, bottom);
  const waves = 4;
  for (let i = 0; i < waves; i++) {
    const x0 = r - (i * 2 * r) / waves;
    const x1 = r - ((i + 1) * 2 * r) / waves;
    const wy = bottom - r * 0.22 * (0.6 + 0.4 * Math.sin(t * 10 + i));
    ctx.quadraticCurveTo((x0 + x1) / 2, wy, x1, bottom);
  }
  ctx.closePath();
  ctx.fillStyle = scared ? (blinkWhite ? '#FFFFFF' : '#7B83FF') : color;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, cell * 0.04);
  ctx.strokeStyle = 'rgba(58, 46, 102, 0.45)';
  ctx.stroke();
  if (scared) {
    ctx.fillStyle = blinkWhite ? '#E8609A' : '#FFFFFF';
    [-0.35, 0.35].forEach((ex) => {
      ctx.beginPath();
      ctx.arc(ex * r, -r * 0.2, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = Math.max(1.5, cell * 0.04);
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) ctx.lineTo(-r * 0.45 + (i * r * 0.9) / 4, r * 0.3 + (i % 2 ? -1 : 1) * r * 0.08);
    ctx.stroke();
  } else {
    [-0.35, 0.35].forEach((ex) => {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(ex * r, -r * 0.2, r * 0.24, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex * r + dir.x * r * 0.11, -r * 0.2 + dir.y * r * 0.13, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(-r * 0.45, r * 0.25, r * 0.1, 0, Math.PI * 2);
    ctx.arc(r * 0.45, r * 0.25, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawStar(ctx, x, y, r, rot = 0, color = '#FFE08A') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.48 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 0.8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.strokeStyle = '#D99A12';
  ctx.stroke();
  ctx.restore();
}
