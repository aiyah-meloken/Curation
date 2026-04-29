// Atlas (今日舆图) data contracts.
// Spec: docs/superpowers/specs/2026-04-29-atlas-preview-design.md

import type { InboxItem } from "../types";

// ===== DSL = atlas skeleton (taxonomy) =====
export type AtlasDSL = {
  big_domains: BigDomain[];
  /** Must be ordered for display (top-of-fan to bottom). */
  small_domains: SmallDomain[];
};

export type BigDomain = {
  id: string;
  /** Chinese display label, e.g. "AI 模型". */
  label: string;
  /** Latinized cartographic label, e.g. "AI MODELORVM". Falls back to label.toUpperCase(). */
  latin_label?: string;
  /** Must be a contiguous slice of dsl.small_domains (validated at render). */
  small_domain_ids: string[];
};

export type SmallDomain = {
  id: string;
  label: string;
};

// ===== Cards = InboxItem + atlas tags =====
// AtlasCard reuses InboxItem (the existing curation-app inbox row type)
// and layers three atlas-specific fields on top.
export type AtlasCard = InboxItem & {
  small_domain_id: string;
  shared_entities: string[];
  /**
   * For aggregate cards (multi-source merged into one). Default = 1 (single-source).
   * Atlas only uses this to size the settlement marker; it never reads the
   * underlying source card list.
   */
  source_count?: number;
};

// ===== Article content for the drawer =====
export type ArticleContent = {
  id: string;
  title: string;
  account: string;
  publish_time: string;
  content_md: string;
};

// ===== Layout output (derived in lib/layout.ts) =====
export type AtlasLayout = {
  canvas: { width: number; height: number };
  continents: ContinentLayout[];
  routes: RouteLayout[];
};

export type ContinentLayout = {
  big_domain_id: string;
  center: { x: number; y: number };
  radius: number;
  coastline_path: string;
  shadow_path: string;
  sparse: boolean;
  cards: SettlementLayout[];
  small_domains: Array<{
    small_domain_id: string;
    label_x: number;
    label_y: number;
  }>;
  label_x: number;
  label_y: number;
};

export type SettlementLayout = {
  card_id: string;
  small_domain_id: string;
  x: number;
  y: number;
  /** Visual radius in px. Derived from source_count. */
  radius: number;
  /** Whether to render as filled (hot) or hollow (single source). */
  hot: boolean;
};

export type RouteLayout = {
  from_card_id: string;
  to_card_id: string;
  path: string;
  shared_entities: string[];
};
