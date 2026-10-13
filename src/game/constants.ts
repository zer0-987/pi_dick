/** 全局常量：所有尺寸均以「逻辑像素」为单位，画布会按 DPR 放大。 */

export const TILE = 32; // 单个格子边长
export const COLS = 13; // 横向格子数
export const ROWS = 13; // 纵向格子数

export const FIELD_W = TILE * COLS; // 战场宽 416
export const FIELD_H = TILE * ROWS; // 战场高 416

export const TANK_SIZE = 26; // 坦克碰撞盒尺寸（略小于格子，方便通行）
export const BULLET_SIZE = 6; // 子弹碰撞盒尺寸

/** 固定步长模拟，保证不同刷新率下手感一致 */
export const STEP = 1 / 60;

/** 基地（老鹰）所在格子 */
export const BASE_COL = 6;
export const BASE_ROW = 12;

/** 玩家出生点（格子列） */
export const PLAYER_SPAWN_COL = 4;

/** 敌人出生点（格子列，行均为 0） */
export const ENEMY_SPAWN_COLS = [0, 6, 12] as const;

/** 格子类型 */
export const T = {
  EMPTY: 0,
  BRICK: 1,
  STEEL: 2,
  WATER: 3,
  TREE: 4,
  BASE: 5,
} as const;

export type TileType = (typeof T)[keyof typeof T];

/** 每关敌人总数 / 同时在场上限 */
export const ENEMIES_PER_LEVEL = 16;
export const MAX_ENEMIES_ON_FIELD = 4;

export const START_LIVES = 3;
