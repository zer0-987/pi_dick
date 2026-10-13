import { T, type TileType } from "./constants";

/**
 * 关卡地图，13 x 13 字符。
 *   .  空地      B  砖墙（可被打碎）
 *   S  钢墙      W  河流（坦克不可过，子弹可过）
 *   T  树林（坦克可过，遮挡视线）
 * 基地与出生点由引擎自动放置，地图里保持为空即可。
 */
export const LEVELS: string[][] = [
  // ---------------- 第 1 关：经典砖阵 ----------------
  [
    ".............",
    ".BB.BB.BB.BB.",
    ".BB.BB.BB.BB.",
    ".BB.BB.BB.BB.",
    ".BB.BB.BB.BB.",
    ".............",
    ".BB.BB.BB.BB.",
    ".BB.BB.BB.BB.",
    ".BB.BB.BB.BB.",
    ".BB.BB.BB.BB.",
    ".............",
    ".....BBB.....",
    ".....B.B.....",
  ],
  // ---------------- 第 2 关：钢墙与河流 ----------------
  [
    ".............",
    ".SS.....SS...",
    ".SS.BBB.SS...",
    "....BBB......",
    ".WWW.....BBB.",
    ".WWW.BB..BBB.",
    ".....BB......",
    ".BBB.....SS..",
    ".BBB.....SS..",
    "......WWW....",
    "......WWW....",
    ".....BBB.....",
    ".....B.B.....",
  ],
  // ---------------- 第 3 关：树林迷宫 ----------------
  [
    ".............",
    ".TTT.....TTT.",
    ".T.B.SSS.B.T.",
    ".T.B.....B.T.",
    "...B.BBB.B...",
    "SS.B.B.B.B.SS",
    "...B.BBB.B...",
    ".T.B.....B.T.",
    ".T.B.SSS.B.T.",
    ".TTT.....TTT.",
    ".............",
    ".....BBB.....",
    ".....B.B.....",
  ],
];

const CHAR_TO_TILE: Record<string, TileType> = {
  ".": T.EMPTY,
  B: T.BRICK,
  S: T.STEEL,
  W: T.WATER,
  T: T.TREE,
};

/** 把字符地图转换为数字网格，越界字符按空地处理 */
export function parseLevel(levelIndex: number): number[][] {
  const map = LEVELS[levelIndex % LEVELS.length];
  const grid: number[][] = [];
  for (let r = 0; r < map.length; r++) {
    const row: number[] = [];
    for (let c = 0; c < map[r].length; c++) {
      row.push(CHAR_TO_TILE[map[r][c]] ?? T.EMPTY);
    }
    grid.push(row);
  }
  return grid;
}

export const LEVEL_COUNT = LEVELS.length;
