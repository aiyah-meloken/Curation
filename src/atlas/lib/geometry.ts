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

/**
 * Layout multiple floating cards so they don't overlap each other.
 *
 * Greedy algorithm:
 *   1. Sort anchors top-to-bottom for stable, predictable cascading.
 *   2. For each anchor, try a sequence of candidate placements:
 *      right-of-anchor, left-of-anchor, then offset above/below the anchor,
 *      then progressively further from the anchor.
 *   3. Pick the first candidate that fits in bounds AND doesn't overlap any
 *      already-placed card.
 *   4. Fallback: if every candidate collides, snap to the natural side and
 *      stack (overlap is unavoidable when too many cards are clustered).
 *
 * Returns one position per anchor in the SAME ORDER as input.
 */
export function layoutFloatingCards(
  anchors: Array<{ id: string; x: number; y: number }>,
  cardWidth: number,
  cardHeight: number,
  bounds: { width: number; height: number },
  gap = 18,
): Map<string, { x: number; y: number; anchor: "left" | "right" }> {
  const placed: Array<{ x: number; y: number }> = [];
  const result = new Map<
    string,
    { x: number; y: number; anchor: "left" | "right" }
  >();

  // Sort top-to-bottom — keeps near-top anchors closer to their natural y.
  const sorted = [...anchors].sort((a, b) => a.y - b.y);

  const margin = 8;
  const cw = cardWidth;
  const ch = cardHeight;

  function overlaps(x: number, y: number): boolean {
    for (const p of placed) {
      const dx = Math.min(x + cw, p.x + cw) - Math.max(x, p.x);
      const dy = Math.min(y + ch, p.y + ch) - Math.max(y, p.y);
      if (dx > -margin && dy > -margin) return true; // 8px breathing room
    }
    return false;
  }

  function inBounds(x: number, y: number): boolean {
    return (
      x >= 12 &&
      x + cw <= bounds.width - 12 &&
      y >= 12 &&
      y + ch <= bounds.height - 12
    );
  }

  for (const a of sorted) {
    const xRight = a.x + gap;
    const xLeft = a.x - gap - cw;
    const yBase = a.y - 26;

    // Try a deep candidate ladder. Order: prefer same-side as natural,
    // gradually move y up/down, then flip sides.
    const wantRight = xRight + cw <= bounds.width - 24;
    const primaryX = wantRight ? xRight : xLeft;
    const secondaryX = wantRight ? xLeft : xRight;
    const primaryAnchor: "left" | "right" = wantRight ? "left" : "right";
    const secondaryAnchor: "left" | "right" = wantRight ? "right" : "left";

    const yOffsets = [
      0,
      -ch / 2 - 14, ch / 2 + 14,
      -ch - 28,     ch + 28,
      -ch * 1.5 - 42, ch * 1.5 + 42,
    ];

    type C = { x: number; y: number; anchor: "left" | "right" };
    const candidates: C[] = [];
    for (const dy of yOffsets) {
      candidates.push({ x: primaryX, y: yBase + dy, anchor: primaryAnchor });
    }
    for (const dy of yOffsets) {
      candidates.push({ x: secondaryX, y: yBase + dy, anchor: secondaryAnchor });
    }

    let chosen: C | null = null;
    for (const c of candidates) {
      const x = c.x;
      const y = Math.max(12, Math.min(c.y, bounds.height - ch - 12));
      if (!inBounds(x, y)) continue;
      if (overlaps(x, y)) continue;
      chosen = { x, y, anchor: c.anchor };
      break;
    }
    if (!chosen) {
      // Fallback: snap to natural side, clamp y, accept overlap.
      const x = primaryX;
      const y = Math.max(12, Math.min(yBase, bounds.height - ch - 12));
      chosen = { x, y, anchor: primaryAnchor };
    }
    placed.push({ x: chosen.x, y: chosen.y });
    result.set(a.id, chosen);
  }
  return result;
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
