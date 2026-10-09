import { CELL, COLS, GRID_X, GRID_Y, HEIGHT, makeLevel, WIDTH, type Brick } from './levels';

export type Status = 'ready' | 'playing' | 'paused' | 'won' | 'lost';
export type Skill = 'split' | 'volley';
export type Ball = { x: number; y: number; vx: number; vy: number; trail: { x: number; y: number }[] };
export type Drop = { x: number; y: number; kind: Skill };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
export type Snapshot = { status: Status; lives: number; score: number; balls: number; remaining: number; total: number; split: number; volley: number; combo: number; progress: number; wonTime: number };
export type GameEvent = 'hit' | 'break' | 'catch' | 'skill' | 'life' | 'win';
const SPEED = 295;
export const MAX_BALLS = 96;
export const PADDLE_Y = HEIGHT - 44;
export const PADDLE_WIDTH = 86;
const RADIUS = 3.4;

export class Engine {
  bricks = new Map<number, Brick>();
  balls: Ball[] = [];
  drops: Drop[] = [];
  particles: Particle[] = [];
  status: Status = 'ready';
  lives = 3;
  score = 0;
  split = 0;
  volley = 0;
  paddle = WIDTH / 2;
  target = WIDTH / 2;
  total = 0;
  combo = 0;
  comboTimer = 0;
  elapsed = 0;
  shake = 0;
  wonTime = 0;
  onEvent?: (event: GameEvent) => void;
  constructor(public level: number, private random: () => number = Math.random) {
    makeLevel(level).forEach(b => this.bricks.set(b.id, b));
    this.total = this.bricks.size;
  }
  snapshot(): Snapshot {
    return { status: this.status, lives: this.lives, score: this.score, balls: this.balls.length, remaining: this.bricks.size, total: this.total, split: this.split, volley: this.volley, combo: this.combo, progress: 1 - this.bricks.size / this.total, wonTime: this.wonTime };
  }
  move(x: number) { this.target = Math.max(12 + PADDLE_WIDTH / 2, Math.min(WIDTH - 12 - PADDLE_WIDTH / 2, x)); }
  newBall(x: number, y: number, angle: number): Ball {
    return { x, y, vx: Math.sin(angle) * SPEED, vy: -Math.cos(angle) * SPEED, trail: [] };
  }
  launch() {
    if (this.status !== 'ready') return;
    this.balls.push(this.newBall(this.paddle, PADDLE_Y - 10, 0.19));
    this.status = 'playing';
  }
  pause() { if (this.status === 'playing') this.status = 'paused'; }
  resume() { if (this.status === 'paused') this.status = 'playing'; }
  activateSkill(kind: Skill) {
    if (this.status !== 'playing') return false;
    if (kind === 'split') {
      if (!this.balls.length || this.balls.length >= MAX_BALLS) return false;
      const originals = [...this.balls];
      for (const b of originals) for (const rotation of [-0.38, 0.38]) {
        if (this.balls.length >= MAX_BALLS) break;
        let vx = b.vx * Math.cos(rotation) - b.vy * Math.sin(rotation);
        let vy = b.vx * Math.sin(rotation) + b.vy * Math.cos(rotation);
        if (Math.abs(vy) < SPEED * 0.28) { vy = Math.sign(vy || -1) * SPEED * 0.28; vx = Math.sign(vx || 1) * Math.sqrt(SPEED ** 2 - vy ** 2); }
        this.balls.push({ x: b.x, y: b.y, vx, vy, trail: [] });
      }
    } else {
      const slots = Math.min(3, MAX_BALLS - this.balls.length);
      if (slots <= 0) return false;
      for (const a of [-0.38, 0, 0.38].slice(0, slots)) this.balls.push(this.newBall(this.paddle, PADDLE_Y - 10, a));
    }
    this[kind]++;
    this.shake = 3;
    this.onEvent?.('skill');
    return true;
  }
  hitBrick(brick: Brick) {
    if (!this.bricks.has(brick.id)) return;
    brick.hp--;
    brick.flash = 0.11;
    if (brick.hp > 0) { this.score += 2; this.onEvent?.('hit'); return; }
    this.bricks.delete(brick.id);
    this.combo++;
    this.comboTimer = 1.8;
    this.score += (brick.maxHp > 1 ? 50 : 10) + Math.min(30, Math.floor(this.combo / 5) * 2);
    const x = GRID_X + brick.col * CELL + CELL / 2;
    const y = GRID_Y + brick.row * CELL + CELL / 2;
    this.burst(x, y, brick.maxHp > 1 ? '#b9c5d9' : '#a7f768', this.balls.length > 24 ? 2 : 5);
    if (this.random() < (brick.maxHp > 1 ? 0.25 : 0.08)) this.drops.push({ x, y, kind: this.random() < 0.5 ? 'split' : 'volley' });
    this.onEvent?.('break');
    if (!this.bricks.size) {
      this.status = 'won';
      this.shake = 6;
      this.onEvent?.('win');
      for (let i = 0; i < 12; i++) this.burst(this.random() * WIDTH, this.random() * HEIGHT * 0.8, ['#a7f768', '#aa9bff', '#ffcf75'][i % 3], 10);
    }
  }
  burst(x: number, y: number, color: string, count: number) {
    if (this.particles.length > 380) return;
    for (let i = 0; i < count; i++) {
      const a = this.random() * Math.PI * 2;
      const speed = 30 + this.random() * 120;
      this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0.4 + this.random() * 0.4, color });
    }
  }
  step(dt: number) {
    if (this.status !== 'playing' && this.status !== 'won') return;
    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 12);
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; p.life -= dt; }
    this.particles = this.particles.filter(p => p.life > 0);
    if (this.status === 'won') { this.wonTime += dt; return; }
    this.paddle += (this.target - this.paddle) * Math.min(1, dt * 35);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;
    for (const brick of this.bricks.values()) brick.flash = Math.max(0, brick.flash - dt);
    // Fixed 120 Hz physics, further subdivided to stay below half a ball radius.
    for (const ball of this.balls) {
      if (this.balls.length <= 32) { ball.trail.unshift({ x: ball.x, y: ball.y }); ball.trail.length = Math.min(10, ball.trail.length); }
      else ball.trail = [];
      const steps = Math.ceil(SPEED * dt / (RADIUS / 2));
      for (let i = 0; i < steps; i++) {
        const oldX = ball.x, oldY = ball.y;
        ball.x += ball.vx * dt / steps;
        ball.y += ball.vy * dt / steps;
        if (ball.x < 12 + RADIUS) { ball.x = 12 + RADIUS; ball.vx = Math.abs(ball.vx); }
        if (ball.x > WIDTH - 12 - RADIUS) { ball.x = WIDTH - 12 - RADIUS; ball.vx = -Math.abs(ball.vx); }
        if (ball.y < 12 + RADIUS) { ball.y = 12 + RADIUS; ball.vy = Math.abs(ball.vy); }
        if (ball.vy > 0 && oldY + RADIUS <= PADDLE_Y && ball.y + RADIUS >= PADDLE_Y && Math.abs(ball.x - this.paddle) <= PADDLE_WIDTH / 2 + RADIUS) {
          const offset = Math.max(-1, Math.min(1, (ball.x - this.paddle) / (PADDLE_WIDTH / 2)));
          const angle = offset * 1.04;
          ball.vx = Math.sin(angle) * SPEED;
          if (Math.abs(ball.vx) < 22) ball.vx = Math.sign(ball.vx || 1) * 22;
          ball.vy = -Math.sqrt(SPEED ** 2 - ball.vx ** 2);
          ball.y = PADDLE_Y - RADIUS - 0.1;
        }
        const minC = Math.max(0, Math.floor((ball.x - RADIUS - GRID_X) / CELL));
        const maxC = Math.min(COLS - 1, Math.floor((ball.x + RADIUS - GRID_X) / CELL));
        const minR = Math.max(0, Math.floor((ball.y - RADIUS - GRID_Y) / CELL));
        const maxR = Math.floor((ball.y + RADIUS - GRID_Y) / CELL);
        let collided = false;
        for (let r = minR; r <= maxR && !collided; r++) for (let c = minC; c <= maxC && !collided; c++) {
          const brick = this.bricks.get(r * COLS + c);
          if (!brick) continue;
          const x = GRID_X + c * CELL + 1, y = GRID_Y + r * CELL + 1, size = CELL - 2;
          const nearX = Math.max(x, Math.min(x + size, ball.x)), nearY = Math.max(y, Math.min(y + size, ball.y));
          if ((ball.x - nearX) ** 2 + (ball.y - nearY) ** 2 >= RADIUS ** 2) continue;
          if (oldY + RADIUS <= y && ball.vy > 0) { ball.y = y - RADIUS - 0.01; ball.vy = -Math.abs(ball.vy); }
          else if (oldY - RADIUS >= y + size && ball.vy < 0) { ball.y = y + size + RADIUS + 0.01; ball.vy = Math.abs(ball.vy); }
          else if (oldX + RADIUS <= x && ball.vx > 0) { ball.x = x - RADIUS - 0.01; ball.vx = -Math.abs(ball.vx); }
          else if (oldX - RADIUS >= x + size && ball.vx < 0) { ball.x = x + size + RADIUS + 0.01; ball.vx = Math.abs(ball.vx); }
          else {
            const dx = ball.x - nearX, dy = ball.y - nearY;
            if (Math.abs(dx) > Math.abs(dy)) { ball.x = ball.x < x + size / 2 ? x - RADIUS - 0.01 : x + size + RADIUS + 0.01; ball.vx *= -1; }
            else { ball.y = ball.y < y + size / 2 ? y - RADIUS - 0.01 : y + size + RADIUS + 0.01; ball.vy *= -1; }
          }
          this.hitBrick(brick);
          collided = true;
        }
        if (!this.bricks.size) break;
      }
    }
    this.balls = this.balls.filter(b => b.y < HEIGHT + 12);
    for (const drop of this.drops) {
      const before = drop.y;
      drop.y += 110 * dt;
      if (before <= PADDLE_Y + 10 && drop.y >= PADDLE_Y - 10 && Math.abs(drop.x - this.paddle) < PADDLE_WIDTH / 2 + 9) {
        this.activateSkill(drop.kind);
        drop.y = HEIGHT + 30;
        this.burst(drop.x, PADDLE_Y, drop.kind === 'split' ? '#b3a1ff' : '#ffcf75', 10);
        this.onEvent?.('catch');
      }
    }
    this.drops = this.drops.filter(d => d.y < HEIGHT + 20);
    if (!this.balls.length && this.status === 'playing') {
      this.lives--;
      this.status = this.lives > 0 ? 'ready' : 'lost';
      this.drops = [];
      this.combo = 0;
      this.onEvent?.('life');
    }
  }
}
