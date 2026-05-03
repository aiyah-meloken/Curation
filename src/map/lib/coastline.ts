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
 * Result of generating a coastline:
 *   - `path`: SVG `d` string (closed quadratic-bezier loop)
 *   - `top_y` / `bottom_y` / `left_x` / `right_x`: tight bounding box of the
 *     final vertex ring, used by layout.ts to anchor labels at a CONSTANT
 *     visual distance from the squiggly edge (rather than a fixed offset
 *     from the base radius, which gives inconsistent gaps because each
 *     coastline wobbles differently at the top).
 */
export type CoastlineResult = {
  path: string;
  top_y: number;
  bottom_y: number;
  left_x: number;
  right_x: number;
};

/**
 * Returns the SVG path + bounding box for a closed coastline around
 * (cx, cy). Determined by seed — same input always yields same output.
 */
export function generateCoastline(opts: CoastlineOpts): CoastlineResult {
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

  // Build the path AND compute the EXACT axis-aligned bounding box of the
  // rendered bezier curve. Tight bbox is required by layout.ts to anchor
  // labels at a constant *visual* gap from the squiggly edge — sampling
  // vertices alone gives a loose approximation because the bezier curve
  // never reaches its control points.
  //
  // For each quadratic segment B(t) = (1-t)² P0 + 2t(1-t) P1 + t² P2, the
  // y-extremum is at t* = (P0 - P1) / (P0 - 2P1 + P2) — analytical, exact.
  const m0 = mid(verts[verts.length - 1], verts[0]);
  let d = `M ${m0.x.toFixed(1)},${m0.y.toFixed(1)}`;
  let topY = Infinity;
  let bottomY = -Infinity;
  let leftX = Infinity;
  let rightX = -Infinity;
  const probe = (x: number, y: number) => {
    if (y < topY) topY = y;
    if (y > bottomY) bottomY = y;
    if (x < leftX) leftX = x;
    if (x > rightX) rightX = x;
  };
  // Helper: evaluate bezier at t given P0/P1/P2.
  const bezAt = (
    t: number,
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
  ) => {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * t * u * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * t * u * p1.y + t * t * p2.y,
    };
  };
  // Probe the segment's endpoints plus the analytical x- and y-extrema.
  const probeSegment = (
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
  ) => {
    probe(p0.x, p0.y);
    probe(p2.x, p2.y);
    // y-extremum
    const denomY = p0.y - 2 * p1.y + p2.y;
    if (Math.abs(denomY) > 1e-9) {
      const tY = (p0.y - p1.y) / denomY;
      if (tY > 0 && tY < 1) {
        const ext = bezAt(tY, p0, p1, p2);
        probe(ext.x, ext.y);
      }
    }
    // x-extremum
    const denomX = p0.x - 2 * p1.x + p2.x;
    if (Math.abs(denomX) > 1e-9) {
      const tX = (p0.x - p1.x) / denomX;
      if (tX > 0 && tX < 1) {
        const ext = bezAt(tX, p0, p1, p2);
        probe(ext.x, ext.y);
      }
    }
  };

  let prev = m0;
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    const next = verts[(i + 1) % verts.length];
    const m = mid(v, next);
    d += ` Q ${v.x.toFixed(1)},${v.y.toFixed(1)} ${m.x.toFixed(1)},${m.y.toFixed(1)}`;
    probeSegment(prev, v, m);
    prev = m;
  }
  d += " Z";
  return { path: d, top_y: topY, bottom_y: bottomY, left_x: leftX, right_x: rightX };
}
