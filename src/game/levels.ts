export const WIDTH = 420;
export const HEIGHT = 590;
export const COLS = 38;
export const ROWS = 43;
export const CELL = 10;
export const GRID_X = (WIDTH - COLS * CELL) / 2;
export const GRID_Y = 20;
export type Brick = { id: number; col: number; row: number; hp: number; maxHp: number; flash: number };
export const LEVELS = [
  { name: '初见裂隙' }, { name: '双生绿洲' }, { name: '曲径穿行' },
  { name: '环形禁区' }, { name: '全面突破' }, { name: '终极风暴' },
];

// A one-cell gate and offset inner throat form a narrow dogleg into each chamber.
export function makeLevel(level: number): Brick[] {
  const occupied = new Set<number>();
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    let empty = false;
    if (level === 0) empty = col >= 13 && col <= 24 && row >= 13 && row <= 30;
    if (level === 1) empty = (col >= 7 && col <= 13 || col >= 24 && col <= 30) && row >= 16 && row <= 30 || row >= 29 && row <= 30 && col >= 7 && col <= 30;
    if (level === 2) empty = col >= 9 && col <= 10 && row >= 12 && row <= 29 || row >= 28 && row <= 29 && col >= 9 && col <= 25 || col >= 24 && col <= 25 && row >= 29 && row <= 36;
    if (level === 3) empty = Math.hypot((col - 18.5) / 1.1, row - 22) < 7;
    if (level === 4) empty = ((col >= 9 && col <= 10 || col >= 27 && col <= 28) && row >= 12 && row <= 32) || (row >= 31 && row <= 32 && col >= 9 && col <= 28);
    if (level === 5) empty = col >= 15 && col <= 22 && row >= 26 && row <= 33;
    empty ||= col >= 15 && col <= 24 && row >= 31 && row <= 35;
    empty ||= col === 21 && row >= 35 && row <= 38;
    empty ||= row === 38 && col >= 18 && col <= 21;
    empty ||= col === 18 && row >= 38;
    if (!empty) occupied.add(row * COLS + col);
  }
  const bricks: Brick[] = [];
  for (const id of occupied) {
    const row = Math.floor(id / COLS), col = id % COLS;
    const outer = row === 0 || col === 0 || col === COLS - 1 || row >= ROWS - 2;
    const pocketWall = row >= 30 && ([id - 1, id + 1, id - COLS, id + COLS].some(neighbor => !occupied.has(neighbor)));
    const partition = level === 1 && col === 18 && row < 28
      || level === 2 && row === 27 && col < 24
      || level === 3 && Math.abs(Math.hypot((col - 18.5) / 1.1, row - 22) - 8) < 0.8
      || level === 4 && (row === 12 || row === 23) && col > 1 && col < COLS - 2
      || level === 5 && (row === 12 || row === 24 || col === 11 || col === 26);
    const grey = outer || pocketWall || partition;
    bricks.push({ id, col, row, hp: grey ? 10 : 1, maxHp: grey ? 10 : 1, flash: 0 });
  }
  return bricks;
}
