import maps from './maps.json';

export const WIDTH = 420;
export const HEIGHT = 590;
export const COLS = 38;
export const ROWS = 43;
export const CELL = 10;
export const GRID_X = (WIDTH - COLS * CELL) / 2;
export const GRID_Y = 20;
export type Brick = { id: number; col: number; row: number; hp: number; maxHp: number; flash: number };
type Rect = number[]; // [column, row, width, height], in grid cells.
export type Entrance = { side: string; position: number; width: number; depth: number; bend: number };
export type MapConfig = { id: string; name: string; pockets: Rect[]; walls: Rect[]; entrances: Entrance[] };
export const LEVELS: MapConfig[] = maps;

export function makeLevel(level: number): Brick[] {
  const config = LEVELS[level];
  if (!config) throw new RangeError(`Unknown map: ${level}`);
  const empty = new Set<number>();
  const walls = new Set<number>();
  const fill = (target: Set<number>, [x, y, width, height]: Rect) => {
    for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) {
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) target.add(row * COLS + col);
    }
  };
  config.pockets.forEach(rect => fill(empty, rect));
  config.walls.forEach(rect => fill(walls, rect));
  for (const gate of config.entrances) {
    // Local coordinates: u runs along the edge; v points into the chamber.
    const carve = (u: number, v: number) => {
      const [col, row] = gate.side === 'bottom' ? [u, ROWS - 1 - v]
        : gate.side === 'top' ? [u, v]
        : gate.side === 'left' ? [v, u] : [COLS - 1 - v, u];
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) empty.add(row *COLS + col);
    };
    for (let v = 0; v <= gate.depth; v++) for (let u = 0; u < gate.width; u++) carve(gate.position + u, v);
    const offset = gate.position + gate.bend;
    for (let u = Math.min(gate.position, offset); u < Math.max(gate.position, offset) + gate.width; u++) {
      for (let v = gate.depth; v < gate.depth + gate.width; v++) carve(u, v);
    }
    for (let v = gate.depth; v < gate.depth + gate.width + 3; v++) {
      for (let u = 0; u < gate.width; u++) carve(offset + u, v);
    }
    for (let v = gate.depth + gate.width + 2; v < gate.depth + gate.width + 6; v++) {
      for (let u = offset - 2; u < offset + gate.width + 3; u++) carve(u, v);
    }
  }
  const bricks: Brick[] = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const id = row * COLS + col;
    if (empty.has(id)) continue;
    const border = row === 0 || col === 0 || col === COLS - 1 || row >= ROWS - 2;
    const pocketWall = [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]]
      .some(([c, r]) => c >= 0 && c < COLS && r >= 0 && r < ROWS && empty.has(r * COLS + c));
    const hp = border || pocketWall || walls.has(id) ? 10 : 1;
    bricks.push({ id, col, row, hp, maxHp: hp, flash: 0 });
  }
  return bricks;
}
