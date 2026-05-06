import type { Routing } from "../types";

export type RoutingLike = Routing | "discard" | "discarded" | string | null | undefined;

export interface RoutingPresentation {
  text: string;
  color: string;
  bg: string;
}

export function isAggregateKind(kind?: string | null): boolean {
  return kind === "aggregated" || kind === "residual" || kind === "deduped";
}

export function routingPresentation(
  routing: RoutingLike,
  opts: { kind?: string | null; aggregate?: boolean } = {},
): RoutingPresentation {
  if (!routing) {
    return { text: "未推送", bg: "var(--bg-base)", color: "var(--text-faint)" };
  }

  if (routing === "ai_curation") {
    const aggregate = opts.aggregate ?? isAggregateKind(opts.kind);
    return aggregate
      ? { text: "AI总结", bg: "var(--bg-panel)", color: "var(--accent-blue)" }
      : { text: "AI梳理", bg: "var(--bg-panel)", color: "var(--accent-green)" };
  }

  if (
    routing === "original_content_with_pre_card" ||
    routing === "original_content_with_post_card" ||
    routing === "reading_guide" ||
    routing === "post_read" ||
    routing === "original_push"
  ) {
    return { text: "原文推送", bg: "var(--bg-panel)", color: "var(--accent-green)" };
  }

  if (routing === "discard" || routing === "discarded") {
    return { text: "丢弃", bg: "var(--bg-panel)", color: "var(--accent-red)" };
  }

  return { text: routing, bg: "var(--bg-base)", color: "var(--text-faint)" };
}
