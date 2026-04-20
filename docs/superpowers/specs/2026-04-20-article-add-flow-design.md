# Article Add Flow Redesign — Design Spec

## Goal

Redesign the article addition flow so that: articles are auto-enqueued on add, "analyzing" articles appear in Inbox with loading state, already-existing articles jump to their card, and temporary accounts show in a collapsible sidebar group (mirroring the subscribed accounts group).

## Backend Changes

### 1. Auto-enqueue on add

In `POST /articles/add`, after creating the article, call `db.enqueue_analysis(sid)` so that every newly added article immediately enters the analysis queue.

### 2. Return article/card info for existing articles

When the article already exists (`new: false`), the response must include `article_id` (short_id) and `card_id` (the serving card, if any) so the frontend can jump to it:

```json
{"status": "ok", "new": false, "article_id": "abc123", "card_id": "xyz789"}
```

If no serving card exists (article still analyzing), return `card_id: null`.

### 3. Remove auto-enqueue on article detail view

Delete the "0 runs → auto-enqueue" logic in the `/articles/{id}` endpoint (server.py lines 956-967). No longer needed since articles are enqueued at add time.

### 4. Inbox API includes "analyzing" articles

`GET /inbox` currently only returns articles with completed cards. Extend it to also return articles that are in the analysis queue (status pending/running) but have no cards yet.

These "analyzing" entries use the same response shape as normal InboxItem but with differences:
- `card_id`: null (no card yet)
- `queue_status`: `"pending"` or `"running"` (new field, null for normal cards)
- `title`: article title (from Article, not ArticleCard)
- `description`: article digest (from Article.digest)
- `routing`: null (not yet determined)
- `read_at`: null (read tracking disabled while analyzing)
- `article_date`, `article_meta`: from the Article record as usual

Normal completed cards continue to have `queue_status: null`.

## Frontend Changes

### 1. Sidebar: Temporary accounts group

Replace the current standalone "临时文章" sidebar entry with a collapsible group that mirrors the "公众号" group structure:

- Section header: "临时文章 (N)" with chevron toggle, appears below the subscribed accounts group
- Expands to show each temporary account with avatar, name, and unread badge
- Clicking a temporary account filters the inbox to that account (same as clicking a subscribed account)
- Each temporary account shows a "订阅" button on hover (existing resubscribe behavior)

Remove the old flat "临时文章" entry and the flat list of temporary accounts below it.

### 2. InboxItem type extension

Add `queue_status: "pending" | "running" | null` to the InboxItem interface. When `queue_status` is non-null, the item represents an article being analyzed.

### 3. InboxList: "analyzing" items rendering

For items with `queue_status !== null`:
- Title row: article title + animated "分析中" tag (replaces routing tag position), pulsing dot or spinner
- Description: article digest
- Meta row: account name + publish time (same as normal items)
- No read/unread styling (always appears as "unread" style but without the checkmark)
- Clicking selects the item normally

### 4. ReaderPane: "analyzing" state

When the selected item has `queue_status !== null` (no card yet):
- SourceBar: shows article meta, "正在分析..." indicator where the routing tag usually goes, no favorite button (nothing to favorite yet)
- Content area: renders article HTML (original content) since there's no card yet
- No "查看原文" button (already showing original)

When analysis completes (item gains a card_id and queue_status becomes null after refetch):
- Automatically transitions to card view
- SourceBar shows routing tag, favorite button, "查看原文" button as normal

### 5. React Query: faster refresh during analysis

When any item in the inbox has `queue_status !== null`:
- Override staleTime to 10 seconds (from default 5 minutes)
- This causes periodic refetches that will pick up completed analysis
- Once no items have queue_status, staleTime returns to normal

### 6. AddArticleModal: jump to existing article

When `POST /articles/add` returns `new: false`:
- If `card_id` is present: close modal, set selectedView to "inbox", set selectedCardId to that card_id
- If `card_id` is null (still analyzing): close modal, navigate to inbox, toast "文章正在分析中"
- Requires passing navigation callbacks into AddArticleModal

### 7. Remove old temporary articles view

- Remove `selectedView: "temporary"` from view union type
- Remove `handleSelectTemporary` handler
- Remove the separate temporary articles rendering path in InboxList (if any)
- The old "临时文章" sidebar click → filter by temporary account is replaced by clicking individual temporary accounts in the new collapsible group
