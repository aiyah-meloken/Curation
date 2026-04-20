# Article Add Flow Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-enqueue articles on add, show "analyzing" articles in Inbox, jump to existing articles, redesign temporary accounts as collapsible sidebar group.

**Architecture:** Server-side: add enqueue call + extend inbox query to include analyzing articles. Frontend: extend InboxItem type, add analyzing state rendering, redesign sidebar temporary section, update AddArticleModal to navigate on existing article.

**Tech Stack:** PostgreSQL + SQLAlchemy (server), React + React Query + TypeScript (frontend)

---

### Task 1: Server — Auto-enqueue on add + return article info for existing

**Files:**
- Modify: `curation-server/server.py`

- [ ] **Step 1: Add auto-enqueue to POST /articles/add**

In `curation-server/server.py`, find the `add_article` endpoint. At the end, just before `return {"status": "ok", "new": True}` (around line 656), add the enqueue call:

```python
    db.enqueue_analysis(sid)
    return {"status": "ok", "new": True}
```

- [ ] **Step 2: Return article_id and card_id for existing articles**

In the same endpoint, find the early return for existing articles (around line 557-558):

```python
    if db.get_article_by_url(req.url):
        return {"status": "ok", "new": False}
```

Replace with:

```python
    existing = db.get_article_by_url(req.url)
    if existing:
        sid = existing["short_id"]
        # Find the serving card if any
        serving_run_id = existing.get("serving_run_id")
        card_id = None
        if serving_run_id:
            cards = db.get_cards_for_run(sid, serving_run_id)
            if cards:
                card_id = cards[0]["card_id"]
        return {"status": "ok", "new": False, "article_id": sid, "card_id": card_id}
```

- [ ] **Step 3: Remove auto-enqueue from article content endpoint**

Find the `/articles/{article_id}/content` endpoint (around line 952-968). Remove the auto-enqueue block:

```python
    # Exception: no runs at all → auto-enqueue
    runs = db.get_runs_for_article(article_id)
    if not runs:
        db.enqueue_analysis(article_id)
        return {"source": "enqueued", "serving_run_id": None, "raw_word_count": raw_word_count}
```

Replace with:

```python
    runs = db.get_runs_for_article(article_id)
    if not runs:
        return {"source": "enqueued", "serving_run_id": None, "raw_word_count": raw_word_count}
```

- [ ] **Step 4: Verify get_cards_for_run exists**

Check that `db.get_cards_for_run(article_id, run_id)` exists in pg_database.py. If not, use an alternative query. Read the file to confirm.

- [ ] **Step 5: Commit**

```bash
cd curation-server
git add server.py
git commit -m "feat(server): auto-enqueue on article add, return article_id/card_id for existing"
```

---

### Task 2: Server — Extend inbox to include analyzing articles

**Files:**
- Modify: `curation-server/pg_database.py`
- Modify: `curation-server/server.py`

- [ ] **Step 1: Add get_analyzing_articles method to PGDatabase**

Add to `curation-server/pg_database.py` in the PGDatabase class, after `get_inbox_cards`:

```python
    def get_analyzing_articles(self, article_ids: list[str],
                                account_id: int | None = None) -> list[dict]:
        """Get articles currently in analysis queue (pending/running) with no serving card."""
        if not article_ids:
            return []
        with self._session() as s:
            q = (
                s.query(Article, AnalysisQueue)
                .join(AnalysisQueue, AnalysisQueue.article_id == Article.short_id)
                .filter(Article.short_id.in_(article_ids))
                .filter(AnalysisQueue.status.in_(["pending", "running"]))
                .filter(or_(Article.serving_run_id.is_(None), Article.serving_run_id == 0))
            )
            if account_id is not None:
                q = q.filter(Article.account_id == account_id)
            q = q.order_by(AnalysisQueue.updated_at.desc())
            rows = q.all()

        items = []
        for article, queue in rows:
            items.append({
                "card_id": None,
                "article_id": article.short_id,
                "title": article.title,
                "description": article.digest,
                "routing": None,
                "article_date": article.publish_time.strftime("%Y-%m-%d") if article.publish_time else None,
                "read_at": None,
                "queue_status": queue.status,
                "article_meta": {
                    "title": article.title,
                    "account": article.account,
                    "account_id": article.account_id,
                    "author": article.author,
                    "publish_time": article.publish_time.isoformat() if article.publish_time else None,
                    "url": article.url,
                },
            })
        return items
```

- [ ] **Step 2: Add queue_status to existing get_inbox_cards return**

In `get_inbox_cards`, add `"queue_status": None` to each item dict (after `"read_at"` line):

```python
                "read_at": card.read_at.isoformat() if card.read_at else None,
                "queue_status": None,
```

- [ ] **Step 3: Update GET /inbox to merge analyzing articles**

In `curation-server/server.py`, update the `get_inbox` endpoint:

```python
@app.get("/inbox")
async def get_inbox(
    request: Request,
    account_id: int | None = None,
    unread_only: bool = False,
):
    user_id = request.state.user["id"]
    article_ids = _get_user_article_ids(user_id)
    items = db.get_inbox_cards(article_ids, account_id=account_id, unread_only=unread_only)
    if not unread_only:
        analyzing = db.get_analyzing_articles(article_ids, account_id=account_id)
        items = items + analyzing
    return {"items": items}
```

- [ ] **Step 4: Add AnalysisQueue import if needed**

Ensure `AnalysisQueue` is imported in pg_database.py's import from pg_models.

- [ ] **Step 5: Commit**

```bash
cd curation-server
git add pg_database.py server.py
git commit -m "feat(server): include analyzing articles in inbox response with queue_status"
```

---

### Task 3: Frontend — Extend InboxItem type and API

**Files:**
- Modify: `curation-app/src/types.ts`
- Modify: `curation-app/src/lib/api.ts`

- [ ] **Step 1: Add queue_status to InboxItem**

In `curation-app/src/types.ts`, update the InboxItem interface. Add after `read_at`:

```typescript
  queue_status: "pending" | "running" | null;
```

Also change `card_id` to allow null:

```typescript
  card_id: string | null;
```

And change `routing` to allow null:

```typescript
  routing: "ai_curation" | "original_push" | null;
```

- [ ] **Step 2: Update addArticle API to return navigation info**

In `curation-app/src/lib/api.ts`, find if there's an `addArticle` function, or check how AddArticleModal calls the API. The modal calls `apiFetch` directly, so no change needed in api.ts.

- [ ] **Step 3: Commit**

```bash
cd curation-app
git add src/types.ts
git commit -m "feat(app): extend InboxItem with queue_status, nullable card_id and routing"
```

---

### Task 4: Frontend — Render "analyzing" items in InboxList

**Files:**
- Modify: `curation-app/src/components/InboxList.tsx`

- [ ] **Step 1: Update InboxItemRow to handle analyzing state**

In `curation-app/src/components/InboxList.tsx`, add `Loader2` to the lucide-react import:

```typescript
import { Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
```

- [ ] **Step 2: Update routingTag function to handle null + analyzing**

Replace the `routingTag` function:

```typescript
function routingTag(routing: "ai_curation" | "original_push" | null, queueStatus?: "pending" | "running" | null) {
  if (queueStatus) {
    return (
      <span className="inbox-tag" style={{ background: "#1a2332", color: "#58a6ff", display: "inline-flex", alignItems: "center", gap: 3 }}>
        <Loader2 size={10} className="animate-spin" />
        分析中
      </span>
    );
  }
  if (routing === "ai_curation") {
    return <span className="inbox-tag tag-ai">AI总结</span>;
  }
  if (routing === "original_push") {
    return <span className="inbox-tag tag-original">原文</span>;
  }
  return null;
}
```

- [ ] **Step 3: Update InboxItemRow rendering**

Update the InboxItemRow component to pass queue_status to routingTag and handle null card_id:

```typescript
function InboxItemRow({
  item,
  isSelected,
  onSelect,
}: {
  item: InboxItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isAnalyzing = !!item.queue_status;
  return (
    <div
      className={`inbox-item ${isSelected ? "selected" : ""} ${!isAnalyzing && item.read_at ? "read" : ""}`}
      onClick={onSelect}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
        <span className="inbox-item-title" style={{ flex: 1 }}>{item.title}</span>
        {!isAnalyzing && item.read_at && (
          <Check size={12} style={{ color: "#3fb950", flexShrink: 0, marginTop: 3 }} />
        )}
        {routingTag(item.routing, item.queue_status)}
      </div>
      {item.description && (
        <div className="inbox-item-desc">{item.description}</div>
      )}
      <div className="inbox-item-meta">
        {item.article_meta.account}
        {item.article_meta.publish_time && (
          <> · {formatTime(item.article_meta.publish_time)}</>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update list select handler for analyzing items**

In the InboxList component, analyzing items have `card_id: null`. The `onSelect` callback currently expects `(id, type)`. For analyzing items, pass the `article_id` with a new type `"analyzing"`:

Update the InboxItemRow rendering in the groups map:

```typescript
                    <InboxItemRow
                      key={item.card_id ?? `analyzing:${item.article_id}`}
                      item={item}
                      isSelected={
                        item.card_id
                          ? selectedId === item.card_id
                          : selectedId === `analyzing:${item.article_id}`
                      }
                      onSelect={() =>
                        item.card_id
                          ? onSelect(item.card_id, "card")
                          : onSelect(item.article_id, "card")
                      }
                    />
```

- [ ] **Step 5: Commit**

```bash
cd curation-app
git add src/components/InboxList.tsx
git commit -m "feat(app): render analyzing items in InboxList with spinner tag"
```

---

### Task 5: Frontend — ReaderPane analyzing state

**Files:**
- Modify: `curation-app/src/components/ReaderPane.tsx`

- [ ] **Step 1: Add Loader2 import**

Add `Loader2` to the lucide-react import in ReaderPane.tsx.

- [ ] **Step 2: Handle analyzing item in ReaderPane**

The ReaderPane receives `selectedItem: InboxItem | null`. When `selectedItem.queue_status` is non-null, show the article HTML (original content) with an "analyzing" indicator in the SourceBar.

In the inbox item view section (around line 227), before the existing `if (selectedItem)` block, add a check:

```typescript
  // Analyzing item — show original article
  if (selectedItem && selectedItem.queue_status) {
    return (
      <main className="reader-pane">
        <div className="reader-source-bar">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
            <span style={{ color: "#e6edf3", fontWeight: 500, fontSize: "0.88rem", flex: 1 }}>
              {selectedItem.article_meta.title}
            </span>
            <span className="inbox-tag" style={{ background: "#1a2332", color: "#58a6ff", display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.72rem" }}>
              <Loader2 size={10} className="animate-spin" />
              正在分析...
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: "0.78rem", color: "#8b949e", display: "flex", alignItems: "center", gap: 4 }}>
              <span>{selectedItem.article_meta.account}</span>
              {selectedItem.article_meta.author && <><span>·</span><span>{selectedItem.article_meta.author}</span></>}
              {selectedItem.article_meta.publish_time && <><span>·</span><span>{formatTime(selectedItem.article_meta.publish_time)}</span></>}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => openInAppWindow(selectedItem.article_meta.url)}
                style={{
                  background: "none", border: "1px solid #30363d", borderRadius: 6,
                  color: "#8b949e", padding: "3px 10px", cursor: "pointer", fontSize: "0.76rem",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <ExternalLink size={12} /> 微信原文
              </button>
            </div>
          </div>
        </div>
        <div className="reader-content animate-in">
          <ArticleHtmlView articleId={selectedItem.article_id} />
        </div>
      </main>
    );
  }
```

- [ ] **Step 3: Commit**

```bash
cd curation-app
git add src/components/ReaderPane.tsx
git commit -m "feat(app): show article HTML with analyzing indicator for queued items"
```

---

### Task 6: Frontend — Faster refresh during analysis

**Files:**
- Modify: `curation-app/src/hooks/useInbox.ts`

- [ ] **Step 1: Make staleTime dynamic based on analyzing items**

Update the `useInbox` hook to accept an optional `hasAnalyzing` parameter, or better: create a wrapper hook. The simplest approach: after the query returns, check if any items have queue_status and set refetchInterval accordingly.

Replace the `useInbox` function:

```typescript
export function useInbox(accountId?: number | null, unreadOnly?: boolean) {
  const query = useQuery<InboxItem[]>({
    queryKey: ["inbox", accountId ?? "all", unreadOnly ?? false],
    queryFn: async () => {
      const data = await fetchInbox(accountId, unreadOnly);
      return data.items ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Auto-refresh every 10s if any items are analyzing
  const hasAnalyzing = query.data?.some((item) => item.queue_status != null) ?? false;

  return useQuery<InboxItem[]>({
    queryKey: ["inbox", accountId ?? "all", unreadOnly ?? false],
    queryFn: async () => {
      const data = await fetchInbox(accountId, unreadOnly);
      return data.items ?? [];
    },
    staleTime: hasAnalyzing ? 0 : 5 * 60 * 1000,
    refetchInterval: hasAnalyzing ? 10_000 : false,
  });
}
```

Actually, simpler — just use refetchInterval directly in one query:

```typescript
export function useInbox(accountId?: number | null, unreadOnly?: boolean) {
  return useQuery<InboxItem[]>({
    queryKey: ["inbox", accountId ?? "all", unreadOnly ?? false],
    queryFn: async () => {
      const data = await fetchInbox(accountId, unreadOnly);
      return data.items ?? [];
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const items = query.state.data;
      if (items?.some((item) => item.queue_status != null)) {
        return 10_000;
      }
      return false;
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd curation-app
git add src/hooks/useInbox.ts
git commit -m "feat(app): auto-refresh inbox every 10s when articles are analyzing"
```

---

### Task 7: Frontend — AddArticleModal jump to existing

**Files:**
- Modify: `curation-app/src/components/AddArticleModal.tsx`
- Modify: `curation-app/src/App.tsx`

- [ ] **Step 1: Add navigation callback to AddArticleModal props**

Update the Props interface in AddArticleModal.tsx:

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  accounts: { id: number; name: string; avatar_url?: string }[];
  onRefresh: () => void;
  onNavigateToCard?: (cardId: string) => void;
  onNavigateToArticle?: (articleId: string) => void;
}
```

Update the function signature to accept the new props:

```typescript
export function AddArticleModal({ open, onClose, onRefresh, onNavigateToCard, onNavigateToArticle }: Props) {
```

- [ ] **Step 2: Update handleAdd to navigate on existing article**

Replace the success handling in handleAdd:

```typescript
      if (resp.status === "ok") {
        if (!resp.new && resp.card_id) {
          // Existing article with card — jump to it
          setMsg({ type: "ok", text: "✅ 文章已在库中，正在跳转..." });
          onRefresh();
          setTimeout(() => {
            onClose();
            setUrl("");
            setMsg(null);
            onNavigateToCard?.(resp.card_id);
          }, 600);
        } else if (!resp.new && !resp.card_id) {
          // Existing article still analyzing
          setMsg({ type: "ok", text: "✅ 文章正在分析中" });
          onRefresh();
          setTimeout(() => { onClose(); setUrl(""); setMsg(null); }, 1200);
        } else {
          // New article added and enqueued
          setMsg({ type: "ok", text: "✅ 文章已添加，正在分析..." });
          onRefresh();
          setTimeout(() => { onClose(); setUrl(""); setMsg(null); }, 1200);
        }
      } else {
```

- [ ] **Step 3: Pass navigation callbacks from App.tsx**

In App.tsx, find where AddArticleModal is rendered (inside Sidebar.tsx's AddArticleModal). The modal is actually rendered inside Sidebar.tsx. Check where it's rendered and pass the callbacks.

Actually, looking at the code, AddArticleModal is rendered inside Sidebar.tsx (line 333-337). We need to pass navigation callbacks through Sidebar.

Add to SidebarProps:

```typescript
  onNavigateToCard?: (cardId: string) => void;
```

Pass it through to AddArticleModal in Sidebar.tsx.

In App.tsx, add the handler and pass it to Sidebar:

```typescript
  function handleNavigateToCard(cardId: string) {
    setSelectedView("inbox");
    setSelectedAccountId(null);
    setSelectedCardId(cardId);
    setSelectedDiscardedId(null);
    setIsAdminMode(false);
  }
```

```typescript
        onNavigateToCard={handleNavigateToCard}
```

- [ ] **Step 4: Commit**

```bash
cd curation-app
git add src/components/AddArticleModal.tsx src/components/Sidebar.tsx src/App.tsx
git commit -m "feat(app): navigate to existing article card on add, show analyzing status"
```

---

### Task 8: Frontend — Sidebar temporary accounts as collapsible group

**Files:**
- Modify: `curation-app/src/components/Sidebar.tsx`
- Modify: `curation-app/src/App.tsx`

- [ ] **Step 1: Remove "temporary" from selectedView type**

In App.tsx, change:
```typescript
useState<"inbox" | "temporary" | "discarded" | "favorites">("inbox")
```
to:
```typescript
useState<"inbox" | "discarded" | "favorites">("inbox")
```

Remove the `handleSelectTemporary` function.

Remove the `onSelectTemporary` prop from the Sidebar JSX.

- [ ] **Step 2: Update SidebarProps**

In Sidebar.tsx, update the `selectedView` type:
```typescript
  selectedView: "inbox" | "discarded" | "favorites";
```

Remove `onSelectTemporary` from the interface and destructured props.

- [ ] **Step 3: Replace temporary section with collapsible group**

In Sidebar.tsx, replace the entire temporary articles section (the `{temporaryAccounts.length > 0 && (` block, lines ~202-264) with a collapsible group that mirrors the subscribed accounts pattern:

```typescript
        {/* Temporary accounts — collapsible */}
        {!isSidebarCollapsed && temporaryAccounts.length > 0 && (
          <div
            style={{ padding: "4px 14px", fontSize: "0.72rem", color: "#6e7681", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, userSelect: "none", marginTop: 8 }}
            onClick={() => setIsTempListOpen(!isTempListOpen)}
          >
            {isTempListOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>临时文章 ({temporaryAccounts.length})</span>
          </div>
        )}
        {isTempListOpen && temporaryAccounts.map((acc) => {
          const count = unreadCounts[acc.id] ?? 0;
          return (
            <div
              key={acc.id}
              className={`account-item ${selectedView === "inbox" && selectedAccountId === acc.id ? "active" : ""}`}
              onClick={() => onSelectAccount(acc.id)}
              title={isSidebarCollapsed ? acc.name : ""}
              style={{ paddingLeft: isSidebarCollapsed ? 18 : 32, position: "relative" }}
              onMouseEnter={(e) => {
                const btn = e.currentTarget.querySelector(".account-action-btn") as HTMLElement | null;
                if (btn) btn.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget.querySelector(".account-action-btn") as HTMLElement | null;
                if (btn) btn.style.opacity = "0";
              }}
            >
              <img
                src={acc.avatar_url || "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07xvMibqLuWicX7Y16H1xP81v6B0Sraia9zK0dYniamHwJxiaGvH6v97K8K1icYibib9eA/0"}
                alt={acc.name}
                className="account-avatar"
                referrerPolicy="no-referrer"
                style={{ width: 28, height: 28 }}
              />
              {!isSidebarCollapsed && (
                <div className="account-info">
                  <div className="account-name" style={{ fontSize: "0.84rem" }}>{acc.name}</div>
                </div>
              )}
              {count > 0 && <span className="unread-badge">{count}</span>}
              {!isSidebarCollapsed && (
                <button
                  className="btn-icon account-action-btn"
                  title="订阅此公众号"
                  onClick={(e) => handleResubscribe(e, acc.id)}
                  style={{
                    opacity: 0, transition: "opacity 0.15s",
                    padding: 3, flexShrink: 0, background: "none",
                  }}
                >
                  <UserPlus size={13} style={{ color: "#3fb950" }} />
                </button>
              )}
            </div>
          );
        })}
```

- [ ] **Step 4: Add isTempListOpen state**

Add state variable near the other state:

```typescript
const [isTempListOpen, setIsTempListOpen] = useState(true);
```

- [ ] **Step 5: Commit**

```bash
cd curation-app
git add src/components/Sidebar.tsx src/App.tsx
git commit -m "feat(app): redesign temporary accounts as collapsible sidebar group"
```

---

### Task 9: Frontend — Handle analyzing item selection in App.tsx

**Files:**
- Modify: `curation-app/src/App.tsx`

- [ ] **Step 1: Update selectedItem lookup to handle analyzing items**

Currently `selectedItem` is found by matching `card_id`. Analyzing items have `card_id: null`, so we need to also match by `article_id`.

Update the `selectedItem` memo:

```typescript
  const selectedItem: InboxItem | null = useMemo(() => {
    if (!selectedCardId || !inboxItems) return null;
    // Try card_id match first (normal items)
    const byCard = inboxItems.find((i) => i.card_id === selectedCardId);
    if (byCard) return byCard;
    // Try article_id match (analyzing items have no card_id)
    return inboxItems.find((i) => !i.card_id && i.article_id === selectedCardId) ?? null;
  }, [selectedCardId, inboxItems]);
```

- [ ] **Step 2: Update handleListSelect for analyzing items**

The `handleListSelect` function receives IDs from InboxList. For analyzing items, the ID is the article_id. No change needed — the function just sets `selectedCardId` to whatever ID it receives, and the memo above will find it.

- [ ] **Step 3: Auto-transition when analysis completes**

When an analyzing item gets a card (refetch brings back card_id), we want to auto-select the new card. Add an effect:

```typescript
  // Auto-transition: when selected analyzing item gets a card, switch to it
  useEffect(() => {
    if (!selectedCardId || !inboxItems) return;
    // Check if we're looking at an analyzing item that now has a card
    const current = inboxItems.find((i) => !i.card_id && i.article_id === selectedCardId);
    if (current) return; // still analyzing
    // Check if a card appeared for this article
    const withCard = inboxItems.find((i) => i.card_id && i.article_id === selectedCardId);
    if (withCard) {
      setSelectedCardId(withCard.card_id);
    }
  }, [inboxItems, selectedCardId]);
```

- [ ] **Step 4: Commit**

```bash
cd curation-app
git add src/App.tsx
git commit -m "feat(app): handle analyzing item selection and auto-transition on completion"
```

---

### Task 10: Deploy and Test

**Files:** No new files

- [ ] **Step 1: Deploy server**

```bash
rsync -avz --exclude='.venv' --exclude='__pycache__' --exclude='.env' curation-server/ root@47.99.247.46:/opt/curation/curation-server/
ssh root@47.99.247.46 "systemctl restart curation-server"
```

- [ ] **Step 2: Test end-to-end**

1. Add a new article URL → verify it appears in inbox with "分析中" tag
2. Verify the article shows original HTML in reader pane with "正在分析..." indicator
3. Wait for analysis to complete → verify auto-transition to card view
4. Add an already-existing article → verify it jumps to the card
5. Check sidebar temporary accounts group is collapsible
6. Click a temporary account → verify inbox filters correctly

- [ ] **Step 3: Do NOT tag or push a release** (per user instruction)
