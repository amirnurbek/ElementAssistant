import type { Options } from "canvas-confetti";

/**
 * canvas-confetti is loaded on first use, so it stays out of the initial
 * bundle and is never touched during server rendering.
 * `disableForReducedMotion` respects the OS "reduce motion" setting.
 */
async function fire(options: Options) {
  const { default: confetti } = await import("canvas-confetti");
  await confetti({ disableForReducedMotion: true, ...options });
}

/** Small burst for one correct answer, in the scoring team's color. */
export function burst(color?: string) {
  void fire({
    particleCount: 90,
    spread: 75,
    origin: { y: 0.7 },
    colors: color ? [color, "#facc15", "#ffffff"] : undefined,
  });
}

/** Big celebration for the end of the game: bursts from both sides. */
export function celebrate() {
  void fire({ particleCount: 160, angle: 60, spread: 80, origin: { x: 0, y: 0.8 } });
  void fire({ particleCount: 160, angle: 120, spread: 80, origin: { x: 1, y: 0.8 } });
}
