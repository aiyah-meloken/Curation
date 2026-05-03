import type { MapDSL, MapCard } from "../types";

/**
 * Validate map DSL + cards. Throws on structural errors.
 * Pure function; safe to call on every render (cheap).
 */
export function validate(dsl: MapDSL, cards: MapCard[]): void {
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

  // 3. card_id uniqueness; warn (don't throw) on unknown topic_id.
  const cardIds = new Set<string>();
  for (const c of cards) {
    if (c.card_id) {
      if (cardIds.has(c.card_id)) {
        throw new Error(`[atlas/validate] duplicate card_id "${c.card_id}"`);
      }
      cardIds.add(c.card_id);
    }
    if (c.topic?.id != null && !topicIds.has(c.topic.id)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[map/validate] card "${c.card_id ?? c.article_id}" has unknown topic.id "${c.topic.id}"`,
      );
    }
  }
}

/** @deprecated Use `validate` instead. */
export const validateMapInput = validate;
