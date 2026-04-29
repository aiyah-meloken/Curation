// Atlas — geometry primitives.

/** Deterministic 32-bit hash from a string seed. */
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG seeded by a 32-bit integer. Returns a function that yields [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convert polar (theta in radians, r) to cartesian, anchored at origin. */
export function polarToCartesian(
  thetaRad: number,
  r: number,
  originX: number,
  originY: number,
): { x: number; y: number } {
  return {
    x: originX + r * Math.cos(thetaRad),
    y: originY + r * Math.sin(thetaRad),
  };
}

/**
 * Place a popover near a point, snapping to the better-fitting side.
 * Returns top-left coordinates and which side the arrow should point to.
 */
export function placeFloatingCard(
  pointX: number,
  pointY: number,
  cardWidth: number,
  cardHeight: number,
  bounds: { width: number; height: number },
  gap = 18,
): { x: number; y: number; anchor: "left" | "right" } {
  const wantRight = pointX + gap + cardWidth <= bounds.width - 24;
  const anchor: "left" | "right" = wantRight ? "left" : "right";
  const x = wantRight ? pointX + gap : pointX - gap - cardWidth;
  const yRaw = pointY - 26;
  const y = Math.max(16, Math.min(yRaw, bounds.height - cardHeight - 16));
  return { x, y, anchor };
}

/** Build an SVG quadratic-curve path from a → b with a perpendicular bow offset. */
export function curvedRoute(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  bow = 80,
): string {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular unit vector, rotated 90° clockwise.
  const px = -dy / len;
  const py = dx / len;
  const cx = mx + px * bow;
  const cy = my + py * bow;
  return `M ${ax.toFixed(1)},${ay.toFixed(1)} Q ${cx.toFixed(1)},${cy.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`;
}
