import { useEffect, useRef } from 'react';
import type { VoiceState } from '../voice/types';

// Ported from a standalone full-viewport reference demo (portfolio-spec/mic-blob-reference.html)
// down to button size. Same layered-blob/glow technique, same per-state color palettes; the
// mic-level reactivity comes from VoiceProvider.getAudioLevel() (polled every frame, not piped
// through React state — state updates 60x/sec would be both wasteful and janky). Speaking has no
// real audio stream available from speechSynthesis, so that state simulates a syllable envelope
// from elapsed time only, same approach the reference demo falls back to.

const PALETTE: Record<VoiceState, [number, number, number][]> = {
  idle: [
    [110, 120, 255],
    [170, 100, 255],
    [80, 170, 255],
  ],
  connecting: [
    [110, 120, 255],
    [170, 100, 255],
    [80, 170, 255],
  ],
  listening: [
    [60, 220, 255],
    [90, 140, 255],
    [120, 255, 220],
  ],
  speaking: [
    [255, 100, 200],
    [255, 160, 90],
    [190, 110, 255],
  ],
};

const LAYERS = [
  { scale: 1.0, speed: 0.55, wob: 1.0, alpha: 0.55, phase: 0 },
  { scale: 0.88, speed: -0.8, wob: 1.3, alpha: 0.55, phase: 2 },
  { scale: 0.74, speed: 1.1, wob: 1.6, alpha: 0.6, phase: 4 },
];
const N = 48; // lower point count than the full-screen original — this renders much smaller

interface Props {
  state: VoiceState;
  size: number;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  getAudioLevel: () => number;
}

export default function VoiceOrb({ state, size, onClick, disabled, ariaLabel, getAudioLevel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const getAudioLevelRef = useRef(getAudioLevel);
  stateRef.current = state;
  getAudioLevelRef.current = getAudioLevel;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;

    const colors = PALETTE.idle.map((c) => c.slice()) as [number, number, number][];
    let level = 0;
    let energy = 0;
    const t0 = performance.now();
    let frameId: number;

    const draw = (now: number): void => {
      const t = (now - t0) / 1000;
      const current = stateRef.current;

      let targetLevel: number;
      if (current === 'listening') {
        targetLevel = getAudioLevelRef.current();
      } else if (current === 'speaking') {
        const syllable = 0.5 + 0.5 * Math.sin(t * 11) * Math.sin(t * 4.3 + 1);
        targetLevel = Math.min(1, 0.25 + syllable * 0.4);
      } else {
        targetLevel = 0;
      }
      level += (targetLevel - level) * (targetLevel > level ? 0.35 : 0.08);
      const base = current === 'idle' || current === 'connecting' ? 0.06 : 0.14;
      energy += (base + level - energy) * 0.15;

      const palette = PALETTE[current];
      for (let i = 0; i < 3; i++) {
        for (let k = 0; k < 3; k++) {
          const colorRow = colors[i];
          const paletteRow = palette[i];
          if (!colorRow || !paletteRow) continue;
          colorRow[k] = (colorRow[k] ?? 0) + ((paletteRow[k] ?? 0) - (colorRow[k] ?? 0)) * 0.04;
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, px, px);

      const cx = px / 2;
      const cy = px / 2;
      const r = px * 0.3 * (1 + energy * 0.35);

      const c0 = (colors[0] ?? [255, 255, 255]).map(Math.round);
      const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.9);
      glow.addColorStop(0, `rgba(${c0},${0.22 + energy * 0.35})`);
      glow.addColorStop(1, `rgba(${c0},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, px, px);

      ctx.globalCompositeOperation = 'lighter';
      LAYERS.forEach((layer, li) => {
        const col = (colors[li] ?? [255, 255, 255]).map(Math.round);
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * Math.PI * 2;
          const tt = t * layer.speed + layer.phase;
          const n =
            Math.sin(a * 3 + tt * 1.3) * 0.5 +
            Math.sin(a * 5 - tt * 1.9) * 0.3 +
            Math.sin(a * 8 + tt * 2.7 + li) * 0.2 * (0.3 + energy * 2.2);
          const rad = r * layer.scale * (1 + n * (0.05 + energy * 0.55) * layer.wob);
          const x = cx + Math.cos(a) * rad;
          const y = cy + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.4);
        g.addColorStop(0, `rgba(${col},${layer.alpha * 0.25})`);
        g.addColorStop(0.7, `rgba(${col},${layer.alpha})`);
        g.addColorStop(1, `rgba(${col},0.05)`);
        ctx.fillStyle = g;
        ctx.fill();
      });

      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.55);
      core.addColorStop(0, `rgba(255,255,255,${0.35 + energy * 0.5})`);
      core.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.fill();

      frameId = requestAnimationFrame(draw);
    };
    frameId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(frameId);
    // Intentionally only re-runs if `size` changes — state/level are read live via refs each
    // frame so the animation never restarts (and thus never stutters) on a state change.
  }, [size]);

  return (
    <button
      type="button"
      className="chat-voice-orb"
      style={{ width: size, height: size }}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === 'listening'}
      aria-label={ariaLabel}
    >
      <canvas ref={canvasRef} aria-hidden="true" style={{ width: size, height: size }} />
    </button>
  );
}
