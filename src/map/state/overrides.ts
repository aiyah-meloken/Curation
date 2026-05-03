// Atlas — local override layer (preview only).
//
// The mock files (`mock/dsl.ts` + `mock/cards.ts`) are the immutable source.
// Overrides live in localStorage so the user can:
//   - reassign a card to a different topic (and domain, transitively)
//   - add new domains
//   - add new topics under any domain
// without touching source files. When the user is satisfied, `serializeForExport()`
// produces a JSON blob they can paste back to migrate edits into source.

import type { MapCard, MapDSL, Domain, Topic } from "../types";

const STORAGE_KEY = "map-preview-overrides-v1";

export type MapOverrides = {
  /** Brand-new domains added by the user. */
  newBigDomains: Domain[];
  /**
   * Brand-new topics added by the user. `big_domain_id` records the
   * parent domain (existing or new). The id+label part matches Topic.
   */
  newSmallDomains: Array<Topic & { big_domain_id: string }>;
  /** Per-card override of `topic` id, keyed by card_id. */
  cardAssignments: Record<string, string>;
};

export const EMPTY_OVERRIDES: MapOverrides = {
  newBigDomains: [],
  newSmallDomains: [],
  cardAssignments: {},
};

// ───── Persistence ─────

export function loadOverrides(): MapOverrides {
  if (typeof window === "undefined") return EMPTY_OVERRIDES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_OVERRIDES;
    const parsed = JSON.parse(raw);
    return {
      newBigDomains: Array.isArray(parsed.newBigDomains) ? parsed.newBigDomains : [],
      newSmallDomains: Array.isArray(parsed.newSmallDomains) ? parsed.newSmallDomains : [],
      cardAssignments:
        parsed.cardAssignments && typeof parsed.cardAssignments === "object"
          ? parsed.cardAssignments
          : {},
    };
  } catch {
    return EMPTY_OVERRIDES;
  }
}

export function saveOverrides(o: MapOverrides) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  } catch {
    // localStorage may be full / unavailable; ignore.
  }
}

export function clearOverrides() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ───── Apply ─────

/**
 * Merge mock DSL + user-added domains into the effective DSL the app sees.
 * - For each existing domain, append any new topics whose `domain_id` matches.
 * - Append brand-new domains, then attach their new topics too.
 * - Append all new topics to the flat `topics` list.
 */
export function applyDslOverrides(base: MapDSL, o: MapOverrides): MapDSL {
  const newTopicsFor = (domainId: string): Topic[] =>
    o.newSmallDomains
      .filter((t) => t.big_domain_id === domainId)
      .map(({ big_domain_id: _ignored, ...t }) => t);

  const domains = base.domains.map((bd) => ({ ...bd }));

  for (const newBd of o.newBigDomains) {
    domains.push({ ...newBd });
  }

  const topics: Topic[] = [
    ...base.topics,
    // Strip the big_domain_id field — flat list only carries Topic fields.
    ...o.newSmallDomains.map(({ big_domain_id: _ignored, ...t }) => t),
    ...o.newBigDomains.flatMap((bd) => newTopicsFor(bd.id)),
  ];

  return { domains, topics };
}

/** Replace each card's `topic` id if the user has assigned a new one. */
export function applyCardAssignments(
  cards: MapCard[],
  o: MapOverrides,
): MapCard[] {
  if (Object.keys(o.cardAssignments).length === 0) return cards;
  return cards.map((c) => {
    const id = c.card_id;
    const newTopicId = id ? o.cardAssignments[id] : undefined;
    if (newTopicId) {
      // Preserve existing topic shape but override the id (and leave
      // label/domain fields as-is — preview DSL re-derives them from the DSL
      // anyway; layout only reads topic?.id for grouping).
      return {
        ...c,
        topic: c.topic
          ? { ...c.topic, id: newTopicId }
          : { id: newTopicId, label: newTopicId, domain_id: "", domain_label: "", domain_latin_label: null },
      };
    }
    return c;
  });
}

// ───── Helpers ─────

/**
 * Map topic_id → domain_id for the *effective* dsl.
 * Useful when the table needs to display a card's domain.
 */
export function smallToBigMap(dsl: MapDSL): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of dsl.topics) {
    m.set(t.id, t.domain_id);
  }
  return m;
}

/** Slug-ify a Chinese/English label into a lowercase ascii id. */
export function slugify(label: string): string {
  // Strip non-ascii, lowercase, replace spaces / punctuation with underscore.
  const ascii = label
    .toLowerCase()
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return ascii || `id_${Math.random().toString(36).slice(2, 8)}`;
}

/** Pretty-print overrides as JSON, for export-to-clipboard. */
export function serializeForExport(o: MapOverrides): string {
  return JSON.stringify(o, null, 2);
}
