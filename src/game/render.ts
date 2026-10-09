import { CELL, GRID_X, GRID_Y, HEIGHT, WIDTH } from './levels';
import { Engine, PADDLE_WIDTH, PADDLE_Y } from './engine';

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
export function render(ctx: CanvasRenderingContext2D, game: Engine, width: number, height: number) {
  ctx.setTransform(width / WIDTH, 0, 0, height / HEIGHT, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#0b1428';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = ctx.createRadialGradient(210, 140, 0, 210, 140, 360);
  glow.addColorStop(0, '#152235'); glow.addColorStop(1, '#0b1428');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#21304a';
  for (let x = 20; x < WIDTH; x += 20) for (let y = 20; y < HEIGHT; y += 20) { ctx.globalAlpha = 0.38; ctx.fillRect(x, y, 1, 1); }
  ctx.globalAlpha = 1;
  ctx.save();
  if (game.shake) ctx.translate(Math.sin(game.elapsed * 80) * game.shake, Math.cos(game.elapsed * 60) * game.shake * 0.4);
  // Permanent rails differ from the destructible grey tiles.
  ctx.strokeStyle = '#28364f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(12, HEIGHT - 26); ctx.lineTo(12, 12); ctx.lineTo(WIDTH - 12, 12); ctx.lineTo(WIDTH - 12, HEIGHT - 26); ctx.stroke();
  ctx.fillStyle = '#556888';
  for (const x of [12, WIDTH - 12]) { ctx.fillRect(x - 1, 24, 2, 16); ctx.fillRect(x - 1, HEIGHT - 72, 2, 16); }
  for (const b of game.bricks.values()) {
    const x = GRID_X + b.col * CELL + 1, y = GRID_Y + b.row * CELL + 1;
    const green = b.maxHp === 1;
    ctx.fillStyle = b.flash > 0 ? '#f2ffd5' : green ? ['#9beb60', '#87d54f', '#b0f471'][(b.col * 3 + b.row) % 3] : ['#4b566b', '#5c6880', '#707c93', '#8590a4', '#9ba6b8'][Math.ceil(b.hp / 2) - 1];
    rounded(ctx, x, y, CELL - 2, CELL - 2, 2);
    ctx.fillStyle = green ? '#d4ffae' : '#d1d8e5'; ctx.globalAlpha = 0.25; ctx.fillRect(x + 2, y + 1, CELL - 6, 1); ctx.globalAlpha = 1;
    if (!green && b.hp < 9) {
      ctx.strokeStyle = '#273247'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 5, y); ctx.lineTo(x + 3, y + 3); ctx.lineTo(x + 5, y + 5); ctx.lineTo(x + 3, y + CELL - 2);
      if (b.hp <= 4) { ctx.moveTo(x + 3, y + 3); ctx.lineTo(x, y + 5); }
      ctx.stroke();
    }
  }
  for (const b of game.balls) {
    b.trail.forEach((p, i) => { ctx.globalAlpha = (1 - i / 10) * 0.22; ctx.fillStyle = '#d8e6ff'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.7, 2.6 - i * 0.18), 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.shadowColor = '#bfe9ff'; ctx.shadowBlur = game.balls.length < 32 ? 10 : 0;
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
  for (const d of game.drops) {
    ctx.fillStyle = d.kind === 'split' ? '#ab94ff' : '#ffd071'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
    rounded(ctx, d.x - 9, d.y - 9, 18, 18, 5); ctx.shadowBlur = 0;
    ctx.fillStyle = d.kind === 'split' ? '#000' : '#10182a';
    const dots = d.kind === 'split' ? [[0, -4], [-4, 3], [4, 3]] : [[-4, 0], [0, 0], [4, 0]];
    for (const [x, y] of dots) { ctx.beginPath(); ctx.arc(d.x + x, d.y + y, 1.5, 0, Math.PI * 2); ctx.fill(); }
  }
  for (const p of game.particles) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
  ctx.globalAlpha = 1;
  const paddleX = game.paddle - PADDLE_WIDTH / 2;
  ctx.save();
  ctx.fillStyle = '#403464'; rounded(ctx, paddleX, PADDLE_Y + 3, PADDLE_WIDTH, 8, 4);
  const body = ctx.createLinearGradient(0, PADDLE_Y, 0, PADDLE_Y + 9);
  body.addColorStop(0, '#d3c9ff'); body.addColorStop(0.4, '#a797ea'); body.addColorStop(1, '#7763c0');
  ctx.fillStyle = body; ctx.shadowColor = '#bbaaff45'; ctx.shadowBlur = 5;
  rounded(ctx, paddleX, PADDLE_Y, PADDLE_WIDTH, 9, 4.5); ctx.shadowBlur = 0;
  const shine = ctx.createLinearGradient(paddleX, 0, paddleX + PADDLE_WIDTH, 0);
  shine.addColorStop(0, '#ffffff00'); shine.addColorStop(0.25, '#f2edff90'); shine.addColorStop(0.5, '#ffffffdc'); shine.addColorStop(0.75, '#f2edff90'); shine.addColorStop(1, '#ffffff00');
  ctx.fillStyle = shine; rounded(ctx, paddleX + 4, PADDLE_Y + 1, PADDLE_WIDTH - 8, 1, 0.5);
  ctx.fillStyle = '#e8dfff'; rounded(ctx, paddleX + 3, PADDLE_Y + 3, 2, 3, 1); rounded(ctx, paddleX + PADDLE_WIDTH - 5, PADDLE_Y + 3, 2, 3, 1);
  ctx.restore();
  if (game.status === 'ready') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(game.paddle, PADDLE_Y - 10, 3.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
