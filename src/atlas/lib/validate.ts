// Atlas — DSL & cards integrity validator.
// Throws on any structural problem so the UI fails loud rather than rendering garbage.

import type { AtlasCard, AtlasDSL } from "../types";

export function validateAtlasInput(dsl: AtlasDSL, cards: AtlasCard[]): void {
  // 1. small_domain_ids in big_domains must reference existing small_domains.
  const sd_ids = new Set(dsl.small_domains.map((s) => s.id));
  for (const bd of dsl.big_domains) {
    for (const sid of bd.small_domain_ids) {
      if (!sd_ids.has(sid)) {
        throw new Error(
          `[atlas/validate] big_domain "${bd.id}" references unknown small_domain "${sid}"`,
        );
      }
    }
  }

  // 2. small_domain_ids must form a contiguous slice of dsl.small_domains.
  const sd_order = dsl.small_domains.map((s) => s.id);
  for (const bd of dsl.big_domains) {
    if (bd.small_domain_ids.length === 0) continue;
    const idx = bd.small_domain_ids.map((sid) => sd_order.indexOf(sid));
    const sorted = [...idx].sort((a, b) => a - b);
    if (sorted[sorted.length - 1] - sorted[0] + 1 !== sorted.length) {
      throw new Error(
        `[atlas/validate] big_domain "${bd.id}" small_domain_ids are not a contiguous slice of dsl.small_domains: ${bd.small_domain_ids.join(", ")}`,
      );
    }
  }

  // 3. Each small_domain must belong to exactly one big_domain.
  const sd_to_bd = new Map<string, string>();
  for (const bd of dsl.big_domains) {
    for (const sid of bd.small_domain_ids) {
      const prev = sd_to_bd.get(sid);
      if (prev && prev !== bd.id) {
        throw new Error(
          `[atlas/validate] small_domain "${sid}" belongs to both "${prev}" and "${bd.id}"`,
        );
      }
      sd_to_bd.set(sid, bd.id);
    }
  }

  // 4. Card small_domain_id must exist; card_id must be unique.
  const seen_ids = new Set<string>();
  for (const c of cards) {
    if (!c.card_id) {
      throw new Error(`[atlas/validate] card has null card_id: ${c.title}`);
    }
    if (seen_ids.has(c.card_id)) {
      throw new Error(`[atlas/validate] duplicate card_id: ${c.card_id}`);
    }
    seen_ids.add(c.card_id);
    if (!sd_ids.has(c.small_domain_id)) {
      throw new Error(
        `[atlas/validate] card "${c.card_id}" references unknown small_domain "${c.small_domain_id}"`,
      );
    }
  }
}
