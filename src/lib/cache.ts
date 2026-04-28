// Types are owned here; both platform implementations import them.
export interface CachedCard {
  card_id: string;
  article_id: string;
  title: string | null;
  article_title: string | null;
  content_md: string | null;
  description: string | null;
  routing: string | null;
  article_date: string | null;
  account: string | null;
  author: string | null;
  url: string | null;
  read_at: string | null;
  updated_at: string;
  publish_time: string | null;
  account_id: number | null;
  biz: string | null;
  cover_url: string | null;
  digest: string | null;
  word_count: number | null;
  is_original: boolean | null;
}

export interface CachedFavorite {
  item_type: "card" | "article";
  item_id: string;
  created_at: string;
  synced: number;
}

export interface SearchResult {
  card_id: string;
  title: string | null;
  article_id: string;
  account: string | null;
  article_date: string | null;
  highlight: string;
  is_favorite: boolean;
}

export interface CachedAccount {
  id: number;
  biz: string;
  name: string | null;
  avatar_url: string | null;
  description: string | null;
  last_monitored_at: string | null;
  article_count: number | null;
  subscription_type: string | null;
  sync_count: number | null;
}

export {
  initDbWithSecret,
  setCacheAuthToken,
  setApiBase,
  getInboxCards,
  getFavorites,
  loadFavoriteItems,
  searchCards,
  markCardRead,
  markCardUnread,
  markAllCardsRead,
  toggleFavoriteLocal,
  getCardContent,
  getCachedAccounts,
  saveCachedAccounts,
  getCachedDiscoverableAccounts,
  saveCachedDiscoverableAccounts,
  runSync,
} from "./platform/cache";
