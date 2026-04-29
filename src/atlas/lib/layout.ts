// Atlas — layout algorithm.
//
// Pure function: (dsl, cards, canvas) -> AtlasLayout.
// Same input always produces the same output (snapshot-testable).
//
// Strategy:
//   1. Group cards by big_domain (via small_domain_id -> big_domain).
//   2. Place continent centers on a hand-tuned grid (preview: hardcoded
//      slots; reorder by card count so dense continents take the central
//      slots).
//   3. For each continent, generate a coastline path, then place its
//      settlements (cards) inside the coastline by small-domain sector.
//   4. Compute trade routes from card-pair shared_entities intersections.

import { generateCoastline } from "./coastline";
import { curvedRoute, hashSeed, mulberry32 } from "./geometry";
import type {
  AtlasCard,
  AtlasDSL,
  AtlasLayout,
  ContinentLayout,
  RouteLayout,
  SettlementLayout,
} from "../types";

/** Default canvas (matches the explored mockup viewBox). */
export const ATLAS_CANVAS = { width: 1600, height: 900 };

/**
 * Hand-tuned candidate continent slots, ordered "central / dense -> peripheral".
 * Layout fills these in rank order: largest continent goes to slot 0, etc.
 * Sparse continents (< MIN_CARDS_FOR_DENSE) snap to small peripheral atoll slots.
 *
 * Positions are constrained to keep big-domain labels (which sit above
 * continents) clear of the cartouche (top-left ~310×100px) and to keep
 * lower continents above the legend (bottom-left ~280×170px).
 */
const DENSE_SLOTS: Array<{ x: number; y: number; radius: number }> = [
  { x: 480, y: 400, radius: 180 },   // major, left-center (below cartouche)
  { x: 1140, y: 360, radius: 200 },  // major, right-center
  { x: 750, y: 700, radius: 135 },   // lower-center (above legend)
  { x: 280, y: 700, radius: 105 },   // lower-left fallback
];

const SPARSE_SLOTS: Array<{ x: number; y: number; radius: number }> = [
  { x: 1430, y: 590, radius: 48 },   // right-center mid (below AI产品, above compass)
  { x: 1450, y: 200, radius: 42 },   // upper-right atoll (in Mare Tenebrarum)
  { x: 130, y: 480, radius: 40 },    // mid-left atoll
  { x: 950, y: 200, radius: 36 },    // upper-center atoll
];

const MIN_CARDS_FOR_DENSE = 2;

export function computeLayout(
  dsl: AtlasDSL,
  cards: AtlasCard[],
  canvas: { width: number; height: number } = ATLAS_CANVAS,
): AtlasLayout {
  // Build small_domain -> big_domain index.
  const sd_to_bd = new Map<string, string>();
  for (const bd of dsl.big_domains) {
    for (const sid of bd.small_domain_ids) sd_to_bd.set(sid, bd.id);
  }

  // Group cards by big_domain, preserving order from dsl.big_domains.
  const groups = new Map<string, AtlasCard[]>();
  for (const bd of dsl.big_domains) groups.set(bd.id, []);
  for (const c of cards) {
    const bd_id = sd_to_bd.get(c.small_domain_id);
    if (!bd_id) continue; // shouldn't happen — validate runs first
    groups.get(bd_id)!.push(c);
  }

  // Sort big_domains by card count desc so dense continents get central slots.
  const sortedBd = [...dsl.big_domains].sort(
    (a, b) => (groups.get(b.id)!.length) - (groups.get(a.id)!.length),
  );

  let denseIdx = 0;
  let sparseIdx = 0;
  const continents: ContinentLayout[] = [];
  for (const bd of sortedBd) {
    const bdCards = groups.get(bd.id)!;
    const sparse = bdCards.length < MIN_CARDS_FOR_DENSE;
    const slot = sparse
      ? SPARSE_SLOTS[Math.min(sparseIdx++, SPARSE_SLOTS.length - 1)]
      : DENSE_SLOTS[Math.min(denseIdx++, DENSE_SLOTS.length - 1)];

    const radius = slot.radius;
    const seed = `coast-${bd.id}`;
    const coastline_path = generateCoastline({
      cx: slot.x,
      cy: slot.y,
      radius,
      seed,
      sparse,
    });
    const shadow_path = generateCoastline({
      cx: slot.x,
      cy: slot.y,
      radius: radius * 1.04,
      seed,
      sparse,
    });

    const cont: ContinentLayout = {
      big_domain_id: bd.id,
      center: { x: slot.x, y: slot.y },
      radius,
      coastline_path,
      shadow_path,
      sparse,
      cards: layoutSettlements(bd, bdCards, slot.x, slot.y, radius),
      small_domains: layoutSmallDomainLabels(bd, slot.x, slot.y, radius, sparse),
      label_x: slot.x,
      label_y: slot.y - radius - (sparse ? 18 : 32),
    };
    continents.push(cont);
  }

  // Trade routes: for every pair of cards with non-empty shared_entities
  // intersection, generate a curved path.
  const cardPos = new Map<string, { x: number; y: number }>();
  for (const c of continents) {
    for (const s of c.cards) {
      cardPos.set(s.card_id, { x: s.x, y: s.y });
    }
  }
  const cardById = new Map(cards.map((c) => [c.card_id!, c]));
  const routes: RouteLayout[] = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i];
      const b = cards[j];
      const shared = intersect(a.shared_entities, b.shared_entities);
      if (shared.length === 0) continue;
      const pa = cardPos.get(a.card_id!);
      const pb = cardPos.get(b.card_id!);
      if (!pa || !pb) continue;
      // Bow direction is determined by hash of pair so it's stable yet varied.
      const seed = hashSeed(`route-${a.card_id}-${b.card_id}`);
      const bowMag = 60 + (seed % 80);
      const bowSign = (seed >> 8) & 1 ? 1 : -1;
      routes.push({
        from_card_id: a.card_id!,
        to_card_id: b.card_id!,
        path: curvedRoute(pa.x, pa.y, pb.x, pb.y, bowMag * bowSign),
        shared_entities: shared,
      });
    }
  }

  // Suppress unused warning (cardById may aid future enrichment).
  void cardById;

  return { canvas, continents, routes };
}

function intersect<T>(a: T[], b: T[]): T[] {
  if (!a.length || !b.length) return [];
  const set = new Set(a);
  return b.filter((x) => set.has(x));
}

/**
 * Lay out the settlements (cards) inside a continent.
 *
 * The continent is sliced into wedges, one per small_domain, in dsl order.
 * Within each wedge, cards are placed at deterministic offsets — golden-angle
 * spread + wedge-relative radius + stable jitter — so the same card_id always
 * lands in the same spot.
 */
function layoutSettlements(
  bd: { small_domain_ids: string[] },
  cards: AtlasCard[],
  cx: number,
  cy: number,
  radius: number,
): SettlementLayout[] {
  if (cards.length === 0) return [];

  // Group cards by small_domain, preserving bd.small_domain_ids order.
  const wedgeCards = new Map<string, AtlasCard[]>();
  for (const sid of bd.small_domain_ids) wedgeCards.set(sid, []);
  for (const c of cards) {
    const list = wedgeCards.get(c.small_domain_id);
    if (list) list.push(c);
  }

  // Total count for wedge angle weighting.
  const total = cards.length;
  const filled = bd.small_domain_ids.filter(
    (sid) => (wedgeCards.get(sid)?.length || 0) > 0,
  );
  const wedgeCount = Math.max(filled.length, 1);

  // Each wedge spans a portion of 2π. Wedge weight = max(MIN_FRAC, count/total).
  const MIN_FRAC = 1 / (wedgeCount * 3); // floor so empty wedges don't vanish
  const weights = new Map<string, number>();
  let weightSum = 0;
  for (const sid of bd.small_domain_ids) {
    const n = wedgeCards.get(sid)?.length || 0;
    const w = Math.max(MIN_FRAC, n / total);
    weights.set(sid, w);
    weightSum += w;
  }

  // Wedge angles: cumulative around the continent.
  const startAngle = -Math.PI / 2; // start at "north" of continent
  const wedgeAngles = new Map<string, [number, number]>();
  let cur = startAngle;
  for (const sid of bd.small_domain_ids) {
    const w = weights.get(sid)!;
    const span = (w / weightSum) * Math.PI * 2;
    wedgeAngles.set(sid, [cur, cur + span]);
    cur += span;
  }

  const settlements: SettlementLayout[] = [];

  for (const sid of bd.small_domain_ids) {
    const list = wedgeCards.get(sid);
    if (!list || list.length === 0) continue;
    const [t0, t1] = wedgeAngles.get(sid)!;
    const tMid = (t0 + t1) / 2;
    const tSpan = t1 - t0;

    // Sort within wedge: hot/large cards first so they get the central slot.
    const sorted = [...list].sort((a, b) => {
      const sa = a.source_count ?? 1;
      const sb = b.source_count ?? 1;
      if (sa !== sb) return sb - sa;
      return (a.card_id || "").localeCompare(b.card_id || "");
    });

    const goldenAngle = (Math.PI * (3 - Math.sqrt(5))); // ≈ 2.39996

    sorted.forEach((c, idx) => {
      // r within [0.42, 0.78] of continent radius — keeps settlements
      // inside the coastline with safe margin.
      const seed = mulberry32(hashSeed(`pos-${c.card_id}`));
      const seedJitter = seed();
      const rFrac =
        idx === 0
          ? 0.42 + seedJitter * 0.06
          : 0.5 + ((idx * 0.13) % 0.32) + seedJitter * 0.04;
      const r = radius * rFrac;

      // Theta: wedge midline + golden-angle offset, clamped within wedge.
      const thetaOffset =
        idx === 0
          ? 0
          : ((idx * goldenAngle) % (tSpan * 0.85)) - tSpan * 0.42;
      const theta = tMid + thetaOffset + (seed() - 0.5) * tSpan * 0.05;

      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);

      const sc = c.source_count ?? 1;
      const hot = sc >= 2;
      // Settlement radius: 4–14 px, log-scaled in source_count.
      const visualR = hot ? Math.min(14, 9 + Math.log2(sc) * 1.6) : 5.5;

      settlements.push({
        card_id: c.card_id!,
        small_domain_id: sid,
        x,
        y,
        radius: visualR,
        hot,
      });
    });
  }

  return settlements;
}

function layoutSmallDomainLabels(
  bd: { small_domain_ids: string[] },
  cx: number,
  cy: number,
  radius: number,
  sparse: boolean,
): ContinentLayout["small_domains"] {
  if (sparse) return []; // labels too crowded on tiny atolls
  const out: ContinentLayout["small_domains"] = [];
  // Place labels along an inner ring at 0.32 R.
  bd.small_domain_ids.forEach((sid, i) => {
    const total = bd.small_domain_ids.length;
    if (total === 0) return;
    const angle = -Math.PI / 2 + ((i + 0.5) / total) * Math.PI * 2;
    const r = radius * 0.34;
    out.push({
      small_domain_id: sid,
      label_x: cx + r * Math.cos(angle),
      label_y: cy + r * Math.sin(angle),
    });
  });
  return out;
}
