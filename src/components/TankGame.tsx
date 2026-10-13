"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { FIELD_H, FIELD_W, STEP } from "@/game/constants";
import { Game, type Action, type Stats } from "@/game/engine";
import { renderGame } from "@/game/render";
import styles from "./TankGame.module.css";

const EMPTY_STATS: Stats = {
  state: "ready",
  score: 0,
  highScore: 0,
  lives: 3,
  level: 0,
  levelCount: 3,
  enemiesLeft: 0,
  enemiesTotal: 0,
  playerLevel: 0,
  muted: false,
};

const KEY_MAP: Record<string, Action | "pause" | "confirm"> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
  " ": "fire",
  Spacebar: "fire",
  j: "fire",
  J: "fire",
  k: "fire",
  K: "fire",
  p: "pause",
  P: "pause",
  Enter: "confirm",
};

interface Overlay {
  title: string;
  lines: string[];
  action?: { label: string; onClick: () => void };
}

function sameStats(a: Stats, b: Stats) {
  return (
    a.state === b.state &&
    a.score === b.score &&
    a.highScore === b.highScore &&
    a.lives === b.lives &&
    a.level === b.level &&
    a.enemiesLeft === b.enemiesLeft &&
    a.playerLevel === b.playerLevel &&
    a.muted === b.muted
  );
}

export default function TankGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statsRef = useRef<Stats>(EMPTY_STATS);
  const [game, setGame] = useState<Game | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  /* ---------------------- 初始化画布与主循环 ---------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(FIELD_W * dpr);
    canvas.height = Math.floor(FIELD_H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const instance = new Game();
    setGame(instance);

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.2);
      last = now;
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard++ < 8) {
        instance.step(STEP);
        acc -= STEP;
      }
      renderGame(ctx, instance, now / 1000);

      const s = instance.getStats();
      if (!sameStats(statsRef.current, s)) {
        statsRef.current = s;
        setStats(s);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      instance.releaseAllKeys();
      setGame(null);
    };
  }, []);

  /* ---------------------- 操作 ---------------------- */
  const confirm = useCallback(() => {
    if (!game) return;
    if (game.state === "ready") game.start();
    else if (game.state === "gameover" || game.state === "victory") {
      game.restart();
      game.start();
    } else if (game.state === "paused") game.togglePause();
  }, [game]);

  const handlePause = useCallback(() => {
    if (!game) return;
    game.togglePause();
    game.releaseAllKeys();
  }, [game]);

  const handleRestart = useCallback(() => {
    if (!game) return;
    game.restart();
    game.start();
  }, [game]);

  const handleMute = useCallback(() => {
    if (!game) return;
    game.toggleMute();
  }, [game]);

  /* ---------------------- 键盘输入 ---------------------- */
  useEffect(() => {
    if (!game) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const mapped = KEY_MAP[e.key];
      if (!mapped) return;
      e.preventDefault();
      if (mapped === "pause") {
        game.togglePause();
        game.releaseAllKeys();
      } else if (mapped === "confirm") {
        confirm();
      } else {
        if (game.state === "ready") game.start();
        game.setKey(mapped, true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const mapped = KEY_MAP[e.key];
      if (!mapped || mapped === "pause" || mapped === "confirm") return;
      e.preventDefault();
      game.setKey(mapped, false);
    };
    const onBlur = () => game.releaseAllKeys();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [game, confirm]);

  /* ---------------------- 触屏方向键 ---------------------- */
  const padProps = (action: Action) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      if (!game) return;
      if (game.state === "ready") game.start();
      game.setKey(action, true);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      game?.setKey(action, false);
    },
    onPointerCancel: () => game?.setKey(action, false),
    onPointerLeave: () => game?.setKey(action, false),
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });

  const overlay = useMemo<Overlay | null>(() => {
    switch (stats.state) {
      case "ready":
        return {
          title: "坦克大战",
          lines: ["← ↑ ↓ → / WASD 移动", "空格 / J 开火", "守住基地，消灭全部敌人！"],
          action: { label: "开始游戏", onClick: confirm },
        };
      case "paused":
        return {
          title: "已暂停",
          lines: ["按 P 或点击按钮继续"],
          action: { label: "继续游戏", onClick: handlePause },
        };
      case "levelclear":
        return { title: "关卡完成", lines: ["准备迎接下一关…"] };
      case "gameover":
        return {
          title: "GAME OVER",
          lines: [`本局得分 ${stats.score}`],
          action: { label: "重新开始", onClick: handleRestart },
        };
      case "victory":
        return {
          title: "胜利！",
          lines: ["你守住了基地，全部关卡通关！", `最终得分 ${stats.score}`],
          action: { label: "再玩一次", onClick: handleRestart },
        };
      default:
        return null;
    }
  }, [stats.state, stats.score, confirm, handlePause, handleRestart]);

  return (
    <div className={styles.wrapper}>
      <header className={styles.hud}>
        <div className={styles.hudGroup}>
          <span className={styles.hudLabel}>得分</span>
          <span className={styles.hudValue}>{stats.score.toString().padStart(6, "0")}</span>
        </div>
        <div className={styles.hudGroup}>
          <span className={styles.hudLabel}>最高</span>
          <span className={styles.hudValue}>{stats.highScore.toString().padStart(6, "0")}</span>
        </div>
        <div className={styles.hudGroup}>
          <span className={styles.hudLabel}>关卡</span>
          <span className={styles.hudValue}>
            {stats.level + 1}
            <em className={styles.dim}>/{stats.levelCount}</em>
          </span>
        </div>
        <div className={styles.hudGroup}>
          <span className={styles.hudLabel}>剩余敌人</span>
          <span className={styles.hudValue}>{stats.enemiesLeft}</span>
        </div>
        <div className={styles.hudGroup}>
          <span className={styles.hudLabel}>生命</span>
          <span className={styles.hudValue}>{"♥".repeat(stats.lives) || "—"}</span>
        </div>
        <div className={styles.hudGroup}>
          <span className={styles.hudLabel}>火力</span>
          <span className={styles.hudValue}>{"★".repeat(stats.playerLevel) || "○"}</span>
        </div>
      </header>

      <div className={styles.stageWrap}>
        <div className={styles.stage}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            style={{ aspectRatio: `${FIELD_W} / ${FIELD_H}` }}
            aria-label="坦克大战游戏画面"
          />

          {overlay && (
            <div className={styles.overlay}>
              <div className={styles.overlayCard}>
                <h2 className={styles.overlayTitle}>{overlay.title}</h2>
                {overlay.lines.map((line) => (
                  <p key={line} className={styles.overlayText}>
                    {line}
                  </p>
                ))}
                {overlay.action && (
                  <button className={styles.primaryButton} onClick={overlay.action.onClick}>
                    {overlay.action.label}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.toolbar}>
          <button className={styles.toolButton} onClick={handlePause}>
            {stats.state === "paused" ? "继续 (P)" : "暂停 (P)"}
          </button>
          <button className={styles.toolButton} onClick={handleRestart}>
            重新开始
          </button>
          <button className={styles.toolButton} onClick={handleMute}>
            {stats.muted ? "🔇 音效关" : "🔊 音效开"}
          </button>
        </div>

        <div className={styles.touchPad}>
          <div className={styles.dpad}>
            <button className={`${styles.padButton} ${styles.padUp}`} {...padProps("up")}>
              ▲
            </button>
            <button className={`${styles.padButton} ${styles.padLeft}`} {...padProps("left")}>
              ◀
            </button>
            <button className={`${styles.padButton} ${styles.padRight}`} {...padProps("right")}>
              ▶
            </button>
            <button className={`${styles.padButton} ${styles.padDown}`} {...padProps("down")}>
              ▼
            </button>
          </div>
          <button className={`${styles.padButton} ${styles.fireButton}`} {...padProps("fire")}>
            开火
          </button>
        </div>
      </div>

      <footer className={styles.help}>
        <div>
          <strong>移动</strong> ← ↑ ↓ → / WASD　<strong>开火</strong> 空格 / J　
          <strong>暂停</strong> P
        </div>
        <div className={styles.tip}>
          保护基地老鹰，消灭全部敌人即可过关。击毁闪红光的坦克会掉落道具：★火力 ◎护盾
          ✸全歼 ♥加命 ❄冻结 ⛏加固基地。
        </div>
      </footer>
    </div>
  );
}
