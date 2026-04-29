// Atlas — Terra Incognita decorations: sea swirls, monsters, label positions.
// All decorations are statically placed; this module just exposes the canonical
// list so AtlasCanvas can render them.

export type Swirl = { cx: number; cy: number; radii: number[] };
export type SeaMonster = { x: number; y: number; scale: number };
export type SeaLabel = {
  x: number;
  y: number;
  text: string;
  italic?: string;
  size?: number;
};

/** Designed for a 1600 × 900 canvas. AtlasCanvas scales via viewBox. */
export const SEA_SWIRLS: Swirl[] = [
  { cx: 200, cy: 720, radii: [40, 25, 14] },
  { cx: 1380, cy: 230, radii: [32, 20, 10] },
  { cx: 220, cy: 150, radii: [22, 12] },
  { cx: 1450, cy: 760, radii: [26, 16, 8] },
];

export const SEA_MONSTERS: SeaMonster[] = [
  { x: 950, y: 770, scale: 1 },
  { x: 1280, y: 130, scale: 0.7 },
];

export const SEA_LABELS: SeaLabel[] = [
  {
    x: 220,
    y: 800,
    text: "TERRA · INCOGNITA",
    italic: "— hic sunt leones —",
    size: 22,
  },
  {
    x: 1380,
    y: 170,
    text: "Mare · Tenebrarum",
    size: 16,
  },
];

/** Decorative latitude/longitude graticule lines. */
export const GRATICULE = {
  horizontals: [225, 450, 675],
  verticals: [400, 800, 1200],
};

/** SVG path for the small sea-monster doodle (eyed serpent/whale silhouette). */
export const SEA_MONSTER_PATH =
  "M0,0 q10,-12 25,-5 q15,-8 28,3 q-4,8 -14,4 q-12,8 -22,-2 q-10,3 -17,0z";
