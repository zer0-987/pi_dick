export type SoundName =
  | "shoot"
  | "enemyShoot"
  | "hit"
  | "explode"
  | "bigExplode"
  | "powerup"
  | "life"
  | "levelup"
  | "gameover";

interface ToneOptions {
  type?: OscillatorType;
  from: number;
  to?: number;
  duration: number;
  volume?: number;
  delay?: number;
}

/** 极简 WebAudio 音效合成器（无需任何音频资源文件） */
export class Sfx {
  muted = false;
  private ctx: AudioContext | null = null;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone({ type = "square", from, to, duration, volume = 0.05, delay = 0 }: ToneOptions) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  play(name: SoundName) {
    if (this.muted) return;
    switch (name) {
      case "shoot":
        this.tone({ from: 720, to: 180, duration: 0.08, volume: 0.045 });
        break;
      case "enemyShoot":
        this.tone({ from: 420, to: 120, duration: 0.08, volume: 0.03 });
        break;
      case "hit":
        this.tone({ type: "triangle", from: 240, to: 90, duration: 0.06, volume: 0.05 });
        break;
      case "explode":
        this.tone({ type: "sawtooth", from: 180, to: 40, duration: 0.28, volume: 0.07 });
        this.tone({ type: "square", from: 90, to: 30, duration: 0.3, volume: 0.05 });
        break;
      case "bigExplode":
        this.tone({ type: "sawtooth", from: 220, to: 30, duration: 0.55, volume: 0.1 });
        this.tone({ type: "square", from: 120, to: 25, duration: 0.6, volume: 0.07 });
        break;
      case "powerup":
        this.tone({ type: "sine", from: 520, duration: 0.09, volume: 0.06 });
        this.tone({ type: "sine", from: 700, duration: 0.09, volume: 0.06, delay: 0.09 });
        this.tone({ type: "sine", from: 980, duration: 0.12, volume: 0.06, delay: 0.18 });
        break;
      case "life":
        this.tone({ type: "sine", from: 660, duration: 0.1, volume: 0.06 });
        this.tone({ type: "sine", from: 880, duration: 0.1, volume: 0.06, delay: 0.1 });
        this.tone({ type: "sine", from: 1320, duration: 0.16, volume: 0.06, delay: 0.2 });
        break;
      case "levelup":
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone({ type: "square", from: f, duration: 0.12, volume: 0.05, delay: i * 0.11 }),
        );
        break;
      case "gameover":
        [440, 349, 262, 196].forEach((f, i) =>
          this.tone({ type: "square", from: f, duration: 0.26, volume: 0.06, delay: i * 0.2 }),
        );
        break;
    }
  }
}
