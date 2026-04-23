# CLAUDE.md -- curation-app

## Project Overview

Tauri 2 + React 19 desktop app for a personalized AI news curation platform. Local-first architecture with encrypted SQLite cache synced from server via WebSocket. Inbox model: AI-curated cards as first-class items with three routing paths (AI梳理/原文推送/丢弃). Current version: 0.1.74.

Tech stack: TypeScript, React 19, Tauri 2, Vite 7, Tailwind CSS 4, TanStack React Query 5, lucide-react icons. Rust backend handles DB, sync, crypto, and chat via ACP (Agent Communication Protocol).

## Key Files

### Entry Points

| File | Description |
|------|-------------|
| `src/main.tsx` | React DOM root mount |
| `src/App.tsx` | Main app orchestrator (~550 lines): auth gating, view routing, state management, layout composition |
| `src/App.css` | Global styles and CSS custom properties |

### Components (`src/components/`)

| File | Description |
|------|-------------|
| `Sidebar.tsx` | Left nav: inbox, accounts tree, discarded, favorites, admin toggle, settings |
| `InboxList.tsx` | Middle pane: scrollable card list with unread indicators and favorite badges |
| `ReaderPane.tsx` | Right pane: markdown card reader with favorite/vote/flag/chat controls |
| `SearchList.tsx` | Middle pane variant for full-text search results (Cmd+K) |
| `AdminPane.tsx` | Admin container: tabs for subscriptions, queue, aggregation, invites, users, annotations |
| `ArticleDrawer.tsx` | Slide-over drawer showing original article and sibling cards |
| `ArticlePreviewDrawer.tsx` | Lightweight article preview drawer used in admin queue |
| `CardFrame.tsx` | Layout wrapper that splits reader into card + chat when chat is active |
| `CardVoteBar.tsx` | Thumbs up/down vote bar on cards |
| `CardAnnotationPanel.tsx` | Admin annotation interface for card quality review |
| `ChatInput.tsx` | Chat input box for ACP-based agent conversations |
| `ChatMessages.tsx` | Chat message list rendering for agent conversations |
| `ContextMenu.tsx` | Right-click context menu component |
| `FavoriteButton.tsx` | Star toggle button for favoriting cards |
| `FlagModal.tsx` | Modal for flagging/reporting card issues |
| `FileViewer.tsx` | Raw file viewer for agent workspace files (admin) |
| `LoginScreen.tsx` | Authing-based login screen |
| `AuthCallback.tsx` | Handles Authing OIDC redirect callback |
| `SettingsDrawer.tsx` | Settings panel: appearance, font size, notes path, logout |
| `RunDetailDrawer.tsx` | Admin drawer showing analysis run details and progress |
| `RunProgress.tsx` | Stage-by-stage progress visualization for analysis runs |
| `StreamReplay.tsx` | Replays streaming progress events for completed runs |
| `ArticleQueuePanel.tsx` | Admin panel: analysis queue management (pending/running/done/failed) |
| `AggregationQueuePanel.tsx` | Admin panel: daily aggregation queue management |
| `AdminSubscriptionPanel.tsx` | Admin panel: WeChat account subscription management |
| `AdminAnnotationTab.tsx` | Admin panel: card annotation review tab |
| `InviteManagementPanel.tsx` | Admin panel: invite code generation and tracking |
| `UserManagementPanel.tsx` | Admin panel: user list and role management |
| `AddMenu.tsx` | Dropdown menu for adding articles or subscribing to accounts |
| `AddArticleModal.tsx` | Modal for manually adding an article URL |
| `SubscribeModal.tsx` | Modal for subscribing to a WeChat public account |
| `BizDrawer.tsx` | Drawer showing account (biz) details and article history |
| `UserDrawer.tsx` | Admin drawer showing user details |
| `AdminAnnotationFlag.tsx` | Flag indicator shown on cards that have admin annotations |

### Hooks (`src/hooks/`)

| File | Description |
|------|-------------|
| `useInbox.ts` | Reads inbox items from local SQLite cache; provides `useDiscarded`, `useIsFirstSync`, `useAnalyzingQueue` |
| `useCards.ts` | Fetches card content (markdown) from local cache or server fallback |
| `useArticles.ts` | Fetches article content from local cache or server |
| `useAccounts.ts` | CRUD for WeChat account subscriptions; `usePrimeAccountsCache` seeds local DB |
| `useAdminSubscriptions.ts` | Admin-level subscription management queries |
| `useSync.ts` | `useInitCache` (opens encrypted SQLite), `useSyncManager` (WebSocket + polling sync) |
| `useSearch.ts` | Full-text search across local SQLite cache |
| `useFavorites.ts` | Favorite/unfavorite cards; reads favorites list from cache |
| `useFeedback.ts` | Card vote (thumbs up/down) mutations |
| `useLayout.ts` | Sidebar collapse state, pane widths, resize drag handlers |
| `useAppearance.ts` | Font family/size/theme preferences with localStorage persistence |
| `useFontShortcuts.ts` | Keyboard shortcuts (Cmd+=/Cmd+-) for reader font size |
| `useChat.ts` | ACP chat session management via Tauri commands |
| `useBizArticles.ts` | Fetches article list for a specific WeChat account |
| `useDiscoverableAccounts.ts` | Queries discoverable (not-yet-subscribed) accounts; primes local cache |
| `useDajialaBalance.ts` | Fetches Dajiala API balance for admin display |

### Lib (`src/lib/`)

| File | Description |
|------|-------------|
| `api.ts` | HTTP client with auth header injection; exports `API_BASE`, `WS_BASE`, `authFetch` |
| `authStore.tsx` | Auth state machine (loading/authenticated/unauthenticated); token persistence and refresh |
| `authing.ts` | Authing SDK client configuration |
| `refreshAuth.ts` | Authing refresh_token grant with deduplication of concurrent refresh calls |
| `cache.ts` | TypeScript wrappers around Tauri `invoke()` calls for local SQLite operations |
| `chat.ts` | TypeScript wrappers for ACP chat Tauri commands (sessions, messages, agent config) |
| `markdown.tsx` | Markdown rendering helpers: frontmatter stripping, custom ReactMarkdown components |
| `appearance.ts` | Appearance type definitions (FontBody, ThemeMode) and default settings |
| `tableHelpers.tsx` | Shared admin table utilities: date formatting, sort comparators, sort header components |

### Types

| File | Description |
|------|-------------|
| `src/types.ts` | All shared TypeScript interfaces: Account, Article, InboxItem, QueueEntry, RunEntry, FavoriteItem, etc. |

### Tauri / Rust (`src-tauri/src/`)

| File | Description |
|------|-------------|
| `main.rs` | Tauri app entry point |
| `lib.rs` | Plugin registration, tray icon setup, menu builder, Tauri command registration |
| `commands.rs` | `AppState` struct and all `#[tauri::command]` handlers for DB/sync/auth |
| `db.rs` | Encrypted SQLite via rusqlite: schema, CRUD for cards/accounts/favorites/chat, full-text search |
| `sync.rs` | `SyncClient`: HTTP sync with server, delta-based cache updates |
| `crypto.rs` | PBKDF2-HMAC-SHA256 key derivation for SQLite encryption |
| `acp.rs` | ACP (Agent Communication Protocol) manager: spawns agent subprocess, handles bidirectional messaging |
| `chat_commands.rs` | Tauri commands for chat: create/list sessions, send messages, manage agent configs |

### Config

| File | Description |
|------|-------------|
| `package.json` | npm dependencies and scripts |
| `vite.config.ts` | Vite config with React and Tailwind plugins |
| `tsconfig.json` | TypeScript configuration |
| `src-tauri/tauri.conf.json` | Tauri config: app version (0.1.74), window size, CSP, updater endpoints |
| `src-tauri/Cargo.toml` | Rust dependencies for Tauri backend |

## Commands

```bash
npm install                    # Install frontend dependencies
npm run dev                    # Vite dev server on :1420
npm run tauri dev              # Desktop window with hot-reload
npm run build                  # Vite production build (tsc + vite build)
npm run tauri build            # Package desktop app (local only)
git tag v0.1.XX && git push origin v0.1.XX  # Trigger release (GitHub Actions)
```

## Key Conventions

- **Local-first**: All reads come from local encrypted SQLite; server sync is eventual consistency. The Rust layer owns the DB; React queries it via Tauri `invoke()`.
- **TanStack React Query** for data fetching; local DB is the source of truth. `staleTime` is 5 minutes.
- **Tauri commands** (Rust) handle DB, sync, crypto, and chat. React calls them via `@tauri-apps/api/core invoke()`.
- **WebSocket `/ws/sync`** for push notifications from server; heartbeat polling as fallback.
- **Views**: Inbox / Discarded / Favorites / Search / Admin (role-gated to `role="admin"`).
- **Release builds** are tag-triggered via GitHub Actions (`v*` tags). Never push tags manually without bumping version first.
- **Version in `src-tauri/tauri.conf.json`** must be bumped before tagging a release.
- **Auto-updater** checks for updates every 60 seconds and shows a relaunch banner when ready.

## Gotchas

- `src-tauri/tauri.conf.json` version must match the git tag exactly, or the release build silently fails.
- Auth uses Authing SDK with `tauri://localhost/auth/callback` redirect URI. The redirect flow passes through `AuthCallback.tsx`.
- Chat uses ACP (Agent Communication Protocol) via Tauri Rust subprocess -- not direct HTTP to the server.
- `src/App.tsx` is ~550 lines and is the main state orchestrator. Changes here affect the entire app; be careful with state dependencies.
- Admin panel is only visible to users with `role="admin"`.
- Images use signed static URLs served by the server to avoid needing auth headers in `<img>` tags.
- SQLite cache is encrypted with a key derived from the user's auth token + user ID (PBKDF2). Changing auth flow breaks local cache.
- `Cmd+K` toggles search view. `Cmd+=/Cmd+-` adjusts reader font size.

## Existing Docs

- `docs/auth-system.md` -- Authing OIDC integration details
- `docs/data-architecture.md` -- Local cache schema and sync protocol
- `docs/setup.md` -- Development environment setup
