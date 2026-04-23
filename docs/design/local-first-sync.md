# Local-First Sync Architecture

## Overview

The curation app follows a local-first architecture. All user-facing reads come from an encrypted SQLite database stored on disk. The server (PostgreSQL) is the source of truth, and the client achieves eventual consistency through a combination of WebSocket push notifications and periodic polling.

The key principle: **the user never waits for the network**. Reads are instantaneous from the local DB; mutations are applied locally first, then synced to the server in the background. If the network is unavailable, the app continues to function with whatever data was last synced.

### Data flow

```
Server (PostgreSQL)
    |
    |  GET /sync?since=<ts>&cursor=<n>&limit=50
    |  POST /cards/mark-all-read, /favorites/batch, etc.
    v
Rust layer (Tauri commands)
    |  SyncClient: pull pages, push sync_queue
    |  CacheDb: encrypted SQLite via rusqlite + sqlcipher
    v
TypeScript layer (TanStack React Query)
    |  invoke("run_sync"), invoke("get_inbox_cards"), etc.
    v
React UI
```

---

## Initialization

App startup follows a strict sequential flow. Each step gates the next.

### Sequence

1. **Auth state resolves** -- `useAuth()` restores tokens from storage or redirects to login.
2. **QueryClientProvider mounts** -- TanStack React Query client is created with `staleTime: 5min`, `gcTime: 10min`, `refetchOnWindowFocus: false`.
3. **`useInitCache(isLoggedIn, userId)`** runs:
   - Calls `setApiBase(getApiBase())` to configure the Rust HTTP client's base URL.
   - Fetches the DB encryption secret from the server via `GET /auth/cache-secret`. This secret is stable across token rotations (it does not change when the access token refreshes).
   - Calls `initDbWithSecret(secret)` (Tauri command) which either opens an existing encrypted SQLite file or creates a new one. If the existing file cannot be decrypted (wrong key), it is deleted and recreated.
   - Calls `setCacheAuthToken(token)` to pass the current bearer token to the Rust layer for sync HTTP requests.
   - Sets `cacheReady = true`.
4. **`useSyncManager(cacheReady)`** -- gated on `cacheReady` to avoid "not authenticated" errors on cold startup. Connects WebSocket, schedules initial sync after 2 seconds.
5. **Cache priming hooks** fire (see Cache Warming below).

### Why `cacheReady` gates everything

After an auto-update, the app relaunches but the Rust side has no token yet. Without the gate, `useSyncManager` would call `run_sync` before `setCacheAuthToken` has run, producing auth errors. The `cacheReady` flag ensures the DB is open and the token is set before any sync or data access.

---

## Sync Protocol

Sync uses a cursor-based pagination model against the server's `GET /sync` endpoint.

### Request

```
GET /sync?since=<last_sync_ts>&cursor=<offset>&limit=50
Authorization: Bearer <token>
```

- `since` -- ISO 8601 timestamp of the last successful sync. Omitted on first sync (full pull).
- `cursor` -- integer offset for pagination. Omitted for page 1.
- `limit` -- page size, hardcoded to 50.

### Response

```json
{
  "cards": [ { "card_id": "...", "article_id": "...", ... } ],
  "favorites": [ { "item_type": "card", "item_id": "...", "deleted": false, ... } ],
  "sync_ts": "2026-04-23T10:00:00Z",
  "has_more": true
}
```

- `cards` -- upserted into the local `cards` table. Includes metadata and optionally `content_md`.
- `favorites` -- applied as add/delete operations to the local `favorites` table. Entries with `"deleted": true` are removed.
- `sync_ts` -- persisted in `sync_state` table as `last_sync_ts` for the next sync.
- `has_more` -- signals whether additional pages exist.

### Pipelined fetching

The Rust `SyncClient::pull_and_commit` uses pipelined page fetching. It speculatively fires page N+1 while applying page N to the DB, keeping two pages in flight concurrently via `tokio::spawn`. This overlaps network latency with DB write time.

```
Page 1 fetch  ------>|  apply  |
Page 2 fetch  --------->|  apply  |
Page 3 fetch  ------------>|  apply  |
```

If the actual dataset is smaller than the speculative fetch (e.g., only 1 page), the extra fetch returns empty data harmlessly.

### Content backfill (Pass 2)

After all metadata pages are synced, the Rust layer runs a second pass that fetches `content_md` for cards that were synced without it. This uses `POST /cards/content` with batches of 50 card IDs. Cards are processed recent-to-older. Each batch updates the local DB and emits a `sync-page-committed` event.

### Push: sync queue

Local mutations (mark read, mark unread, add/remove favorite) are written to a `sync_queue` table immediately. During each sync cycle, before pulling, the Rust layer drains the queue and pushes changes to the server in batches:

| Action | Server endpoint |
|--------|----------------|
| `mark_read` | `POST /cards/mark-all-read` |
| `mark_unread` | `POST /cards/mark-unread` |
| `add_favorite` | `POST /favorites/batch` |
| `remove_favorite` | `POST /favorites/batch-delete` |

Consecutive queue items with the same action are coalesced into a single batch HTTP request. Failed items have their `retries` counter incremented; items exceeding 5 retries are skipped.

---

## WebSocket Push

### Connection

```
WebSocket: wss://<host>/ws/sync?token=<jwt>
```

Established by `useSyncManager` once `cacheReady` is true.

### Protocol

The server sends a JSON message when new data is available:

```json
{ "type": "sync_available" }
```

On receiving this event, the client calls `triggerSync()` which invokes the full sync cycle (push queue + pull pages).

### Reconnection

- On `ws.onclose`, the client schedules a reconnect after 5 seconds.
- On `ws.onerror`, the close handler fires automatically, triggering the same reconnect logic.
- The `wsRef` is checked before reconnecting to avoid duplicate connections.

---

## Heartbeat Fallback

If the WebSocket disconnects or the server stops sending messages, a polling fallback ensures data stays fresh.

### Mechanism

A 60-second interval checks whether the last WebSocket message was received more than 5 minutes ago. If so, it triggers a full sync and resets the timer.

```typescript
// Simplified logic from useSyncManager
setInterval(() => {
  if (Date.now() - lastMessageTime > 5 * 60 * 1000) {
    triggerSync();
    lastMessageTime = Date.now();
  }
}, 60_000);
```

This means in the worst case (WebSocket fully dead), the app syncs every 5 minutes.

### Initial sync

Separately, an initial sync fires 2 seconds after mount to ensure the app has fresh data on startup, regardless of WebSocket state.

---

## Optimistic Updates

All user mutations are applied to the local SQLite DB immediately, with server sync happening asynchronously in the background.

### Write path

1. User action (e.g., mark card as read) calls a Tauri command (`mark_read`).
2. The Rust command updates the `cards` table AND inserts a row into `sync_queue`.
3. The TanStack mutation's `onSuccess` invalidates the relevant query key (e.g., `["inbox", "local"]`).
4. React re-renders with the updated local data instantly.
5. On the next sync cycle, the `sync_queue` item is pushed to the server.

### Supported optimistic operations

| Operation | Tauri command | Local effect | Sync queue action |
|-----------|--------------|-------------|-------------------|
| Mark read | `mark_read` | Sets `read_at` on card | `mark_read` |
| Mark unread | `mark_unread` | Clears `read_at` on card | `mark_unread` |
| Mark all read | `mark_all_read` | Sets `read_at` on multiple cards | N `mark_read` entries |
| Add favorite | `toggle_favorite` | Inserts into `favorites` | `add_favorite` |
| Remove favorite | `toggle_favorite` | Deletes from `favorites` | `remove_favorite` |

### Conflict resolution

The server is the source of truth. If a sync pull returns a card with a different `read_at` than what is stored locally, the server version wins (upsert replaces the row). In practice, conflicts are rare because each user has their own read state.

---

## Tauri Commands

All Tauri commands are defined in `src-tauri/src/commands.rs` and operate on `AppState`, which holds `Arc<Mutex<Option<CacheDb>>>`.

### Setup commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `init_db_with_secret` | `secret: String` | Opens or creates the encrypted SQLite DB. If decryption fails, deletes and recreates. Runs schema migrations. |
| `set_auth_token` | `token: String` | Stores the bearer token for server HTTP requests during sync. |
| `set_api_base` | `apiBase: String` | Configures the server base URL for the Rust HTTP client. |

### Read commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `get_inbox_cards` | `account?: String, unreadOnly?: bool` | Returns all cards with non-null routing, ordered by `article_date DESC, publish_time DESC`. |
| `get_card_content` | `cardId: String` | Returns `content_md` for a single card, or null if not yet backfilled. |
| `get_favorites` | -- | Returns all favorites ordered by `created_at DESC`. |
| `get_cached_accounts` | -- | Returns all accounts from the local cache. |
| `get_cached_discoverable_accounts` | -- | Returns discoverable (not-yet-subscribed) accounts from local cache. |
| `search_cards` | `query: String` | Full-text search via FTS5 across card title and content. Returns up to 50 results with highlighted snippets. |

### Write commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `mark_read` | `cardId: String` | Sets `read_at = now()` on the card and enqueues a `mark_read` sync action. |
| `mark_unread` | `cardId: String` | Clears `read_at` on the card and enqueues a `mark_unread` sync action. |
| `mark_all_read` | `cardIds: Vec<String>` | Batch mark-read for multiple cards. |
| `toggle_favorite` | `itemType: String, itemId: String, isFavorited: bool` | Adds or removes a favorite and enqueues the corresponding sync action. |
| `save_cached_accounts` | `accounts: Vec<JSON>` | Replaces the entire local accounts table with server data. |
| `save_cached_discoverable_accounts` | `accounts: Vec<JSON>` | Replaces the entire local discoverable accounts table. |

### Sync command

| Command | Parameters | Description |
|---------|-----------|-------------|
| `run_sync` | -- | Executes the full sync cycle: push local queue, pull remote pages, backfill content. Emits `sync-page-committed` events per page. Returns list of changed data keys. |

---

## Cache Warming

On app start, before the first sync completes, several hooks prime the TanStack Query cache with data already in SQLite from previous sessions.

### Hooks and their warming strategy

| Hook | Query key | Warming mechanism |
|------|----------|-------------------|
| `useInbox` | `["inbox", "local", ...]` | Reads directly from `get_inbox_cards` Tauri command. Always reads local DB, never the server. |
| `usePrimeAccountsCache` | `["accounts", "_cache_prime"]` | Runs once (`staleTime: Infinity`). Reads `get_cached_accounts` from SQLite, calls `queryClient.setQueryData(["accounts"], mapped)` to seed the accounts query before the network fetch completes. |
| `usePrimeDiscoverableCache` | `["discoverable", "_cache_prime"]` | Same pattern as accounts: reads local SQLite, seeds the query cache. |
| `useFavorites` | `["favorites", "local"]` | Reads `get_favorites` from SQLite directly. |

### Progressive invalidation

As sync pages arrive, each committed page triggers a `sync-page-committed` Tauri event. The `useSyncManager` hook listens for this event and immediately invalidates the affected query keys:

```typescript
listen("sync-page-committed", (evt) => {
  const keys = evt.payload?.changedKeys ?? ["cards"];
  invalidateFromSyncKeys(keys);
});
```

The key mapping is:

| Rust sync key | Invalidated TanStack query keys |
|--------------|--------------------------------|
| `"cards"` or `"articles"` | `["inbox", "local"]`, `["cardContent"]`, `["favorites", "local"]` |
| `"favorites"` | `["favorites", "local"]` |
| other | `[key]` (pass-through) |

This means the UI updates incrementally as pages arrive rather than waiting for the entire sync to finish. On a first sync with hundreds of cards, the user sees items appearing in batches of 50.

### First-sync indicator

`useIsFirstSync(syncing)` returns `true` when a sync is in progress AND the inbox is empty. The `InboxList` component uses this to show a loading state during the initial data pull.

---

## SQLite Schema

The local database contains these tables:

| Table | Purpose |
|-------|---------|
| `cards` | Card metadata + content. Primary read source for inbox. |
| `cards_fts` | FTS5 virtual table for full-text search over title and content_md. |
| `articles` | Article HTML content cache (lazy-loaded). |
| `favorites` | Local favorites with `synced` flag. |
| `sync_queue` | Pending mutations to push to server. |
| `sync_state` | Key-value store for `last_sync_ts` and migration markers. |
| `accounts` | Cached account/subscription data. |
| `discoverable_accounts` | Cached discoverable accounts. |
| `chat_sessions` | ACP chat session metadata. |
| `chat_messages` | ACP chat message history. |

### Encryption

The database file is encrypted using SQLCipher (via rusqlite with sqlcipher feature). The encryption key is a hex-encoded 256-bit key provided by the server's `GET /auth/cache-secret` endpoint. This secret is stable per user and does not rotate with access tokens, ensuring the local DB survives token refreshes.

### Schema migrations

Migrations are applied automatically in `CacheDb::ensure_schema()`. New columns are added with `ALTER TABLE ... ADD COLUMN` guarded by probing `SELECT <col> FROM <table> LIMIT 0`. When new columns require backfilling existing data, the sync cursor (`last_sync_ts`) is reset to force a full re-pull.
