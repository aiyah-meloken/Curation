// IndexedDB schema for the web build's local cache. Mirrors the desktop's
// SQLite tables (src-tauri/src/db.rs) so the same /sync delta payload writes
// into either backend without per-platform shaping.
//
// Bump DB_VERSION every time we change the shape of any object store
// (column equivalent) OR need to wipe stale data after a server-side schema
// change — same pattern as the desktop's `card_id_format_v2_ulid` marker.
// The `upgrade` callback in idb.ts switches on `oldVersion` to apply the
// right one-shot for each version transition.
import type { DBSchema } from "idb";
import type { CachedCard, CachedFavorite, CachedAccount } from "../cache";

export const DB_NAME = "curation_cache";
// v2 (2026-05-04): server's /sync semantics changed from
//   filter: card.updated_at > since
// to
//   filter: GREATEST(card.updated_at, cd.created_at, cd.read_at,
//                    cd.favorited_at, cd.dismissed_at) >= since
// Cards delivered by subscribe-time backfill or a re-run since the user
// last synced with the OLD logic are stuck behind the user's
// last_sync_ts cursor — they'll never surface incrementally because
// their event_at < the stored cursor. Bump forces a cards/articles
// wipe + last_sync_ts reset → next /sync pulls full state.
// v3 (2026-05-05): local cache now stores dedup metadata and removes
// superseded source cards when a deduped card arrives. Clear card state so
// clients with stale source cards rebuild from server visibility.
export const DB_VERSION = 3;

export interface ArticleContentRow {
  article_id: string;
  content_html: string | null;
  updated_at: string;
}

export interface SyncStateRow {
  key: string;
  value: string;
}

export interface CurationCacheSchema extends DBSchema {
  cards: {
    key: string; // card_id
    value: CachedCard;
    indexes: {
      by_routing: string;
      by_card_date: string;
      by_updated: string;
    };
  };
  wechat_articles: {
    key: string; // article_id
    value: ArticleContentRow;
  };
  wechat_subscriptions: {
    key: number; // id
    value: CachedAccount;
  };
  favorites: {
    key: [string, string]; // [item_type, item_id]
    value: CachedFavorite;
    indexes: { by_created: string };
  };
  sync_state: {
    key: string;
    value: SyncStateRow;
  };
}
