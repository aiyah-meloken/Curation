// Atlas — hand-drawn coastline generator.
// Given a continent center and target radius, produce a deterministic
// closed SVG path with irregular contour (mimics hand-drawn antique maps).

import { hashSeed, mulberry32 } from "./geometry";

type CoastlineOpts = {
  cx: number;
  cy: number;
  radius: number;
  /** Seed for determinism — typically the big_domain_id. */
  seed: string;
  /** Number of control vertices around the loop. Default 12. */
  segments?: number;
  /** Per-vertex max radial wobble as a fraction of radius. Default 0.25. */
  wobble?: number;
  /** If sparse, reduce vertices and tighten radius for "atoll" form. */
  sparse?: boolean;
};

/**
 * Returns an SVG path `d` string forming a closed quadratic-Bezier loop
 * around (cx, cy) with hand-drawn irregularity. Determined by seed.
 */
export function generateCoastline(opts: CoastlineOpts): string {
  const sparse = opts.sparse ?? false;
  const segments = opts.segments ?? (sparse ? 8 : 12);
  const wobble = opts.wobble ?? (sparse ? 0.18 : 0.28);
  const baseR = opts.radius;
  const rng = mulberry32(hashSeed(opts.seed));

  // Sample one radius per vertex.
  const radii: number[] = [];
  for (let i = 0; i < segments; i++) {
    radii.push(baseR * (1 - wobble + rng() * wobble * 2));
  }

  // Compute vertex positions evenly spaced in angle, with a small angular jitter
  // per vertex to avoid an obviously regular polygon.
  const verts: Array<{ x: number; y: number }> = [];
  const baseStep = (Math.PI * 2) / segments;
  let angle = rng() * baseStep; // arbitrary starting rotation
  for (let i = 0; i < segments; i++) {
    angle += baseStep * (0.85 + rng() * 0.3);
    const r = radii[i];
    verts.push({
      x: opts.cx + r * Math.cos(angle),
      y: opts.cy + r * Math.sin(angle),
    });
  }

  // Build a closed quadratic-bezier path.
  // For each segment, the control point is the actual vertex; the curve
  // endpoints are midpoints between neighboring vertices. This keeps
  // every vertex tangent-continuous — a smooth meandering coast.
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const m0 = mid(verts[verts.length - 1], verts[0]);
  let d = `M ${m0.x.toFixed(1)},${m0.y.toFixed(1)}`;
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    const next = verts[(i + 1) % verts.length];
    const m = mid(v, next);
    d += ` Q ${v.x.toFixed(1)},${v.y.toFixed(1)} ${m.x.toFixed(1)},${m.y.toFixed(1)}`;
  }
  d += " Z";
  return d;
}
