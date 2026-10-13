import {
  BASE_COL,
  BASE_ROW,
  COLS,
  FIELD_H,
  FIELD_W,
  ROWS,
  T,
  TILE,
} from "./constants";
import { DIR_X, DIR_Y, type EnemyType, type Game, type PowerType, type Tank } from "./engine";

/* ----------------------------- 配色 ----------------------------- */

const PLAYER_COLORS = ["#7bbf3a", "#8fd44a", "#c8e86a", "#f2e35c"];

const ENEMY_COLORS: Record<EnemyType, string[]> = {
  basic: ["#c9ced6"],
  fast: ["#6fc6f5"],
  power: ["#f08a8a", "#f0b48a"],
  armor: ["#b39ddb", "#9b7bd4", "#7e5cc4", "#5f3fa8"],
};

const POWER_STYLE: Record<PowerType, { color: string; icon: string }> = {
  star: { color: "#ffd53d", icon: "★" },
  shield: { color: "#5ad1ff", icon: "◎" },
  bomb: { color: "#ff6b6b", icon: "✸" },
  life: { color: "#7dff9b", icon: "♥" },
  freeze: { color: "#bfe9ff", icon: "❄" },
  shovel: { color: "#d9a066", icon: "⛏" },
};

/* ----------------------------- 主入口 ----------------------------- */

export function renderGame(ctx: CanvasRenderingContext2D, game: Game, time: number) {
  ctx.save();
  ctx.clearRect(0, 0, FIELD_W, FIELD_H);

  drawBackground(ctx, time);
  drawTiles(ctx, game, time);
  drawBase(ctx, game);
  drawPowerUps(ctx, game, time);
  drawTanks(ctx, game, time);
  drawBullets(ctx, game);
  drawTrees(ctx, game);
  drawExplosions(ctx, game);
  if (game.freezeTimer > 0) drawFrost(ctx, time);

  ctx.restore();
}

/* ----------------------------- 背景 ----------------------------- */

function drawBackground(ctx: CanvasRenderingContext2D, time: number) {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  g.addColorStop(0, "#0b0f14");
  g.addColorStop(1, "#131a22");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * TILE + 0.5, 0);
    ctx.lineTo(c * TILE + 0.5, FIELD_H);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * TILE + 0.5);
    ctx.lineTo(FIELD_W, r * TILE + 0.5);
    ctx.stroke();
  }

  // 轻微扫描线，增强 CRT 质感
  const offset = (time * 30) % 4;
  ctx.fillStyle = "rgba(255,255,255,0.012)";
  for (let y = -offset; y < FIELD_H; y += 4) ctx.fillRect(0, y, FIELD_W, 1);
}

/* ----------------------------- 地形 ----------------------------- */

function drawTiles(ctx: CanvasRenderingContext2D, game: Game, time: number) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = game.grid[r][c];
      const x = c * TILE;
      const y = r * TILE;
      if (tile === T.BRICK) drawBrick(ctx, x, y);
      else if (tile === T.STEEL) drawSteel(ctx, x, y);
      else if (tile === T.WATER) drawWater(ctx, x, y, time, r, c);
    }
  }
}

function drawBrick(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#6d3418";
  ctx.fillRect(x, y, TILE, TILE);
  const bw = TILE / 2;
  const bh = TILE / 4;
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 === 0 ? 0 : bw / 2;
    for (let i = -1; i < 3; i++) {
      const bx = x + i * bw + offset;
      ctx.fillStyle = row % 2 === 0 ? "#b4562a" : "#a94d24";
      const w = Math.min(bw - 2, x + TILE - bx - 1);
      if (w <= 0) continue;
      ctx.fillRect(Math.max(x, bx) + 1, y + row * bh + 1, Math.min(w, bw - 2), bh - 2);
    }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
}

function drawSteel(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const g = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
  g.addColorStop(0, "#c8d2da");
  g.addColorStop(0.5, "#8b969f");
  g.addColorStop(1, "#5c666e");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(x + 3, y + 3, TILE - 6, 3);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x + 3, y + TILE - 6, TILE - 6, 3);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
}

function drawWater(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  r: number,
  c: number,
) {
  const g = ctx.createLinearGradient(x, y, x, y + TILE);
  g.addColorStop(0, "#0d3a63");
  g.addColorStop(1, "#0a2a4a");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = "rgba(120,200,255,0.55)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    const phase = time * 2 + (r + c) * 0.9 + i * 1.6;
    const yy = y + 10 + i * 12 + Math.sin(phase) * 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, yy);
    ctx.quadraticCurveTo(x + TILE / 2, yy - 3, x + TILE - 4, yy);
    ctx.stroke();
  }
}

function drawTrees(ctx: CanvasRenderingContext2D, game: Game) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (game.grid[r][c] !== T.TREE) continue;
      const x = c * TILE;
      const y = r * TILE;
      ctx.fillStyle = "#12351c";
      ctx.fillRect(x, y, TILE, TILE);
      const blobs: [number, number, number][] = [
        [10, 10, 9],
        [22, 12, 8],
        [14, 22, 10],
        [25, 24, 7],
      ];
      for (const [bx, by, br] of blobs) {
        ctx.beginPath();
        ctx.arc(x + bx, y + by, br, 0, Math.PI * 2);
        ctx.fillStyle = "#2c7a3f";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + bx - 2, y + by - 2, br * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = "#3f9c52";
        ctx.fill();
      }
    }
  }
}

/* ----------------------------- 基地 ----------------------------- */

function drawBase(ctx: CanvasRenderingContext2D, game: Game) {
  const x = BASE_COL * TILE;
  const y = BASE_ROW * TILE;
  ctx.fillStyle = "#1b1f25";
  ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);

  if (!game.baseAlive) {
    ctx.fillStyle = "#4a4a4a";
    ctx.beginPath();
    ctx.moveTo(x + 6, y + TILE - 6);
    ctx.lineTo(x + 11, y + 12);
    ctx.lineTo(x + 16, y + 20);
    ctx.lineTo(x + 21, y + 11);
    ctx.lineTo(x + 26, y + TILE - 6);
    ctx.closePath();
    ctx.fill();
    return;
  }

  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  // 鹰的翅膀
  ctx.fillStyle = "#e8c34a";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx + 10, cy + 2);
  ctx.lineTo(cx + 4, cy + 9);
  ctx.lineTo(cx, cy + 4);
  ctx.lineTo(cx - 4, cy + 9);
  ctx.lineTo(cx - 10, cy + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff1a8";
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8a6a12";
  ctx.lineWidth = 1;
  ctx.stroke();
}

/* ----------------------------- 坦克 ----------------------------- */

function drawTanks(ctx: CanvasRenderingContext2D, game: Game, time: number) {
  for (const t of game.tanks) {
    if (!t.alive) continue;
    if (t.spawning > 0) {
      drawSpawn(ctx, t, time);
      continue;
    }
    drawTank(ctx, t, time, game.playerLevel);
    if (t.kind === "player" && t.shield > 0) drawShield(ctx, t, time);
  }
}

function drawSpawn(ctx: CanvasRenderingContext2D, t: Tank, time: number) {
  const cx = t.x + t.size / 2;
  const cy = t.y + t.size / 2;
  const progress = 1 - t.spawning;
  const r = t.size * (0.3 + progress * 0.9);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time * 8);
  ctx.strokeStyle = `rgba(160,220,255,${0.5 + 0.5 * Math.sin(time * 20)})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos((i * Math.PI) / 2) * r, Math.sin((i * Math.PI) / 2) * r);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTank(
  ctx: CanvasRenderingContext2D,
  t: Tank,
  time: number,
  playerLevel: number,
) {
  let body: string;
  if (t.kind === "player") {
    body = PLAYER_COLORS[Math.min(playerLevel, PLAYER_COLORS.length - 1)];
  } else {
    const list = ENEMY_COLORS[t.enemyType];
    const idx = t.maxHp > 1 ? Math.min(list.length - 1, t.maxHp - t.hp) : 0;
    body = list[idx];
    if (t.bonus && Math.floor(time * 7) % 2 === 0) body = "#ff5d5d";
  }

  const s = t.size;
  const h = s / 2;
  const dark = shade(body, -0.35);
  const light = shade(body, 0.35);

  ctx.save();
  ctx.translate(t.x + h, t.y + h);
  ctx.rotate((t.dir * Math.PI) / 2);

  // 履带
  ctx.fillStyle = dark;
  ctx.fillRect(-h, -h, s * 0.26, s);
  ctx.fillRect(h - s * 0.26, -h, s * 0.26, s);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  const treadOffset = Math.floor(time * 60) % 4;
  for (let i = 0; i < 7; i++) {
    const yy = -h + ((i * s) / 7 + treadOffset) % s;
    ctx.fillRect(-h + 1, yy, s * 0.24, 1.5);
    ctx.fillRect(h - s * 0.24 - 1, yy, s * 0.24, 1.5);
  }

  // 车身
  const g = ctx.createLinearGradient(-h, -h, h, h);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(-h + s * 0.22, -h + s * 0.1, s * 0.56, s * 0.8);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(-h + s * 0.22, -h + s * 0.1, s * 0.56, s * 0.8);

  // 炮塔
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.19, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.stroke();

  // 炮管
  ctx.fillStyle = "#20262c";
  ctx.fillRect(-s * 0.07, -h - s * 0.16, s * 0.14, s * 0.5);
  ctx.fillStyle = light;
  ctx.fillRect(-s * 0.05, -h - s * 0.16, s * 0.1, s * 0.12);

  ctx.restore();
}

function drawShield(ctx: CanvasRenderingContext2D, t: Tank, time: number) {
  const cx = t.x + t.size / 2;
  const cy = t.y + t.size / 2;
  const r = t.size * 0.85;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time * 3);
  ctx.strokeStyle = `rgba(110,220,255,${0.55 + 0.35 * Math.sin(time * 12)})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, r, (i * Math.PI) / 3, (i * Math.PI) / 3 + Math.PI / 4);
    ctx.stroke();
  }
  ctx.restore();
}

/* ----------------------------- 子弹 ----------------------------- */

function drawBullets(ctx: CanvasRenderingContext2D, game: Game) {
  for (const b of game.bullets) {
    if (!b.alive) continue;
    const cx = b.x + b.size / 2;
    const cy = b.y + b.size / 2;
    const color = b.owner === "player" ? "#ffe680" : "#ff9d6b";
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    const long = b.size * 1.5;
    const w = DIR_X[b.dir] !== 0 ? long : b.size;
    const h = DIR_Y[b.dir] !== 0 ? long : b.size;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 3);
    ctx.fill();
    ctx.restore();
  }
}

/* ----------------------------- 道具 ----------------------------- */

function drawPowerUps(ctx: CanvasRenderingContext2D, game: Game, time: number) {
  for (const pu of game.powerups) {
    if (pu.life < 4 && Math.floor(time * 8) % 2 === 0) continue;
    const style = POWER_STYLE[pu.type];
    const cx = pu.x + pu.size / 2;
    const cy = pu.y + pu.size / 2;
    const pulse = 1 + Math.sin(time * 6) * 0.06;
    const size = pu.size * pulse;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = style.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = "rgba(10,14,18,0.9)";
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, 6);
    ctx.fill();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = style.color;
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.icon, 0, 1);
    ctx.restore();
  }
}

/* ----------------------------- 爆炸 ----------------------------- */

function drawExplosions(ctx: CanvasRenderingContext2D, game: Game) {
  for (const e of game.explosions) {
    const p = e.t / e.duration;
    const r = e.size * (0.35 + p * 0.75);
    const alpha = 1 - p;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, r);
    g.addColorStop(0, `rgba(255,250,220,${alpha})`);
    g.addColorStop(0.35, `rgba(255,190,80,${alpha * 0.9})`);
    g.addColorStop(0.7, `rgba(255,110,40,${alpha * 0.6})`);
    g.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();

    if (e.big) {
      ctx.strokeStyle = `rgba(255,220,150,${alpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ----------------------------- 冰冻特效 ----------------------------- */

function drawFrost(ctx: CanvasRenderingContext2D, time: number) {
  ctx.save();
  ctx.fillStyle = "rgba(120,200,255,0.07)";
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.fillStyle = "rgba(200,235,255,0.7)";
  for (let i = 0; i < 26; i++) {
    const seed = i * 97.13;
    const x = (seed * 7.3 + time * 18) % FIELD_W;
    const y = (seed * 13.7 + time * 26) % FIELD_H;
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ----------------------------- 颜色工具 ----------------------------- */

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  if (amount >= 0) {
    r += (255 - r) * amount;
    g += (255 - g) * amount;
    b += (255 - b) * amount;
  } else {
    r *= 1 + amount;
    g *= 1 + amount;
    b *= 1 + amount;
  }
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) + (to(r) << 16) + (to(g) << 8) + to(b)).toString(16).slice(1)}`;
}
