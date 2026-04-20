# Favorites Feature Design Spec

## Goal

Allow users to bookmark cards and articles for later reference, accessible via a dedicated "收藏" view in the sidebar.

## Data Model

New `favorites` table in PostgreSQL `public` schema:

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | Auto-increment primary key |
| `user_id` | int FK → app_users.id | Which user bookmarked this |
| `item_type` | varchar(16) | `"card"` or `"article"` |
| `item_id` | varchar(255) | card_id or article short_id |
| `created_at` | timestamptz | When the bookmark was created |

Unique constraint: `(user_id, item_type, item_id)` — prevents duplicate bookmarks.

No foreign key to ArticleCard/Article since item_id points to different tables depending on item_type. Application-layer consistency.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/favorites` | Add bookmark. Body: `{ item_type, item_id }` |
| `DELETE` | `/favorites/{item_type}/{item_id}` | Remove bookmark |
| `GET` | `/favorites` | List all bookmarks, ordered by created_at DESC |

### GET /favorites Response

```json
[
  {
    "item_type": "card",
    "item_id": "abc123",
    "created_at": "2026-04-20T12:00:00Z",
    "title": "Card title",
    "description": "Card description...",
    "routing": "ai_curation",
    "article_title": "Parent article title",
    "article_account": "Account name"
  },
  {
    "item_type": "article",
    "item_id": "xyz789",
    "created_at": "2026-04-20T11:00:00Z",
    "title": "Article title",
    "description": "Article digest...",
    "routing": null,
    "article_title": null,
    "article_account": "Account name"
  }
]
```

Server JOINs favorites with the corresponding card/article table to return display-ready data in one query. No pagination initially (bookmark count expected to be small); add `limit/offset` later if needed.

## Frontend: Sidebar

- New "收藏" entry below "全部卡片" in the sidebar, with a star icon
- Badge showing total bookmark count
- Adds `"favorites"` to the `selectedView` union type

## Frontend: Favorites List (Middle Pane)

- Mixed display of cards and articles, sorted by bookmark time descending
- Each item shows a type indicator:
  - Card items: routing pill (AI梳理 / 原文推送), same style as Inbox
  - Article items: "原文" label
- List item structure matches existing InboxList card items: title + description + source/time

## Frontend: Reading Pane (Right Side)

### Bookmarked Card Selected
- Displays card content via existing ReaderPane
- SourceBar additions:
  - Filled star icon (click to un-bookmark)
  - "查看原文" button → opens drawer showing article HTML

### Bookmarked Article Selected
- Displays article HTML content
- SourceBar additions:
  - Filled star icon (click to un-bookmark)
  - "查看卡片" button → opens drawer showing all cards for that article

## Frontend: Bookmark Entry Points

### Card Bookmark (SourceBar)
- In any view where a card is displayed in ReaderPane, SourceBar shows a star icon
- Empty star = not bookmarked, click to bookmark
- Filled star = bookmarked, click to un-bookmark

### Article Bookmark (Article Drawer)
- When viewing article original content in a drawer (opened via "查看原文" from a card), the drawer top bar shows a star icon
- Same empty/filled toggle behavior

## Frontend: Card Separation Improvement (Global)

In all drawers/panels that display multiple cards for one article:
- Add a visible separator line between cards
- Add card index label (e.g., "卡片 1/3")
- Applies to: article preview drawer, favorites article drawer, any future multi-card display

## State Management

### React Query Hooks
- `useFavorites()` — queries `GET /favorites`, returns bookmark list
- `useToggleFavorite()` — mutation calling POST or DELETE, invalidates:
  - `useFavorites` cache (refresh list)
  - `useInbox` cache (so SourceBar star state updates)

### "Is Bookmarked" Check
- Frontend maintains a Set from `useFavorites()` data: keys are `"${item_type}:${item_id}"`
- O(1) lookup, no extra API call needed

## New Components
- `FavoritesList.tsx` — middle pane list component for favorites view
- `FavoriteButton.tsx` — star toggle button, accepts `itemType` + `itemId`, checks Set internally

## Modified Components
- `Sidebar.tsx` — add "收藏" navigation entry
- `App.tsx` — add `"favorites"` to view routing, render FavoritesList when selected
- `ReaderPane.tsx` / SourceBar area — add FavoriteButton for card bookmarking
- Article drawer (原文 view) — add FavoriteButton in drawer top bar for article bookmarking
- All multi-card drawers — add card separator + index label
