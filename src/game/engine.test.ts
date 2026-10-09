import { describe, expect, it, vi } from 'vitest';
import { Engine, PADDLE_Y, SKILL_COOLDOWN } from './engine';
import { CELL, COLS, ROWS, LEVELS, GRID_X, GRID_Y, HEIGHT, makeLevel, WIDTH, type Brick } from './levels';
import { recordBest, loadSave, type Save } from './storage';

function isolated(hp = 10): { game: Engine; brick: Brick } {
  const game = new Engine(0, () => 0.99);
  const brick = { id: 13 * COLS + 10, row: 13, col: 10, hp, maxHp: hp, flash: 0 };
  game.bricks.clear(); game.bricks.set(brick.id, brick);
  if (hp > 1) game.bricks.set(0, { id: 0, col: 0, row: 0, hp: 1, maxHp: 1, flash: 0 });
  game.greenTotal = 1; game.greenRemaining = 1;
  return { game, brick };
}
describe('durability and physics', () => {
  it('destroys grey on exactly its tenth hit and green on its first', () => {
    const { game, brick } = isolated();
    for (let i = 1; i <= 9; i++) { game.hitBrick(brick); expect(brick.hp).toBe(10 - i); expect(game.bricks.has(brick.id)).toBe(true); }
    game.hitBrick(brick); expect(game.bricks.size).toBe(1); expect(game.status).not.toBe('won');
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
  it('triples every ball on each activation beyond the former limit', () => {
    const g = new Engine(0); g.launch();
    for (let i = 1; i <= 8; i++) {
      g.elapsed = i * SKILL_COOLDOWN;
      expect(g.activateSkill('split')).toBe(true);
      expect(g.balls.length).toBe(3 ** i); expect(g.split).toBe(i);
    }
  });
  it('always adds three paddle balls regardless of the current count', () => {
    const g = new Engine(0); expect(g.activateSkill('volley')).toBe(false); g.launch(); g.activateSkill('volley');
    expect(g.balls.length).toBe(4); expect(g.balls.slice(-3).every(b => b.vy < 0 && b.x === g.paddle)).toBe(true);
    g.balls = Array.from({ length: 95 }, () => g.newBall(210, 480, 0));
    g.elapsed += SKILL_COOLDOWN;
    expect(g.activateSkill('volley')).toBe(true); expect(g.balls.length).toBe(98);
    g.elapsed += SKILL_COOLDOWN;
    expect(g.activateSkill('volley')).toBe(true); expect(g.balls.length).toBe(101);
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
  it('triples all current balls only once for simultaneous split drops', () => {
    const g = new Engine(0, () => 0.99); g.launch();
    g.balls = Array.from({ length: 100 }, (_, i) => g.newBall(50 + i * 3, 480, 0));
    const originals = [...g.balls];
    const events: string[] = []; g.onEvent = event => events.push(event);
    g.drops.push(...Array.from({ length: 2 }, () => ({ x: g.paddle, y: PADDLE_Y - 10, kind: 'split' as const })));
    g.step(1 / 120);
    expect(g.balls.length).toBe(300); expect(g.split).toBe(1); expect(g.drops).toHaveLength(0);
    expect(events.filter(event => event === 'skill')).toHaveLength(1);
    expect(events.filter(event => event === 'catch')).toHaveLength(1);
    for (const b of originals) {
      expect(g.balls.filter(other => other.x === b.x && other.y === b.y)).toHaveLength(3);
    }
  });
  it('uses independent cooldowns without extending them on suppressed attempts', () => {
    const g = new Engine(0); g.launch();
    expect(g.activateSkill('split')).toBe(true);
    expect(g.activateSkill('volley')).toBe(true);
    expect(g.balls).toHaveLength(6);
    g.elapsed = SKILL_COOLDOWN - 0.001;
    expect(g.activateSkill('split')).toBe(false);
    expect(g.activateSkill('volley')).toBe(false);
    expect(g.split).toBe(1); expect(g.volley).toBe(1);
    g.elapsed = SKILL_COOLDOWN;
    expect(g.activateSkill('split')).toBe(true);
    expect(g.balls).toHaveLength(18);
    expect(g.activateSkill('volley')).toBe(true);
    expect(g.balls).toHaveLength(21);
  });
  it('does not consume cooldown on failed activation or advance it during pause', () => {
    const g = new Engine(0); g.status = 'playing';
    expect(g.activateSkill('split')).toBe(false);
    g.balls.push(g.newBall(210, 480, 0));
    expect(g.activateSkill('split')).toBe(true);
    g.pause(); g.step(1);
    expect(g.elapsed).toBe(0);
    g.resume(); expect(g.activateSkill('split')).toBe(false);
    const retry = new Engine(0); retry.launch();
    expect(retry.activateSkill('split')).toBe(true);
  });
  it('uses 8% drops for green and 25% for ten-hit grey', () => {
    const g = new Engine(0, () => 0.1); const green = [...g.bricks.values()].find(b => b.maxHp === 1)!;
    g.hitBrick(green); expect(g.drops.length).toBe(0);
    const grey = [...g.bricks.values()].find(b => b.maxHp === 10)!; for (let i = 0; i < 10; i++) g.hitBrick(grey); expect(g.drops.length).toBe(1);
  });
});
describe('closed chambers and campaign', () => {
  it('wins when the final green disappears even with grey walls remaining', () => {
    const g = new Engine(0, () => 0.99); g.launch(); let wins = 0;
    g.onEvent = event => { if (event === 'win') wins++; };
    const greens = [...g.bricks.values()].filter(b => b.maxHp === 1);
    const grey = [...g.bricks.values()].find(b => b.maxHp === 10)!;
    g.hitBrick(grey); expect(g.snapshot().progress).toBe(0);
    for (const brick of greens.slice(0, -1)) g.hitBrick(brick);
    expect(g.status).toBe('playing'); expect(g.snapshot().remaining).toBe(1);
    g.hitBrick(greens[greens.length - 1]);
    expect(g.status).toBe('won'); expect(g.bricks.size).toBeGreaterThan(0);
    expect([...g.bricks.values()].every(b => b.maxHp === 10)).toBe(true);
    expect(g.snapshot().progress).toBe(1); expect(g.snapshot().remaining).toBe(0); expect(wins).toBe(1);
    const score = g.score; g.hitBrick(grey); expect(g.score).toBe(score);
    g.balls.forEach(b => b.y = HEIGHT + 50); g.step(1 / 120); expect(g.lives).toBe(3);
  });
  it('has 24 distinct dense maps bounded by ten-hit grey walls', () => {
    const signatures = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const b = makeLevel(i); expect(b.length).toBeGreaterThan(1100); expect(b.some(b => b.hp === 1)).toBe(true);
      expect(b.every(b => b.col >= 0 && b.col < COLS && b.row >= 0 && b.row < ROWS)).toBe(true);
      expect(b.filter(b => b.row === 0 || b.col === 0 || b.col === COLS - 1 || b.row === ROWS - 1).every(b => b.hp === 10)).toBe(true);
      expect(new Set(b.map(b => b.id)).size).toBe(b.length); signatures.push(JSON.stringify(b));
    }
    expect(new Set(signatures).size).toBe(24); expect(WIDTH).toBeGreaterThan(COLS * CELL);
  });
  it('has valid, connected entrances with bottom-only openings and varied tunnel lengths, widths and positions', () => {
    expect(LEVELS).toHaveLength(24);
    expect(new Set(LEVELS.map(map => map.id)).size).toBe(24);
    expect(new Set(LEVELS.flatMap(map => map.entrances.map(gate => gate.side)))).toEqual(new Set(['bottom']));
    expect(new Set(LEVELS.flatMap(map => map.entrances.map(gate => gate.depth))).size).toBeGreaterThan(6);
    expect(new Set(LEVELS.flatMap(map => map.entrances.map(gate => gate.width))).size).toBe(3);
    for (let level = 0; level < LEVELS.length; level++) {
      const config = LEVELS[level];
      const occupied = new Set(makeLevel(level).map(brick => brick.id));
      for (let col = 0; col < COLS; col++) expect(occupied.has(col)).toBe(true);
      for (let row = 0; row < ROWS; row++) {
        expect(occupied.has(row * COLS)).toBe(true);
        expect(occupied.has(row * COLS + COLS - 1)).toBe(true);
      }
      const mouths = new Set(config.entrances.flatMap(gate => Array.from({ length: gate.width }, (_, i) => gate.position + i)));
      for (let col = 0; col < COLS; col++) expect(occupied.has((ROWS - 1) * COLS + col)).toBe(!mouths.has(col));
      for (const gate of config.entrances) {
        const edgeLength = ['top', 'bottom'].includes(gate.side) ? COLS : ROWS;
        expect(gate.position).toBeGreaterThan(0);
        expect(gate.position + gate.width).toBeLessThan(edgeLength);
        expect(gate.width * CELL).toBeGreaterThan(6.8); // Ball diameter fits the aperture.
        const [c, r] = gate.side === 'bottom' ? [gate.position, ROWS - 1]
          : gate.side === 'top' ? [gate.position, 0]
          : gate.side === 'left' ? [0, gate.position] : [COLS - 1, gate.position];
        const queue = [[c, r]], visited = new Set<number>();
        while (queue.length) {
          const [x, y] = queue.shift()!, id = y * COLS + x;
          if (x < 0 || x >= COLS || y < 0 || y >= ROWS || occupied.has(id) || visited.has(id)) continue;
          visited.add(id); queue.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
        }
        expect(visited.size).toBeGreaterThan(gate.depth + gate.width);
        const depths = [...visited].map(id => {
          const x = id % COLS, y = Math.floor(id / COLS);
          return gate.side === 'bottom' ? ROWS - 1 - y : gate.side === 'top' ? y : gate.side === 'left' ? x : COLS - 1 - x;
        });
        expect(Math.max(...depths)).toBeGreaterThan(gate.depth + 3);
      }
    }
  });
  it('keeps a 243-ball simulation finite on all 24 layouts', () => {
    for (let level = 0; level < LEVELS.length; level++) {
      const g = new Engine(level, () => 0.99); g.launch();
      g.balls = Array.from({ length: 243 }, (_, i) => g.newBall(30 + i % 24 * 15, GRID_Y + ROWS * CELL + 18 + Math.floor(i / 24) * 8, (i % 9 - 4) * 0.2));
      for (let f = 0; f < 1200 && g.status === 'playing'; f++) {
        const approaching = g.balls.filter(b => b.vy > 0).sort((a, b) => b.y - a.y)[0]; if (approaching) g.move(approaching.x); g.step(1 / 120);
      }
      expect(g.bricks.size).toBeLessThan(g.total); expect(g.balls.every(b => [b.x, b.y, b.vx, b.vy].every(Number.isFinite))).toBe(true);
    }
  });
  it('records independent map best scores', () => {
    const save: Save = { best: Array(LEVELS.length).fill(0), sound: true, vibration: true };
    const next = recordBest(save, 0, 1200); expect(next.best[0]).toBe(1200);
    expect(recordBest(next, 0, 500).best[0]).toBe(1200); expect(recordBest(next, 5, 2000).best[5]).toBe(2000);
  });
  it('handles unavailable browser storage', () => { expect(loadSave().best).toEqual(Array(LEVELS.length).fill(0)); });
  it('expands existing six-map saves while preserving scores and settings', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ best: [1200, 0, 700, 0, 0, 900], sound: false, vibration: true }) });
    try {
      const save = loadSave();
      expect(save.best).toHaveLength(24);
      expect(save.best.slice(0, 6)).toEqual([1200, 0, 700, 0, 0, 900]);
      expect(save.best.slice(6)).toEqual(Array(18).fill(0));
      expect(save.sound).toBe(false);
      expect(recordBest(save, 23, 4200).best[23]).toBe(4200);
    } finally { vi.unstubAllGlobals(); }
  });
});
