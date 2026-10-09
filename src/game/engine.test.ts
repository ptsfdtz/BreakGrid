import { describe, expect, it } from 'vitest';
import { Engine, MAX_BALLS, PADDLE_Y } from './engine';
import { CELL, COLS, ROWS, GRID_X, GRID_Y, HEIGHT, makeLevel, WIDTH, type Brick } from './levels';
import { completeLevel, loadSave, type Save } from './storage';

function isolated(hp = 10): { game: Engine; brick: Brick } {
  const game = new Engine(0, () => 0.99);
  const brick = { id: 13 * COLS + 10, row: 13, col: 10, hp, maxHp: hp, flash: 0 };
  game.bricks.clear(); game.bricks.set(brick.id, brick);
  return { game, brick };
}
describe('durability and physics', () => {
  it('destroys grey on exactly its tenth hit and green on its first', () => {
    const { game, brick } = isolated();
    for (let i = 1; i <= 9; i++) { game.hitBrick(brick); expect(brick.hp).toBe(10 - i); expect(game.bricks.has(brick.id)).toBe(true); }
    game.hitBrick(brick); expect(game.bricks.size).toBe(0); expect(game.status).toBe('won');
    const green = isolated(1); green.game.hitBrick(green.brick); expect(green.game.bricks.size).toBe(0);
  });
  it('reflects from rails and paddle at constant speed', () => {
    const g = new Engine(0); g.launch();
    const b = g.balls[0]; Object.assign(b, { x: 15, y: 480, vx: -200, vy: 180 }); g.step(1 / 120); expect(b.vx).toBeGreaterThan(0);
    Object.assign(b, { x: g.paddle + 30, y: PADDLE_Y - 4, vx: 0, vy: 295 }); g.step(1 / 120);
    expect(b.vy).toBeLessThan(0); expect(b.vx).toBeGreaterThan(0); expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(295);
  });
  it('does not tunnel or deduct twice for one tile contact', () => {
    const { game: g, brick } = isolated(); g.launch(); g.balls = [g.balls[0]];
    const b = g.balls[0]; Object.assign(b, { x: GRID_X + brick.col * CELL + 5, y: GRID_Y + brick.row * CELL + CELL + 4, vx: 0, vy: -295 });
    g.step(1 / 60); expect(brick.hp).toBe(9); expect(b.vy).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) g.step(1 / 120); expect(brick.hp).toBe(9);
  });
  it('spends a life only after all balls fall and retains destruction progress', () => {
    const g = new Engine(0, () => 0.99); g.launch();
    const total = g.bricks.size; g.hitBrick([...g.bricks.values()].find(b => b.maxHp === 1)!);
    g.balls.slice(1).forEach(b => b.y = HEIGHT + 50); g.step(1 / 120); expect(g.lives).toBe(3);
    g.balls[0].y = HEIGHT + 50; g.step(1 / 120);
    expect(g.lives).toBe(2); expect(g.status).toBe('ready'); expect(g.bricks.size).toBe(total - 1);
    for (let i = 0; i < 2; i++) { g.launch(); g.balls.forEach(b => b.y = HEIGHT + 50); g.step(1 / 120); }
    expect(g.status).toBe('lost'); expect(g.lives).toBe(0);
  });
  it('freezes physics and automatic skills when paused', () => {
    const g = new Engine(0); g.launch(); g.pause(); const y = g.balls[0].y;
    g.drops.push({ x: g.paddle, y: PADDLE_Y - 10, kind: 'split' });
    g.step(1); expect(g.balls[0].y).toBe(y); expect(g.balls.length).toBe(1); expect(g.activateSkill('split')).toBe(false);
    g.resume(); g.step(1 / 120); expect(g.balls[0].y).toBeLessThan(y);
  });
});
describe('automatic skills', () => {
  it('launches exactly one ball on first launch, relaunch and retry', () => {
    const g = new Engine(0); expect(g.balls.length).toBe(0); g.launch();
    expect(g.balls.length).toBe(1); expect(g.split).toBe(0); expect(g.volley).toBe(0);
    g.balls.forEach(b => b.y = HEIGHT + 50); g.step(1 / 120); g.launch();
    expect(g.balls.length).toBe(1); expect(g.split).toBe(0); expect(g.volley).toBe(0);
    const retry = new Engine(0); retry.launch(); expect(retry.balls.length).toBe(1);
  });
  it('triples balls automatically and respects the 96-ball limit', () => {
    const g = new Engine(0); g.launch(); g.activateSkill('split'); expect(g.balls.length).toBe(3);
    g.activateSkill('split'); expect(g.balls.length).toBe(9); g.activateSkill('split'); g.activateSkill('split'); g.activateSkill('split'); expect(g.balls.length).toBe(MAX_BALLS);
    const activations = g.split; expect(g.activateSkill('split')).toBe(false); expect(g.split).toBe(activations);
  });
  it('adds three paddle balls and fills only available slots near the cap', () => {
    const g = new Engine(0); expect(g.activateSkill('volley')).toBe(false); g.launch(); g.activateSkill('volley');
    expect(g.balls.length).toBe(4); expect(g.balls.slice(-3).every(b => b.vy < 0 && b.x === g.paddle)).toBe(true);
    g.balls = Array.from({ length: 95 }, () => g.newBall(210, 480, 0));
    expect(g.activateSkill('volley')).toBe(true); expect(g.balls.length).toBe(96); expect(g.activateSkill('volley')).toBe(false);
  });
  it('triggers split immediately on catching a drop; missed drops do nothing', () => {
    const g = new Engine(0, () => 0.99); g.launch();
    g.drops.push({ x: g.paddle, y: PADDLE_Y - 11, kind: 'split' }); g.step(1 / 60);
    expect(g.split).toBe(1); expect(g.balls.length).toBe(3); expect(g.drops.length).toBe(0);
    g.drops.push({ x: 20, y: HEIGHT + 25, kind: 'volley' }); g.step(1 / 120); expect(g.volley).toBe(0); expect(g.drops.length).toBe(0);
  });
  it('can rescue the final falling ball by catching volley, but not split', () => {
    for (const kind of ['volley', 'split'] as const) {
      const g = new Engine(0); g.launch(); g.balls.forEach(b => b.y = HEIGHT + 50);
      g.drops.push({ x: g.paddle, y: PADDLE_Y - 10, kind }); g.step(1 / 120);
      expect(g.lives).toBe(kind === 'volley' ? 3 : 2); expect(g.balls.length).toBe(kind === 'volley' ? 3 : 0);
    }
  });
  it('uses 8% drops for green and 25% for ten-hit grey', () => {
    const g = new Engine(0, () => 0.1); const green = [...g.bricks.values()].find(b => b.maxHp === 1)!;
    g.hitBrick(green); expect(g.drops.length).toBe(0);
    const grey = [...g.bricks.values()].find(b => b.maxHp === 10)!; for (let i = 0; i < 10; i++) g.hitBrick(grey); expect(g.drops.length).toBe(1);
  });
});
describe('closed chambers and campaign', () => {
  it('has six distinct dense maps bounded by ten-hit grey walls', () => {
    const signatures = [];
    for (let i = 0; i < 6; i++) {
      const b = makeLevel(i); expect(b.length).toBeGreaterThan(1100); expect(b.some(b => b.hp === 1)).toBe(true);
      expect(b.every(b => b.col >= 0 && b.col < COLS && b.row >= 0 && b.row < ROWS)).toBe(true);
      expect(b.filter(b => b.row === 0 || b.col === 0 || b.col === COLS - 1 || b.row === ROWS - 1).every(b => b.hp === 10)).toBe(true);
      expect(new Set(b.map(b => b.id)).size).toBe(b.length); signatures.push(JSON.stringify(b));
    }
    expect(new Set(signatures).size).toBe(6); expect(WIDTH).toBeGreaterThan(COLS * CELL);
  });
  it('has a single-cell gate and a navigable offset passage to the chamber', () => {
    for (let level = 0; level < 6; level++) {
      const bricks = makeLevel(level), occupied = new Set(bricks.map(b => b.id));
      expect(bricks.filter(b => b.row === ROWS - 1)).toHaveLength(COLS - 1);
      expect(occupied.has((ROWS - 1) * COLS + 18)).toBe(false);
      expect(occupied.has(36 * COLS + 18)).toBe(true); expect(occupied.has(36 * COLS + 21)).toBe(false);
      const queue = [[18, ROWS - 1]], visited = new Set<string>();
      while (queue.length) {
        const [c, r] = queue.shift()!, key = `${c},${r}`;
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS || visited.has(key) || occupied.has(r * COLS + c)) continue;
        visited.add(key); queue.push([c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]);
      }
      expect(visited.has('20,34')).toBe(true);
    }
  });
  it('keeps a 96-ball simulation finite on all six layouts', () => {
    for (let level = 0; level < 6; level++) {
      const g = new Engine(level, () => 0.99); g.launch();
      g.balls = Array.from({ length: MAX_BALLS }, (_, i) => g.newBall(30 + i % 24 * 15, GRID_Y + ROWS * CELL + 18 + Math.floor(i / 24) * 8, (i % 9 - 4) * 0.2));
      for (let f = 0; f < 1200 && g.status === 'playing'; f++) {
        const approaching = g.balls.filter(b => b.vy > 0).sort((a, b) => b.y - a.y)[0]; if (approaching) g.move(approaching.x); g.step(1 / 120);
      }
      expect(g.bricks.size).toBeLessThan(g.total); expect(g.balls.every(b => [b.x, b.y, b.vx, b.vy].every(Number.isFinite))).toBe(true); expect(g.balls.length).toBeLessThanOrEqual(MAX_BALLS);
    }
  });
  it('unlocks the next level and retains best scores', () => {
    const save: Save = { unlocked: 1, best: Array(6).fill(0), sound: true, vibration: true };
    const next = completeLevel(save, 0, 1200); expect(next.unlocked).toBe(2); expect(next.best[0]).toBe(1200);
    expect(completeLevel(next, 0, 500).best[0]).toBe(1200); expect(completeLevel(next, 5, 2000).unlocked).toBe(6);
  });
  it('handles unavailable browser storage', () => { expect(loadSave().unlocked).toBe(1); });
});
