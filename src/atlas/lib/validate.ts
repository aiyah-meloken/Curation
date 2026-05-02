import type { AtlasDSL, AtlasCard } from "../types";

/**
 * Validate atlas DSL + cards. Throws on structural errors.
 * Pure function; safe to call on every render (cheap).
 */
export function validate(dsl: AtlasDSL, cards: AtlasCard[]): void {
  // 1. topic.domain_id must reference an existing domain.
  const domainIds = new Set(dsl.domains.map((d) => d.id));
  for (const t of dsl.topics) {
    if (!domainIds.has(t.domain_id)) {
      throw new Error(
        `[atlas/validate] topic "${t.id}" references unknown domain "${t.domain_id}"`,
      );
    }
  }

  // 2. topic ids must be unique.
  const topicIds = new Set<string>();
  for (const t of dsl.topics) {
    if (topicIds.has(t.id)) {
      throw new Error(`[atlas/validate] duplicate topic id "${t.id}"`);
    }
    topicIds.add(t.id);
  }

  // 3. card_id uniqueness; warn (don't throw) on unknown atlas_topic_id.
  const cardIds = new Set<string>();
  for (const c of cards) {
    if (c.card_id) {
      if (cardIds.has(c.card_id)) {
        throw new Error(`[atlas/validate] duplicate card_id "${c.card_id}"`);
      }
      cardIds.add(c.card_id);
    }
    if (c.atlas_topic_id != null && !topicIds.has(c.atlas_topic_id)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[atlas/validate] card "${c.card_id ?? c.article_id}" has unknown atlas_topic_id "${c.atlas_topic_id}"`,
      );
    }
  }
}

/** @deprecated Use `validate` instead. */
export const validateAtlasInput = validate;
