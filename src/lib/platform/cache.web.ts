import type { CachedCard, CachedFavorite, SearchResult, CachedAccount } from "../cache";
import type { FavoriteItem } from "../../types";
import { apiFetch } from "../api";

export function initDbWithSecret(_secret: string): Promise<void> {
  return Promise.resolve();
}

export function setCacheAuthToken(_token: string): Promise<void> {
  return Promise.resolve();
}

export function setApiBase(_apiBase: string): Promise<void> {
  return Promise.resolve();
}

export async function getInboxCards(
  biz?: string | null,
  unreadOnly?: boolean,
): Promise<CachedCard[]> {
  const params = new URLSearchParams();
  if (biz) params.set("biz", biz);
  if (unreadOnly) params.set("unread_only", "true");
  const qs = params.toString();
  const res = await apiFetch(`/inbox${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`GET /inbox failed: ${res.status}`);
  const data = await res.json();
  // Server's /inbox returns nested { article_meta: { account, biz, ... } }
  // while CachedCard (mirroring /sync + local SQLite) is flat. Flatten here.
  const items: any[] = data.items ?? [];
  return items.map((it: any): CachedCard => {
    const am = it.article_meta ?? {};
    return {
      card_id: it.card_id,
      article_id: it.article_id,
      title: it.title ?? null,
      article_title: am.title ?? null,
      content_md: null,
      description: it.description ?? null,
      routing: it.routing ?? null,
      subtype: it.subtype ?? null,
      article_date: it.article_date ?? null,
      account: am.account ?? null,
      author: am.author ?? null,
      url: am.url ?? null,
      read_at: it.read_at ?? null,
      updated_at: "",
      publish_time: am.publish_time ?? null,
      account_id: null,
      biz: am.biz ?? null,
      cover_url: am.cover_url ?? null,
      digest: am.digest ?? null,
      word_count: null,
      is_original: null,
      // /inbox returns entities as a JSON array; the on-disk shape (mirroring
      // local SQLite TEXT column) stores it as a JSON-string. Re-stringify so
      // both web + native code paths produce the same CachedCard shape.
      entities: it.entities ? JSON.stringify(it.entities) : null,
    };
  });
}

export async function getFavorites(): Promise<CachedFavorite[]> {
  // Kept for API symmetry with the Tauri impl. Web's /favorites already
  // returns the rich, joined shape — see loadFavoriteItems below for the
  // path actually used by the UI.
  const res = await apiFetch(`/favorites`);
  if (!res.ok) throw new Error(`GET /favorites failed: ${res.status}`);
  const data = await res.json();
  const items: any[] = data.items ?? [];
  return items.map((it) => ({
    item_type: it.item_type,
    item_id: it.item_id,
    created_at: it.created_at,
    synced: 1,
  }));
}

export async function loadFavoriteItems(): Promise<FavoriteItem[]> {
  // Web: server's GET /favorites already joins articles/cards and returns
  // the display shape directly. Don't re-join against /inbox — that drops
  // metadata for any favorited card the inbox filter currently excludes.
  const res = await apiFetch(`/favorites`);
  if (!res.ok) throw new Error(`GET /favorites failed: ${res.status}`);
  const data = await res.json();
  const items: any[] = data.items ?? [];
  const sorted = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return sorted.map((it): FavoriteItem => ({
    item_type: it.item_type,
    item_id: it.item_id,
    created_at: it.created_at,
    title: it.title ?? null,
    description: it.description ?? null,
    routing: (it.routing as FavoriteItem["routing"]) ?? null,
    article_id: it.article_id ?? null,
    article_title: it.article_title ?? null,
    article_account: it.article_account ?? null,
    article_meta: it.article_meta ?? null,
  }));
}

export function searchCards(_query: string): Promise<SearchResult[]> {
  // Server has no /cards/search endpoint yet.
  return Promise.resolve([]);
}

export async function markCardRead(cardId: string): Promise<void> {
  const res = await apiFetch(`/cards/${encodeURIComponent(cardId)}/read`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`mark_read failed: ${res.status}`);
}

export async function markCardUnread(cardId: string): Promise<void> {
  const res = await apiFetch(`/cards/mark-unread`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card_ids: [cardId] }),
  });
  if (!res.ok) throw new Error(`mark_unread failed: ${res.status}`);
}

export async function markAllCardsRead(cardIds: string[]): Promise<void> {
  const res = await apiFetch(`/cards/mark-all-read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card_ids: cardIds }),
  });
  if (!res.ok) throw new Error(`mark_all_read failed: ${res.status}`);
}

export async function toggleFavoriteLocal(
  itemType: string,
  itemId: string,
  isFavorited: boolean,
): Promise<void> {
  // `isFavorited` is the CURRENT state (matches Tauri convention in
  // src-tauri/src/commands.rs::toggle_favorite). Toggling means flipping it:
  //   already favorited → remove   (batch-delete)
  //   not favorited     → add      (batch)
  const endpoint = isFavorited ? `/favorites/batch-delete` : `/favorites/batch`;
  const res = await apiFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ item_type: itemType, item_id: itemId }] }),
  });
  if (!res.ok) throw new Error(`toggle_favorite failed: ${res.status}`);
}

export async function getCardContent(cardId: string): Promise<string | null> {
  const res = await apiFetch(`/cards/${encodeURIComponent(cardId)}/content`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`get_card_content failed: ${res.status}`);
  const data = await res.json();
  return data.content ?? null;
}

export async function getCachedAccounts(): Promise<CachedAccount[]> {
  const res = await apiFetch(`/accounts`);
  if (!res.ok) throw new Error(`GET /accounts failed: ${res.status}`);
  const data = await res.json();
  return data.status === "ok" ? data.data : [];
}

export function saveCachedAccounts(_accounts: Record<string, unknown>[]): Promise<number> {
  return Promise.resolve(0);
}

export async function getCachedDiscoverableAccounts(): Promise<Record<string, unknown>[]> {
  const res = await apiFetch(`/accounts/discoverable`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.status === "ok" ? data.data : [];
}

export function saveCachedDiscoverableAccounts(
  _accounts: Record<string, unknown>[],
): Promise<number> {
  return Promise.resolve(0);
}

export function runSync(): Promise<string[]> {
  // Web has no local cache to populate, but the caller (useSyncManager)
  // uses this return value to decide which TanStack Query keys to
  // invalidate. Returning "cards" maps to ["inbox","local"] +
  // ["cardContent"] + ["favorites","local"] — the queries that should
  // refetch when the server pushes sync_available over WebSocket.
  return Promise.resolve(["cards"]);
}
