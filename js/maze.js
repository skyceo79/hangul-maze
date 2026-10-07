// 미로 모양. # = 벽, . = 길, P = 팩맨 출발, G = 유령 출발, * = 별사탕 놓을 수 있는 자리
// 막다른 길이 없도록 만들었다 (모든 길 칸은 갈 수 있는 방향이 2개 이상).
const LAYOUTS = [
  [
    '###############',
    '#*...........*#',
    '#.##.##.##.##.#',
    '#.............#',
    '#.##.#.#.#.##.#',
    '#....#.G.#....#',
    '#.##.#.#.#.##.#',
    '#.............#',
    '#.##.##.##.##.#',
    '#*.....P.....*#',
    '###############',
  ],
  [
    '###############',
    '#*.....#.....*#',
    '#.####.#.####.#',
    '#.............#',
    '#.#.###G###.#.#',
    '#.#...#.#...#.#',
    '#.###.#.#.###.#',
    '#.............#',
    '#.####.#.####.#',
    '#*.....P.....*#',
    '###############',
  ],
  [
    '###############',
    '#*..#.....#..*#',
    '#.#.#.###.#.#.#',
    '#.#.........#.#',
    '#.#.##.G.##.#.#',
    '#......#......#',
    '#.##.#.#.#.##.#',
    '#....#...#....#',
    '#.##.#.#.#.##.#',
    '#*.....P.....*#',
    '###############',
  ],
  [
    '###############',
    '#*...........*#',
    '#.#.###.###.#.#',
    '#.#...#.#...#.#',
    '#.###.#G#.###.#',
    '#.............#',
    '#.#.#.###.#.#.#',
    '#...#.....#...#',
    '#.#.#.#.#.#.#.#',
    '#*.....P.....*#',
    '###############',
  ],
];

export const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
export const DIR_LIST = Object.values(DIRS);

export class Maze {
  constructor(rows) {
    this.rows = rows.length;
    this.cols = rows[0].length;
    this.wall = rows.map((r) => [...r].map((c) => c === '#'));
    this.corners = [];
    rows.forEach((r, y) => [...r].forEach((c, x) => {
      if (c === 'P') this.start = { x, y };
      if (c === 'G') this.ghostHome = { x, y };
      if (c === '*') this.corners.push({ x, y });
    }));
  }

  open(x, y) {
    return y >= 0 && y < this.rows && x >= 0 && x < this.cols && !this.wall[y][x];
  }

  openCells() {
    const out = [];
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) if (!this.wall[y][x]) out.push({ x, y });
    return out;
  }

  // 길 찾기용 거리표 (from에서 각 칸까지 몇 걸음)
  distances(from) {
    const d = this.wall.map((r) => r.map(() => Infinity));
    d[from.y][from.x] = 0;
    const q = [from];
    while (q.length) {
      const c = q.shift();
      for (const v of DIR_LIST) {
        const nx = c.x + v.x;
        const ny = c.y + v.y;
        if (this.open(nx, ny) && d[ny][nx] === Infinity) {
          d[ny][nx] = d[c.y][c.x] + 1;
          q.push({ x: nx, y: ny });
        }
      }
    }
    return d;
  }
}

let lastLayout = -1;
export function randomMaze() {
  let i;
  do i = Math.floor(Math.random() * LAYOUTS.length);
  while (i === lastLayout && LAYOUTS.length > 1);
  lastLayout = i;
  return new Maze(LAYOUTS[i]);
}

export const ALL_LAYOUTS = LAYOUTS;
