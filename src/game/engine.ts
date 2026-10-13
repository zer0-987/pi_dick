import {
  BASE_COL,
  BASE_ROW,
  BULLET_SIZE,
  COLS,
  ENEMIES_PER_LEVEL,
  ENEMY_SPAWN_COLS,
  FIELD_H,
  FIELD_W,
  MAX_ENEMIES_ON_FIELD,
  PLAYER_SPAWN_COL,
  ROWS,
  START_LIVES,
  T,
  TANK_SIZE,
  TILE,
} from "./constants";
import { LEVEL_COUNT, parseLevel } from "./levels";
import { Sfx, type SoundName } from "./sound";

/* ------------------------------------------------------------------ */
/* 类型                                                                */
/* ------------------------------------------------------------------ */

export type Dir = 0 | 1 | 2 | 3; // 上 右 下 左
export const DIR_X = [0, 1, 0, -1];
export const DIR_Y = [-1, 0, 1, 0];

export type GameState =
  | "ready"
  | "playing"
  | "paused"
  | "levelclear"
  | "gameover"
  | "victory";

export type EnemyType = "basic" | "fast" | "power" | "armor";
export type PowerType = "star" | "shield" | "bomb" | "life" | "freeze" | "shovel";
export type Action = "up" | "down" | "left" | "right" | "fire";

interface AI {
  moveTimer: number;
  fireTimer: number;
  aggression: number;
}

export interface Tank {
  id: number;
  kind: "player" | "enemy";
  x: number;
  y: number;
  size: number;
  dir: Dir;
  speed: number;
  fireRate: number;
  cooldown: number;
  bulletSpeed: number;
  bulletPower: number;
  maxBullets: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  shield: number;
  spawning: number;
  bonus: boolean;
  enemyType: EnemyType;
  ai: AI;
}

export interface Bullet {
  x: number;
  y: number;
  size: number;
  dir: Dir;
  speed: number;
  owner: "player" | "enemy";
  tankId: number;
  power: number;
  alive: boolean;
}

export interface Explosion {
  x: number;
  y: number;
  size: number;
  t: number;
  duration: number;
  big: boolean;
}

export interface PowerUp {
  x: number;
  y: number;
  size: number;
  type: PowerType;
  t: number;
  life: number;
}

export interface Stats {
  state: GameState;
  score: number;
  highScore: number;
  lives: number;
  level: number;
  levelCount: number;
  enemiesLeft: number;
  enemiesTotal: number;
  playerLevel: number;
  muted: boolean;
}

/* ------------------------------------------------------------------ */
/* 敌人属性 & 计分                                                     */
/* ------------------------------------------------------------------ */

const ENEMY_CONFIG: Record<
  EnemyType,
  { speed: number; hp: number; fireRate: number; bulletSpeed: number; color: string; score: number }
> = {
  basic: { speed: 62, hp: 1, fireRate: 1.7, bulletSpeed: 210, color: "#d8dbe0", score: 100 },
  fast: { speed: 124, hp: 1, fireRate: 1.8, bulletSpeed: 230, color: "#7dd3fc", score: 200 },
  power: { speed: 74, hp: 2, fireRate: 0.95, bulletSpeed: 330, color: "#fca5a5", score: 300 },
  armor: { speed: 66, hp: 4, fireRate: 1.25, bulletSpeed: 250, color: "#a78bfa", score: 400 },
};

/** 每一关中哪些序号的敌人是「闪光兵」（被击毁后掉落道具） */
const BONUS_INDEXES = new Set([3, 10, 14]);

const POWER_TYPES: PowerType[] = ["star", "shield", "bomb", "life", "freeze", "shovel"];

/* ------------------------------------------------------------------ */
/* 主引擎                                                              */
/* ------------------------------------------------------------------ */

export class Game {
  grid: number[][] = [];
  tanks: Tank[] = [];
  bullets: Bullet[] = [];
  explosions: Explosion[] = [];
  powerups: PowerUp[] = [];

  player: Tank | null = null;
  state: GameState = "ready";

  score = 0;
  highScore = 0;
  lives = START_LIVES;
  level = 0;
  playerLevel = 0;

  enemiesSpawned = 0;
  enemiesKilled = 0;
  spawnTimer = 0;
  freezeTimer = 0;
  shovelTimer = 0;
  baseAlive = true;
  gameOverTimer = -1;
  levelClearTimer = -1;
  respawnTimer = -1;
  time = 0;

  sfx = new Sfx();
  private nextId = 1;
  private input: Record<Action, boolean> = {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
  };
  private dirStack: Action[] = [];
  private onSound?: (name: SoundName) => void;

  constructor() {
    if (typeof window !== "undefined") {
      this.highScore = Number(window.localStorage.getItem("tank-high-score") ?? 0) || 0;
    }
    this.loadLevel(0);
  }

  /* --------------------------- 关卡初始化 --------------------------- */

  loadLevel(index: number, autoStart = false) {
    this.level = index;
    this.grid = parseLevel(index);
    this.tanks = [];
    this.bullets = [];
    this.explosions = [];
    this.powerups = [];
    this.player = null;
    this.enemiesSpawned = 0;
    this.enemiesKilled = 0;
    this.spawnTimer = 1.2;
    this.freezeTimer = 0;
    this.shovelTimer = 0;
    this.baseAlive = true;
    this.gameOverTimer = -1;
    this.levelClearTimer = -1;
    this.respawnTimer = -1;
    this.playerLevel = 0;

    this.grid[BASE_ROW][BASE_COL] = T.BASE;
    this.placeBaseWalls(T.BRICK);
    this.spawnPlayer();
    this.state = autoStart ? "playing" : "ready";
  }

  restart() {
    this.score = 0;
    this.lives = START_LIVES;
    this.loadLevel(0);
  }

  private placeBaseWalls(tile: number) {
    const spots: [number, number][] = [
      [BASE_ROW - 1, BASE_COL - 1],
      [BASE_ROW - 1, BASE_COL],
      [BASE_ROW - 1, BASE_COL + 1],
      [BASE_ROW, BASE_COL - 1],
      [BASE_ROW, BASE_COL + 1],
    ];
    for (const [r, c] of spots) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) this.grid[r][c] = tile;
    }
  }

  private spawnPlayer() {
    const x = PLAYER_SPAWN_COL * TILE + (TILE - TANK_SIZE) / 2;
    const y = (ROWS - 1) * TILE + (TILE - TANK_SIZE) / 2;
    const tank: Tank = {
      id: this.nextId++,
      kind: "player",
      x,
      y,
      size: TANK_SIZE,
      dir: 0,
      speed: 145,
      fireRate: 0.32,
      cooldown: 0,
      bulletSpeed: 330,
      bulletPower: 1,
      maxBullets: 1,
      hp: 1,
      maxHp: 1,
      alive: true,
      shield: 2.5,
      spawning: 0.6,
      bonus: false,
      enemyType: "basic",
      ai: { moveTimer: 0, fireTimer: 0, aggression: 0 },
    };
    this.applyPlayerLevel(tank);
    this.tanks.push(tank);
    this.player = tank;
  }

  private applyPlayerLevel(t: Tank) {
    t.maxBullets = this.playerLevel >= 1 ? 2 : 1;
    t.bulletPower = this.playerLevel >= 2 ? 2 : 1;
    t.bulletSpeed = 330 + this.playerLevel * 55;
    t.fireRate = Math.max(0.22, 0.32 - this.playerLevel * 0.03);
  }

  /** 玩家复活 */
  private revivePlayer() {
    const x = PLAYER_SPAWN_COL * TILE + (TILE - TANK_SIZE) / 2;
    const y = (ROWS - 1) * TILE + (TILE - TANK_SIZE) / 2;
    const old = this.player;
    const tank: Tank = {
      id: this.nextId++,
      kind: "player",
      x,
      y,
      size: TANK_SIZE,
      dir: 0,
      speed: 145,
      fireRate: 0.32,
      cooldown: 0,
      bulletSpeed: 330,
      bulletPower: 1,
      maxBullets: 1,
      hp: 1,
      maxHp: 1,
      alive: true,
      shield: 3,
      spawning: 0.6,
      bonus: false,
      enemyType: "basic",
      ai: { moveTimer: 0, fireTimer: 0, aggression: 0 },
    };
    this.applyPlayerLevel(tank);
    if (old) old.alive = false;
    this.tanks.push(tank);
    this.player = tank;
  }

  private spawnEnemy() {
    if (this.enemiesSpawned >= ENEMIES_PER_LEVEL) return;
    const onField = this.tanks.filter((t) => t.kind === "enemy" && t.alive).length;
    if (onField >= MAX_ENEMIES_ON_FIELD) return;

    const col = ENEMY_SPAWN_COLS[this.enemiesSpawned % ENEMY_SPAWN_COLS.length];
    const x = col * TILE + (TILE - TANK_SIZE) / 2;
    const y = (TILE - TANK_SIZE) / 2;

    // 出生点被占用则稍后再试
    if (this.tanks.some((t) => t.alive && this.overlap(x, y, TANK_SIZE, TANK_SIZE, t))) return;

    const roll = Math.random();
    let type: EnemyType;
    if (this.level === 0) type = roll < 0.7 ? "basic" : roll < 0.9 ? "fast" : "power";
    else if (this.level === 1) type = roll < 0.4 ? "basic" : roll < 0.65 ? "fast" : roll < 0.85 ? "power" : "armor";
    else type = roll < 0.25 ? "basic" : roll < 0.5 ? "fast" : roll < 0.78 ? "power" : "armor";

    const cfg = ENEMY_CONFIG[type];
    const tank: Tank = {
      id: this.nextId++,
      kind: "enemy",
      x,
      y,
      size: TANK_SIZE,
      dir: 2,
      speed: cfg.speed * (1 + this.level * 0.06),
      fireRate: cfg.fireRate,
      cooldown: 0.6,
      bulletSpeed: cfg.bulletSpeed,
      bulletPower: 1,
      maxBullets: type === "power" ? 2 : 1,
      hp: cfg.hp,
      maxHp: cfg.hp,
      alive: true,
      shield: 0,
      spawning: 0.9,
      bonus: BONUS_INDEXES.has(this.enemiesSpawned),
      enemyType: type,
      ai: {
        moveTimer: 0,
        fireTimer: 0.8 + Math.random() * 0.8,
        aggression: 0.22 + this.level * 0.1,
      },
    };
    this.tanks.push(tank);
    this.enemiesSpawned++;
  }

  /* --------------------------- 输入 --------------------------- */

  setKey(action: Action, pressed: boolean) {
    if (pressed && action !== "fire" && !this.input[action]) {
      this.dirStack = this.dirStack.filter((a) => a !== action);
      this.dirStack.push(action);
    }
    if (!pressed) this.dirStack = this.dirStack.filter((a) => a !== action);
    this.input[action] = pressed;
  }

  releaseAllKeys() {
    this.input.up = this.input.down = this.input.left = this.input.right = this.input.fire = false;
    this.dirStack = [];
  }

  private currentAction(): Action | null {
    return this.dirStack.length ? this.dirStack[this.dirStack.length - 1] : null;
  }

  /* --------------------------- 主循环 --------------------------- */

  step(dt: number) {
    this.time += dt;
    this.updateExplosions(dt);

    if (this.state === "levelclear") {
      this.levelClearTimer -= dt;
      if (this.levelClearTimer <= 0) {
        const next = this.level + 1;
        if (next >= LEVEL_COUNT) {
          this.state = "victory";
          this.saveHighScore();
        } else {
          this.loadLevel(next, true);
        }
      }
      return;
    }

    if (this.state !== "playing") return;

    this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    if (this.shovelTimer > 0) {
      this.shovelTimer -= dt;
      if (this.shovelTimer <= 0) this.placeBaseWalls(T.BRICK);
    }

    if (this.gameOverTimer >= 0) {
      this.gameOverTimer -= dt;
      if (this.gameOverTimer <= 0) {
        this.state = "gameover";
        this.saveHighScore();
        this.playSound("gameover");
      }
      return;
    }

    // 玩家复活倒计时
    if (this.respawnTimer >= 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawnTimer = -1;
        if (this.lives >= 0) this.revivePlayer();
        else {
          this.state = "gameover";
          this.saveHighScore();
        }
      }
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);

    for (const t of this.tanks) {
      if (t.cooldown > 0) t.cooldown -= dt;
      if (t.shield > 0) t.shield -= dt;
      if (t.spawning > 0) t.spawning -= dt;
    }

    this.updateBullets(dt);
    this.updatePowerUps(dt);

    // 敌人出场
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(1.1, 3.2 - this.level * 0.4);
      this.spawnEnemy();
    }

    this.tanks = this.tanks.filter((t) => t.alive);

    // 过关判定
    if (
      this.enemiesSpawned >= ENEMIES_PER_LEVEL &&
      this.tanks.every((t) => t.kind !== "enemy" || !t.alive) &&
      this.baseAlive
    ) {
      this.state = "levelclear";
      this.levelClearTimer = 2.4;
      this.playSound("levelup");
    }

  }

  /* --------------------------- 玩家 --------------------------- */

  private updatePlayer(dt: number) {
    const p = this.player;
    if (!p || !p.alive || p.spawning > 0) return;

    const action = this.currentAction();
    if (action && action !== "fire") {
      const dir = ({ up: 0, right: 1, down: 2, left: 3 } as const)[action] as Dir;
      if (p.dir !== dir) {
        p.dir = dir;
        this.snapTank(p);
      }
      this.moveTank(p, p.speed * dt);
    }
    if (inputFire(this.input)) this.fire(p);
  }

  /* --------------------------- 敌人 AI --------------------------- */

  private updateEnemies(dt: number) {
    for (const e of this.tanks) {
      if (e.kind !== "enemy" || !e.alive || e.spawning > 0) continue;
      if (this.freezeTimer > 0) continue;

      e.ai.moveTimer -= dt;
      e.ai.fireTimer -= dt;

      if (e.ai.moveTimer <= 0) {
        this.chooseEnemyDir(e);
        e.ai.moveTimer = 0.5 + Math.random() * 1.6;
      }

      const moved = this.moveTank(e, e.speed * dt);
      if (!moved) {
        this.chooseEnemyDir(e);
        e.ai.moveTimer = 0.25 + Math.random() * 0.6;
      }

      // 与玩家/基地对齐时优先开火
      const target = this.alignedTarget(e);
      if (target && e.cooldown <= 0) {
        this.fire(e);
        e.ai.fireTimer = e.fireRate;
      } else if (e.ai.fireTimer <= 0) {
        this.fire(e);
        e.ai.fireTimer = e.fireRate * (0.6 + Math.random() * 1.2);
      }
    }
  }

  private chooseEnemyDir(e: Tank) {
    const roll = Math.random();
    if (roll > e.ai.aggression) {
      e.dir = Math.floor(Math.random() * 4) as Dir;
      return;
    }
    // 追逐玩家或基地（更倾向追击玩家）
    const cx = e.x + e.size / 2;
    const cy = e.y + e.size / 2;
    let tx = BASE_COL * TILE + TILE / 2;
    let ty = BASE_ROW * TILE + TILE / 2;
    if (this.player?.alive && Math.random() < 0.7) {
      tx = this.player.x + this.player.size / 2;
      ty = this.player.y + this.player.size / 2;
    }
    const dx = tx - cx;
    const dy = ty - cy;
    const preferX = Math.abs(dx) > Math.abs(dy);
    e.dir = preferX ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
  }

  private alignedTarget(e: Tank): Tank | null {
    const candidates: Tank[] = [];
    if (this.player?.alive) candidates.push(this.player);
    const base = this.baseRect();
    const cx = e.x + e.size / 2;
    const cy = e.y + e.size / 2;
    const tolerance = TILE * 0.6;

    for (const c of candidates) {
      const tx = c.x + c.size / 2;
      const ty = c.y + c.size / 2;
      if (e.dir === 0 && Math.abs(tx - cx) < tolerance && ty < cy) return c;
      if (e.dir === 2 && Math.abs(tx - cx) < tolerance && ty > cy) return c;
      if (e.dir === 3 && Math.abs(ty - cy) < tolerance && tx < cx) return c;
      if (e.dir === 1 && Math.abs(ty - cy) < tolerance && tx > cx) return c;
    }
    if (this.baseAlive) {
      const bx = base.x + base.w / 2;
      const by = base.y + base.h / 2;
      if (e.dir === 0 && Math.abs(bx - cx) < tolerance && by < cy) return e;
      if (e.dir === 2 && Math.abs(bx - cx) < tolerance && by > cy) return e;
      if (e.dir === 3 && Math.abs(by - cy) < tolerance && bx < cx) return e;
      if (e.dir === 1 && Math.abs(by - cy) < tolerance && bx > cx) return e;
    }
    return null;
  }

  /* --------------------------- 移动与碰撞 --------------------------- */

  private blocksTank(r: number, c: number): boolean {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
    const tile = this.grid[r][c];
    return tile === T.BRICK || tile === T.STEEL || tile === T.WATER || tile === T.BASE;
  }

  private canPlace(t: Tank, x: number, y: number): boolean {
    if (x < 0 || y < 0 || x + t.size > FIELD_W || y + t.size > FIELD_H) return false;
    const c0 = Math.floor(x / TILE);
    const c1 = Math.floor((x + t.size - 0.01) / TILE);
    const r0 = Math.floor(y / TILE);
    const r1 = Math.floor((y + t.size - 0.01) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.blocksTank(r, c)) return false;
      }
    }
    for (const o of this.tanks) {
      if (o === t || !o.alive) continue;
      if (
        x < o.x + o.size &&
        x + t.size > o.x &&
        y < o.y + o.size &&
        y + t.size > o.y
      ) {
        return false;
      }
    }
    return true;
  }

  /** 沿当前朝向移动，被挡住时自动向格子中线对齐（避免卡墙） */
  private moveTank(t: Tank, dist: number): boolean {
    const dx = DIR_X[t.dir] * dist;
    const dy = DIR_Y[t.dir] * dist;
    if (this.canPlace(t, t.x + dx, t.y + dy)) {
      t.x += dx;
      t.y += dy;
      return true;
    }
    const axis = dx !== 0 ? "y" : "x";
    const cur = axis === "y" ? t.y + t.size / 2 : t.x + t.size / 2;
    const target = Math.round((cur - TILE / 2) / TILE) * TILE + TILE / 2;
    const diff = target - cur;
    if (Math.abs(diff) > 0.5) {
      const s = Math.sign(diff) * Math.min(Math.abs(diff), dist);
      const nx = axis === "x" ? t.x + s : t.x;
      const ny = axis === "y" ? t.y + s : t.y;
      if (this.canPlace(t, nx, ny)) {
        t.x = nx;
        t.y = ny;
        return true;
      }
    }
    return false;
  }

  /** 转向时把垂直方向吸附到最近的格子中线 */
  private snapTank(t: Tank) {
    const vertical = DIR_X[t.dir] === 0;
    const cur = vertical ? t.x + t.size / 2 : t.y + t.size / 2;
    const target = Math.round((cur - TILE / 2) / TILE) * TILE + TILE / 2;
    if (Math.abs(target - cur) > TILE * 0.35) return;
    const nx = vertical ? target - t.size / 2 : t.x;
    const ny = vertical ? t.y : target - t.size / 2;
    if (this.canPlace(t, nx, ny)) {
      t.x = nx;
      t.y = ny;
    }
  }

  private overlap(
    x: number,
    y: number,
    w: number,
    h: number,
    t: { x: number; y: number; size: number },
  ): boolean {
    return x < t.x + t.size && x + w > t.x && y < t.y + t.size && y + h > t.y;
  }

  baseRect() {
    return {
      x: BASE_COL * TILE + 3,
      y: BASE_ROW * TILE + 3,
      w: TILE - 6,
      h: TILE - 6,
    };
  }

  /* --------------------------- 开火 --------------------------- */

  private fire(t: Tank) {
    if (t.cooldown > 0 || t.spawning > 0 || !t.alive) return;
    const active = this.bullets.filter((b) => b.tankId === t.id).length;
    if (active >= t.maxBullets) return;

    t.cooldown = t.fireRate;
    const cx = t.x + t.size / 2 + DIR_X[t.dir] * (t.size / 2 + 3);
    const cy = t.y + t.size / 2 + DIR_Y[t.dir] * (t.size / 2 + 3);
    this.bullets.push({
      x: cx - BULLET_SIZE / 2,
      y: cy - BULLET_SIZE / 2,
      size: BULLET_SIZE,
      dir: t.dir,
      speed: t.bulletSpeed,
      owner: t.kind,
      tankId: t.id,
      power: t.bulletPower,
      alive: true,
    });
    this.playSound(t.kind === "player" ? "shoot" : "enemyShoot");
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      // 分步推进，避免高速穿透薄墙
      const total = b.speed * dt;
      const steps = Math.max(1, Math.ceil(total / (BULLET_SIZE * 0.9)));
      for (let i = 0; i < steps && b.alive; i++) {
        b.x += (DIR_X[b.dir] * total) / steps;
        b.y += (DIR_Y[b.dir] * total) / steps;
        this.resolveBullet(b);
      }
    }
    this.bullets = this.bullets.filter((b) => b.alive);
  }

  private resolveBullet(b: Bullet) {
    // 出界
    if (
      b.x < -b.size ||
      b.y < -b.size ||
      b.x > FIELD_W + b.size ||
      b.y > FIELD_H + b.size
    ) {
      b.alive = false;
      this.addExplosion(b.x, b.y, 10, false);
      return;
    }

    if (this.bulletVsTiles(b)) return;
    if (this.bulletVsBase(b)) return;
    if (this.bulletVsTanks(b)) return;
    this.bulletVsBullets(b);
  }

  private bulletVsTiles(b: Bullet): boolean {
    const c0 = Math.max(0, Math.floor(b.x / TILE));
    const c1 = Math.min(COLS - 1, Math.floor((b.x + b.size - 0.01) / TILE));
    const r0 = Math.max(0, Math.floor(b.y / TILE));
    const r1 = Math.min(ROWS - 1, Math.floor((b.y + b.size - 0.01) / TILE));
    let hit = false;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const tile = this.grid[r][c];
        if (tile === T.BRICK) {
          this.grid[r][c] = T.EMPTY;
          hit = true;
        } else if (tile === T.STEEL) {
          if (b.power >= 2) this.grid[r][c] = T.EMPTY;
          hit = true;
        }
      }
    }
    if (hit) {
      b.alive = false;
      this.addExplosion(b.x, b.y, 14, false);
      this.playSound("hit");
    }
    return hit;
  }

  private bulletVsBase(b: Bullet): boolean {
    // 只有敌方子弹可以摧毁基地（避免误伤自己老鹰的挫败感）
    if (!this.baseAlive || b.owner === "player") return false;
    const base = this.baseRect();
    if (this.overlap(b.x, b.y, b.size, b.size, { x: base.x, y: base.y, size: base.w })) {
      b.alive = false;
      this.destroyBase();
      return true;
    }
    return false;
  }

  private bulletVsTanks(b: Bullet): boolean {
    for (const t of this.tanks) {
      if (!t.alive || t.spawning > 0) continue;
      if (b.owner === "player" && t.kind === "player") continue;
      if (b.owner === "enemy" && t.kind === "enemy") continue;
      if (t.id === b.tankId) continue;
      if (!this.overlap(b.x, b.y, b.size, b.size, t)) continue;

      b.alive = false;
      if (t.kind === "player") {
        if (t.shield > 0) {
          this.addExplosion(b.x, b.y, 16, false);
          this.playSound("hit");
          return true;
        }
        this.killPlayer();
        return true;
      }

      // 敌人
      t.hp -= 1;
      if (t.hp <= 0) {
        this.killEnemy(t);
      } else {
        this.addExplosion(b.x, b.y, 16, false);
        this.playSound("hit");
      }
      return true;
    }
    return false;
  }

  private bulletVsBullets(b: Bullet) {
    for (const o of this.bullets) {
      if (!o.alive || o === b || o.owner === b.owner) continue;
      if (!this.overlap(b.x, b.y, b.size, b.size, { x: o.x, y: o.y, size: o.size })) continue;
      o.alive = false;
      b.alive = false;
      this.addExplosion(b.x, b.y, 12, false);
      return;
    }
  }

  /* --------------------------- 死亡 / 计分 --------------------------- */

  private killPlayer() {
    const p = this.player;
    if (!p) return;
    p.alive = false;
    this.addExplosion(p.x + p.size / 2, p.y + p.size / 2, 34, true);
    this.playSound("explode");
    this.lives -= 1;
    if (this.lives >= 0) {
      this.respawnTimer = 1.4;
    } else {
      this.gameOverTimer = 1.2;
    }
    this.saveHighScore();
  }

  private killEnemy(t: Tank) {
    t.alive = false;
    const cfg = ENEMY_CONFIG[t.enemyType];
    this.score += cfg.score + (t.bonus ? 200 : 0);
    this.enemiesKilled++;
    this.addExplosion(t.x + t.size / 2, t.y + t.size / 2, t.maxHp > 2 ? 34 : 28, true);
    this.playSound("explode");
    if (t.bonus) this.dropPowerUp(t);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }
  }

  private destroyBase() {
    this.baseAlive = false;
    this.grid[BASE_ROW][BASE_COL] = T.EMPTY;
    this.addExplosion(BASE_COL * TILE + TILE / 2, BASE_ROW * TILE + TILE / 2, 60, true);
    this.playSound("bigExplode");
    this.gameOverTimer = 1.4;
  }

  private dropPowerUp(t: Tank) {
    const type = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
    const size = 26;
    this.powerups.push({
      x: t.x + t.size / 2 - size / 2,
      y: t.y + t.size / 2 - size / 2,
      size,
      type,
      t: 0,
      life: 22,
    });
  }

  private updatePowerUps(dt: number) {
    const p = this.player;
    this.powerups = this.powerups.filter((pu) => {
      pu.t += dt;
      pu.life -= dt;
      if (pu.life <= 0) return false;
      if (p?.alive && this.overlap(pu.x, pu.y, pu.size, pu.size, p)) {
        this.collectPowerUp(pu.type);
        return false;
      }
      return true;
    });
  }

  private collectPowerUp(type: PowerType) {
    const p = this.player;
    switch (type) {
      case "star":
        this.playerLevel = Math.min(3, this.playerLevel + 1);
        if (p) this.applyPlayerLevel(p);
        break;
      case "shield":
        if (p) p.shield = Math.max(p.shield, 10);
        break;
      case "bomb":
        for (const t of this.tanks) {
          if (t.kind === "enemy" && t.alive) this.killEnemy(t);
        }
        break;
      case "life":
        this.lives += 1;
        break;
      case "freeze":
        this.freezeTimer = 8;
        break;
      case "shovel":
        this.placeBaseWalls(T.STEEL);
        this.shovelTimer = 15;
        break;
    }
    this.score += 500;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }
    this.playSound(type === "life" ? "life" : "powerup");
  }

  /* --------------------------- 特效 & 工具 --------------------------- */

  addExplosion(x: number, y: number, size: number, big: boolean) {
    this.explosions.push({
      x,
      y,
      size,
      t: 0,
      duration: big ? 0.5 : 0.22,
      big,
    });
  }

  private updateExplosions(dt: number) {
    for (const e of this.explosions) e.t += dt;
    this.explosions = this.explosions.filter((e) => e.t < e.duration);
  }

  private saveHighScore() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("tank-high-score", String(this.highScore));
    } catch {
      /* ignore */
    }
  }

  private playSound(name: SoundName) {
    this.sfx.play(name);
    this.onSound?.(name);
  }

  /* --------------------------- 公共控制 --------------------------- */

  start() {
    if (this.state === "ready" || this.state === "paused") this.state = "playing";
  }

  togglePause() {
    if (this.state === "playing") this.state = "paused";
    else if (this.state === "paused") this.state = "playing";
  }

  /** 切换音效开关，返回当前状态 */
  toggleMute(): boolean {
    this.sfx.muted = !this.sfx.muted;
    return this.sfx.muted;
  }

  getStats(): Stats {
    const alive = this.tanks.filter((t) => t.kind === "enemy" && t.alive).length;
    const remaining = ENEMIES_PER_LEVEL - this.enemiesSpawned + alive;
    return {
      state: this.state,
      score: this.score,
      highScore: this.highScore,
      lives: Math.max(0, this.lives),
      level: this.level,
      levelCount: LEVEL_COUNT,
      enemiesLeft: remaining,
      enemiesTotal: ENEMIES_PER_LEVEL,
      playerLevel: this.playerLevel,
      muted: this.sfx.muted,
    };
  }
}

function inputFire(input: Record<Action, boolean>): boolean {
  return input.fire;
}
