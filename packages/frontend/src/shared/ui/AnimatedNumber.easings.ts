/**
 * Easing functions for number animations.
 */
export const easings = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - (1 - t) ** 3,
  easeInOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  spring: (t: number) => 1 - Math.cos(t * Math.PI * 0.5) ** 3,
} as const;
