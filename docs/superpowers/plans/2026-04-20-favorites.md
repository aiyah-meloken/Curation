# Favorites Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to bookmark cards and articles, with a dedicated "收藏" sidebar view and star toggle buttons.

**Architecture:** New `favorites` table with polymorphic `item_type`/`item_id`. Server exposes 3 REST endpoints (GET/POST/DELETE). Frontend adds a sidebar entry, a favorites list component, star buttons in SourceBar and ArticleDrawer, plus a card separator improvement across all multi-card views.

**Tech Stack:** PostgreSQL + SQLAlchemy (server), React + React Query + TypeScript (frontend), lucide-react icons

---

### Task 1: Database Model — Favorite

**Files:**
- Modify: `curation-server/pg_models.py`

- [ ] **Step 1: Add the Favorite model**

Add after the `ArticleCard` class (around line 112) in `curation-server/pg_models.py`:

```python
class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "item_type", "item_id", name="uq_favorites_user_item"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("app_users.id"), nullable=False)
    item_type: Mapped[str] = mapped_column(String(16), nullable=False)  # "card" or "article"
    item_id: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
```

- [ ] **Step 2: Create the table on the production database**

Run on production server (SSH):
```bash
ssh root@47.99.247.46 "psql 'postgresql://postgres:postgres@127.0.0.1:5432/curation' -c \"
CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_users(id),
    item_type VARCHAR(16) NOT NULL,
    item_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_favorites_user_item UNIQUE (user_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS ix_favorites_user_id ON favorites(user_id);
\""
```

- [ ] **Step 3: Commit**

```bash
git add curation-server/pg_models.py
git commit -m "feat(server): add Favorite model for bookmarking cards and articles"
```

---

### Task 2: Database CRUD — Favorites

**Files:**
- Modify: `curation-server/pg_database.py`

- [ ] **Step 1: Add import for Favorite model**

In `curation-server/pg_database.py`, find the import block that imports from `pg_models` (near the top of the file). Add `Favorite` to the import list:

```python
from pg_models import ..., Favorite
```

- [ ] **Step 2: Add `add_favorite` method**

Add to the `PGDatabase` class:

```python
    def add_favorite(self, user_id: int, item_type: str, item_id: str) -> dict:
        """Add a favorite. Returns the created row. Ignores duplicates."""
        with self._session() as s:
            existing = s.query(Favorite).filter(
                Favorite.user_id == user_id,
                Favorite.item_type == item_type,
                Favorite.item_id == item_id,
            ).first()
            if existing:
                return _row(existing)
            fav = Favorite(user_id=user_id, item_type=item_type, item_id=item_id)
            s.add(fav)
            s.commit()
            s.refresh(fav)
            return _row(fav)
```

- [ ] **Step 3: Add `remove_favorite` method**

```python
    def remove_favorite(self, user_id: int, item_type: str, item_id: str) -> bool:
        """Remove a favorite. Returns True if deleted, False if not found."""
        with self._session() as s:
            count = s.query(Favorite).filter(
                Favorite.user_id == user_id,
                Favorite.item_type == item_type,
                Favorite.item_id == item_id,
            ).delete()
            s.commit()
            return count > 0
```

- [ ] **Step 4: Add `get_favorites` method**

```python
    def get_favorites(self, user_id: int) -> list[dict]:
        """Get all favorites for a user, with display info from joined tables."""
        with self._session() as s:
            favs = (
                s.query(Favorite)
                .filter(Favorite.user_id == user_id)
                .order_by(Favorite.created_at.desc())
                .all()
            )

        items = []
        # Batch-fetch card and article info
        card_ids = [f.item_id for f in favs if f.item_type == "card"]
        article_ids = [f.item_id for f in favs if f.item_type == "article"]

        cards_by_id = {}
        if card_ids:
            with self._session() as s:
                rows = (
                    s.query(ArticleCard, Article)
                    .join(Article, ArticleCard.article_id == Article.short_id)
                    .filter(ArticleCard.card_id.in_(card_ids))
                    .all()
                )
                for card, article in rows:
                    cards_by_id[card.card_id] = (card, article)

        articles_by_id = {}
        if article_ids:
            with self._session() as s:
                rows = s.query(Article).filter(Article.short_id.in_(article_ids)).all()
                for article in rows:
                    articles_by_id[article.short_id] = article

        for fav in favs:
            item: dict = {
                "item_type": fav.item_type,
                "item_id": fav.item_id,
                "created_at": fav.created_at.isoformat() if fav.created_at else None,
            }
            if fav.item_type == "card" and fav.item_id in cards_by_id:
                card, article = cards_by_id[fav.item_id]
                item["title"] = card.title
                item["description"] = card.description
                item["routing"] = card.routing or "ai_curation"
                item["article_id"] = card.article_id
                item["article_title"] = article.title
                item["article_account"] = article.account
                item["article_meta"] = {
                    "title": article.title,
                    "account": article.account,
                    "account_id": article.account_id,
                    "author": article.author,
                    "publish_time": article.publish_time.isoformat() if article.publish_time else None,
                    "url": article.url,
                }
            elif fav.item_type == "article" and fav.item_id in articles_by_id:
                article = articles_by_id[fav.item_id]
                item["title"] = article.title
                item["description"] = article.digest
                item["routing"] = None
                item["article_id"] = article.short_id
                item["article_title"] = None
                item["article_account"] = article.account
                item["article_meta"] = {
                    "title": article.title,
                    "account": article.account,
                    "account_id": article.account_id,
                    "author": article.author,
                    "publish_time": article.publish_time.isoformat() if article.publish_time else None,
                    "url": article.url,
                }
            else:
                # Orphaned favorite (card or article deleted)
                item["title"] = "(已删除)"
                item["description"] = None
                item["routing"] = None
                item["article_id"] = None
                item["article_title"] = None
                item["article_account"] = None
                item["article_meta"] = None
            items.append(item)
        return items
```

- [ ] **Step 5: Commit**

```bash
git add curation-server/pg_database.py
git commit -m "feat(server): add favorites CRUD methods to PGDatabase"
```

---

### Task 3: Server API Endpoints — Favorites

**Files:**
- Modify: `curation-server/server.py`

- [ ] **Step 1: Add Pydantic request model**

Add near the other request models (around line 1116, near `MarkAllReadRequest`):

```python
class AddFavoriteRequest(BaseModel):
    item_type: str  # "card" or "article"
    item_id: str
```

- [ ] **Step 2: Add GET /favorites endpoint**

Add after the `/discarded` endpoint block (around line 1153):

```python
@app.get("/favorites")
async def get_favorites(request: Request):
    user_id = request.state.user["id"]
    items = db.get_favorites(user_id)
    return {"items": items}
```

- [ ] **Step 3: Add POST /favorites endpoint**

```python
@app.post("/favorites")
async def add_favorite(req: AddFavoriteRequest, request: Request):
    user_id = request.state.user["id"]
    if req.item_type not in ("card", "article"):
        raise HTTPException(400, "item_type must be 'card' or 'article'")
    result = db.add_favorite(user_id, req.item_type, req.item_id)
    return {"ok": True, "favorite": result}
```

- [ ] **Step 4: Add DELETE /favorites/{item_type}/{item_id} endpoint**

```python
@app.delete("/favorites/{item_type}/{item_id}")
async def remove_favorite(item_type: str, item_id: str, request: Request):
    user_id = request.state.user["id"]
    deleted = db.remove_favorite(user_id, item_type, item_id)
    if not deleted:
        raise HTTPException(404, "Favorite not found")
    return {"ok": True}
```

- [ ] **Step 5: Commit**

```bash
git add curation-server/server.py
git commit -m "feat(server): add GET/POST/DELETE /favorites API endpoints"
```

---

### Task 4: Frontend Types and API Functions

**Files:**
- Modify: `curation-app/src/types.ts`
- Modify: `curation-app/src/lib/api.ts`

- [ ] **Step 1: Add FavoriteItem type**

Add at the end of `curation-app/src/types.ts`:

```typescript
export interface FavoriteItem {
  item_type: "card" | "article";
  item_id: string;
  created_at: string;
  title: string | null;
  description: string | null;
  routing: "ai_curation" | "original_push" | null;
  article_id: string | null;
  article_title: string | null;
  article_account: string | null;
  article_meta: ArticleMeta | null;
}
```

- [ ] **Step 2: Add API functions**

Add at the end of `curation-app/src/lib/api.ts`:

```typescript
export async function fetchFavorites() {
  const resp = await apiFetch("/favorites");
  return resp.json();
}

export async function addFavorite(itemType: "card" | "article", itemId: string) {
  const resp = await apiFetch("/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_type: itemType, item_id: itemId }),
  });
  return resp.json();
}

export async function removeFavorite(itemType: "card" | "article", itemId: string) {
  await apiFetch(`/favorites/${itemType}/${itemId}`, { method: "DELETE" });
}
```

- [ ] **Step 3: Commit**

```bash
git add curation-app/src/types.ts curation-app/src/lib/api.ts
git commit -m "feat(app): add FavoriteItem type and favorites API functions"
```

---

### Task 5: Frontend Hook — useFavorites

**Files:**
- Create: `curation-app/src/hooks/useFavorites.ts`

- [ ] **Step 1: Create the hook file**

Create `curation-app/src/hooks/useFavorites.ts`:

```typescript
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchFavorites, addFavorite, removeFavorite } from "../lib/api";
import type { FavoriteItem } from "../types";

export function useFavorites() {
  return useQuery<FavoriteItem[]>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const data = await fetchFavorites();
      return data.items ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useFavoriteSet() {
  const { data: favorites } = useFavorites();
  return useMemo(() => {
    const set = new Set<string>();
    if (favorites) {
      for (const f of favorites) {
        set.add(`${f.item_type}:${f.item_id}`);
      }
    }
    return set;
  }, [favorites]);
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemType, itemId, isFavorited }: {
      itemType: "card" | "article";
      itemId: string;
      isFavorited: boolean;
    }) => {
      if (isFavorited) {
        await removeFavorite(itemType, itemId);
      } else {
        await addFavorite(itemType, itemId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add curation-app/src/hooks/useFavorites.ts
git commit -m "feat(app): add useFavorites, useFavoriteSet, and useToggleFavorite hooks"
```

---

### Task 6: FavoriteButton Component

**Files:**
- Create: `curation-app/src/components/FavoriteButton.tsx`

- [ ] **Step 1: Create the component**

Create `curation-app/src/components/FavoriteButton.tsx`:

```typescript
import { Star } from "lucide-react";
import { useFavoriteSet, useToggleFavorite } from "../hooks/useFavorites";

interface FavoriteButtonProps {
  itemType: "card" | "article";
  itemId: string;
  /** Optional size override, default 12 */
  size?: number;
}

export function FavoriteButton({ itemType, itemId, size = 12 }: FavoriteButtonProps) {
  const favoriteSet = useFavoriteSet();
  const toggle = useToggleFavorite();
  const isFavorited = favoriteSet.has(`${itemType}:${itemId}`);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle.mutate({ itemType, itemId, isFavorited });
      }}
      disabled={toggle.isPending}
      title={isFavorited ? "取消收藏" : "收藏"}
      style={{
        background: "none",
        border: "1px solid #30363d",
        borderRadius: 6,
        color: isFavorited ? "#e3b341" : "#8b949e",
        padding: "3px 10px",
        cursor: toggle.isPending ? "wait" : "pointer",
        fontSize: "0.76rem",
        display: "flex",
        alignItems: "center",
        gap: 4,
        opacity: toggle.isPending ? 0.6 : 1,
      }}
    >
      <Star size={size} fill={isFavorited ? "#e3b341" : "none"} />
      {isFavorited ? "已收藏" : "收藏"}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add curation-app/src/components/FavoriteButton.tsx
git commit -m "feat(app): add FavoriteButton component with star toggle"
```

---

### Task 7: Add FavoriteButton to ReaderPane SourceBar

**Files:**
- Modify: `curation-app/src/components/ReaderPane.tsx`

- [ ] **Step 1: Add import**

At the top of `curation-app/src/components/ReaderPane.tsx`, add:

```typescript
import { FavoriteButton } from "./FavoriteButton";
```

- [ ] **Step 2: Add `cardId` prop to SourceBar**

Update the SourceBar props interface to include `cardId`:

```typescript
function SourceBar({
  meta,
  routing,
  isDiscarded,
  routingReason,
  onOpenOriginal,
  onOpenDrawer,
  cardId,
}: {
  meta: { title: string; account: string; author: string | null; publish_time: string | null; url: string };
  routing?: "ai_curation" | "original_push";
  isDiscarded: boolean;
  routingReason?: string;
  onOpenOriginal: () => void;
  onOpenDrawer?: () => void;
  cardId?: string;
}) {
```

- [ ] **Step 3: Add FavoriteButton in the button area**

In the SourceBar's button `<div>` (the one with `display: "flex", gap: 8, flexShrink: 0`), add the FavoriteButton before the existing buttons:

```typescript
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {cardId && (
            <FavoriteButton itemType="card" itemId={cardId} />
          )}
          {routing === "ai_curation" && onOpenDrawer && (
```

- [ ] **Step 4: Pass cardId from ReaderPane to SourceBar**

In the inbox item view section of ReaderPane (around line 230), update the SourceBar call:

```typescript
        <SourceBar
          meta={selectedItem.article_meta}
          routing={selectedItem.routing}
          isDiscarded={false}
          onOpenOriginal={() => openInAppWindow(selectedItem.article_meta.url)}
          onOpenDrawer={selectedItem.routing === "ai_curation" ? onOpenDrawer : undefined}
          cardId={selectedItem.card_id}
        />
```

- [ ] **Step 5: Commit**

```bash
git add curation-app/src/components/ReaderPane.tsx
git commit -m "feat(app): add FavoriteButton to ReaderPane SourceBar for card bookmarking"
```

---

### Task 8: Add FavoriteButton to ArticleDrawer

**Files:**
- Modify: `curation-app/src/components/ArticleDrawer.tsx`

- [ ] **Step 1: Add import**

At the top of `curation-app/src/components/ArticleDrawer.tsx`, add:

```typescript
import { FavoriteButton } from "./FavoriteButton";
```

- [ ] **Step 2: Add FavoriteButton in the drawer header**

In the header's right-side `<div>` (the one at line 64 with `display: "flex", alignItems: "center", gap: 8`), add the FavoriteButton before the sibling card selector:

```typescript
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {articleId && (
              <FavoriteButton itemType="article" itemId={articleId} />
            )}
            {siblingCards.length > 1 && (
```

- [ ] **Step 3: Commit**

```bash
git add curation-app/src/components/ArticleDrawer.tsx
git commit -m "feat(app): add FavoriteButton to ArticleDrawer header for article bookmarking"
```

---

### Task 9: FavoritesList Component

**Files:**
- Create: `curation-app/src/components/FavoritesList.tsx`

- [ ] **Step 1: Create the component**

Create `curation-app/src/components/FavoritesList.tsx`:

```typescript
import { useState, useMemo } from "react";
import { Star } from "lucide-react";
import { useFavorites } from "../hooks/useFavorites";
import type { FavoriteItem } from "../types";

function routingTag(routing: string | null) {
  if (routing === "ai_curation") {
    return <span className="inbox-tag tag-ai">AI总结</span>;
  }
  if (routing === "original_push") {
    return <span className="inbox-tag tag-original">原文</span>;
  }
  return <span className="inbox-tag" style={{ background: "#21262d", color: "#8b949e" }}>原文</span>;
}

function formatTime(t: string | null) {
  if (!t) return "";
  return t.replace("T", " ").slice(0, 16);
}

interface FavoritesListProps {
  selectedId: string | null;
  onSelect: (item: FavoriteItem) => void;
  listWidth: number;
}

function FavoriteItemRow({
  item,
  isSelected,
  onSelect,
}: {
  item: FavoriteItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`inbox-item ${isSelected ? "selected" : ""}`}
      onClick={onSelect}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
        <span className="inbox-item-title" style={{ flex: 1 }}>{item.title ?? "(已删除)"}</span>
        <Star size={12} fill="#e3b341" style={{ color: "#e3b341", flexShrink: 0, marginTop: 3 }} />
        {routingTag(item.routing)}
      </div>
      {item.description && (
        <div className="inbox-item-desc">{item.description}</div>
      )}
      <div className="inbox-item-meta">
        {item.article_meta?.account ?? item.article_account ?? ""}
        {item.article_meta?.publish_time && (
          <> · {formatTime(item.article_meta.publish_time)}</>
        )}
      </div>
    </div>
  );
}

export function FavoritesList({ selectedId, onSelect, listWidth }: FavoritesListProps) {
  const { data: favorites, isLoading } = useFavorites();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!favorites) return [];
    if (!search.trim()) return favorites;
    const q = search.trim().toLowerCase();
    return favorites.filter(
      (f) =>
        (f.title && f.title.toLowerCase().includes(q)) ||
        (f.article_account && f.article_account.toLowerCase().includes(q)) ||
        (f.description && f.description.toLowerCase().includes(q))
    );
  }, [favorites, search]);

  return (
    <section className="article-list-pane" style={{ width: listWidth }}>
      <header className="list-header" style={{ padding: "8px 10px", gap: 6, flexDirection: "row", alignItems: "center" }}>
        <div className="search-input-wrapper" style={{ flex: 1 }}>
          <input
            className="search-input"
            placeholder="搜索收藏..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "4px 8px", fontSize: "0.78rem" }}
          />
        </div>
        <span style={{ fontSize: "0.72rem", color: "#8b949e", flexShrink: 0 }}>
          {favorites?.length ?? 0} 项
        </span>
      </header>

      <div className="list-content">
        {isLoading ? (
          <div style={{ padding: 20, textAlign: "center", color: "#8b949e", fontSize: "0.85rem" }}>
            加载中...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#8b949e", fontSize: "0.85rem" }}>
            {search.trim() ? "没有匹配的收藏" : "暂无收藏"}
          </div>
        ) : (
          filtered.map((item) => (
            <FavoriteItemRow
              key={`${item.item_type}:${item.item_id}`}
              item={item}
              isSelected={selectedId === `${item.item_type}:${item.item_id}`}
              onSelect={() => onSelect(item)}
            />
          ))
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add curation-app/src/components/FavoritesList.tsx
git commit -m "feat(app): add FavoritesList component for favorites view"
```

---

### Task 10: Favorites Reading Pane

**Files:**
- Create: `curation-app/src/components/FavoritesReader.tsx`

This component renders the right pane when a favorite is selected. For a favorited card, it shows the card content with a "查看原文" button. For a favorited article, it shows the article HTML with a "查看卡片" button. Both show a filled star button.

- [ ] **Step 1: Create the component**

Create `curation-app/src/components/FavoritesReader.tsx`:

```typescript
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { BookOpen, ExternalLink, X } from "lucide-react";
import { stripFrontmatter, mdComponents } from "../lib/markdown";
import { useCardContent } from "../hooks/useCards";
import { useArticleContent } from "../hooks/useArticles";
import { FavoriteButton } from "./FavoriteButton";
import type { FavoriteItem } from "../types";
import { apiFetch } from "../lib/api";

function formatTime(t: string | null) {
  if (!t) return "";
  return t.replace("T", " ").slice(0, 16);
}

async function openInAppWindow(url: string) {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_url_window", { url });
  } catch {
    window.open(url, "_blank");
  }
}

function routingTag(routing: string | null) {
  if (routing === "ai_curation") {
    return <span className="inbox-tag tag-ai" style={{ fontSize: "0.72rem" }}>AI总结</span>;
  }
  if (routing === "original_push") {
    return <span className="inbox-tag tag-original" style={{ fontSize: "0.72rem" }}>原文</span>;
  }
  return null;
}

/** Drawer for viewing article's cards when a favorited article is selected */
function CardsDrawer({
  isOpen,
  onClose,
  articleId,
}: {
  isOpen: boolean;
  onClose: () => void;
  articleId: string;
}) {
  const [cards, setCards] = useState<{ card_id: string; title: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !articleId) return;
    setLoading(true);
    apiFetch(`/articles/${articleId}/content`)
      .then((r) => r.json())
      .then((data) => {
        setCards(data.cards ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen, articleId]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <button className="btn-icon" onClick={onClose} style={{ padding: 4 }}>
              <X size={18} />
            </button>
            <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "#e6edf3" }}>
              AI 卡片
            </span>
          </div>
        </div>
        <div className="drawer-content">
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8b949e" }}>加载中...</div>
          ) : cards.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8b949e" }}>暂无卡片</div>
          ) : (
            cards.map((card, idx) => (
              <div key={card.card_id}>
                {cards.length > 1 && (
                  <div style={{
                    padding: "8px 0", fontSize: "0.76rem", color: "#8b949e", fontWeight: 600,
                    borderBottom: "1px solid #30363d", marginBottom: 12,
                  }}>
                    卡片 {idx + 1}/{cards.length}
                    {card.title && <span style={{ marginLeft: 8, fontWeight: 400 }}>{card.title}</span>}
                  </div>
                )}
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={mdComponents}>
                    {stripFrontmatter(card.content)}
                  </ReactMarkdown>
                </div>
                {idx < cards.length - 1 && (
                  <hr style={{ margin: "24px 0", border: "none", height: 2, background: "linear-gradient(90deg, transparent, #475569, transparent)" }} />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Drawer for viewing article original HTML when a favorited card is selected */
function OriginalDrawer({
  isOpen,
  onClose,
  articleId,
  articleUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  articleId: string;
  articleUrl: string | null;
}) {
  const { data: articleData, isLoading } = useArticleContent(isOpen ? articleId : null);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const html = articleData?.rawHtml;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <button className="btn-icon" onClick={onClose} style={{ padding: 4 }}>
              <X size={18} />
            </button>
            <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "#e6edf3" }}>
              原文
            </span>
          </div>
          {articleUrl && (
            <button
              className="btn-icon"
              onClick={() => openInAppWindow(articleUrl)}
              title="在浏览器打开"
              style={{ padding: 4 }}
            >
              <ExternalLink size={16} />
            </button>
          )}
        </div>
        <div className="drawer-content">
          {isLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8b949e" }}>加载中...</div>
          ) : html ? (
            <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#8b949e" }}>暂无原文内容</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FavoritesReaderProps {
  selectedFavorite: FavoriteItem | null;
}

export function FavoritesReader({ selectedFavorite }: FavoritesReaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Reset drawer when selection changes
  useEffect(() => { setDrawerOpen(false); }, [selectedFavorite?.item_id]);

  if (!selectedFavorite) {
    return (
      <main className="reader-pane">
        <div className="reader-empty">
          <div className="reader-empty-icon"><BookOpen size={64} /></div>
          <h3>请选择一项收藏</h3>
        </div>
      </main>
    );
  }

  if (selectedFavorite.item_type === "card") {
    return (
      <main className="reader-pane">
        {/* SourceBar */}
        {selectedFavorite.article_meta && (
          <div className="reader-source-bar">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
              <span style={{ color: "#e6edf3", fontWeight: 500, fontSize: "0.88rem", flex: 1 }}>
                {selectedFavorite.article_meta.title}
              </span>
              {routingTag(selectedFavorite.routing)}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontSize: "0.78rem", color: "#8b949e", display: "flex", alignItems: "center", gap: 4 }}>
                <span>{selectedFavorite.article_meta.account}</span>
                {selectedFavorite.article_meta.author && <><span>·</span><span>{selectedFavorite.article_meta.author}</span></>}
                {selectedFavorite.article_meta.publish_time && <><span>·</span><span>{formatTime(selectedFavorite.article_meta.publish_time)}</span></>}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <FavoriteButton itemType="card" itemId={selectedFavorite.item_id} />
                {selectedFavorite.article_id && (
                  <button
                    onClick={() => setDrawerOpen(true)}
                    style={{
                      background: "none", border: "1px solid #30363d", borderRadius: 6,
                      color: "#8b949e", padding: "3px 10px", cursor: "pointer", fontSize: "0.76rem",
                    }}
                  >
                    查看原文
                  </button>
                )}
                {selectedFavorite.article_meta.url && (
                  <button
                    onClick={() => openInAppWindow(selectedFavorite.article_meta!.url)}
                    style={{
                      background: "none", border: "1px solid #30363d", borderRadius: 6,
                      color: "#8b949e", padding: "3px 10px", cursor: "pointer", fontSize: "0.76rem",
                      display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <ExternalLink size={12} /> 微信原文
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="reader-content animate-in">
          <CardContentRenderer cardId={selectedFavorite.item_id} />
        </div>
        {selectedFavorite.article_id && (
          <OriginalDrawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            articleId={selectedFavorite.article_id}
            articleUrl={selectedFavorite.article_meta?.url ?? null}
          />
        )}
      </main>
    );
  }

  // Article favorite
  return (
    <main className="reader-pane">
      {selectedFavorite.article_meta && (
        <div className="reader-source-bar">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
            <span style={{ color: "#e6edf3", fontWeight: 500, fontSize: "0.88rem", flex: 1 }}>
              {selectedFavorite.title}
            </span>
            <span className="inbox-tag" style={{ background: "#21262d", color: "#8b949e", fontSize: "0.72rem" }}>原文</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: "0.78rem", color: "#8b949e", display: "flex", alignItems: "center", gap: 4 }}>
              <span>{selectedFavorite.article_meta.account}</span>
              {selectedFavorite.article_meta.author && <><span>·</span><span>{selectedFavorite.article_meta.author}</span></>}
              {selectedFavorite.article_meta.publish_time && <><span>·</span><span>{formatTime(selectedFavorite.article_meta.publish_time)}</span></>}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <FavoriteButton itemType="article" itemId={selectedFavorite.item_id} />
              <button
                onClick={() => setDrawerOpen(true)}
                style={{
                  background: "none", border: "1px solid #30363d", borderRadius: 6,
                  color: "#8b949e", padding: "3px 10px", cursor: "pointer", fontSize: "0.76rem",
                }}
              >
                查看卡片
              </button>
              {selectedFavorite.article_meta.url && (
                <button
                  onClick={() => openInAppWindow(selectedFavorite.article_meta!.url)}
                  style={{
                    background: "none", border: "1px solid #30363d", borderRadius: 6,
                    color: "#8b949e", padding: "3px 10px", cursor: "pointer", fontSize: "0.76rem",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <ExternalLink size={12} /> 微信原文
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="reader-content animate-in">
        <ArticleHtmlRenderer articleId={selectedFavorite.item_id} />
      </div>
      <CardsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        articleId={selectedFavorite.item_id}
      />
    </main>
  );
}

/** Renders card markdown content */
function CardContentRenderer({ cardId }: { cardId: string }) {
  const { data: cardData, isLoading } = useCardContent(cardId, "source");
  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: "#8b949e" }}>加载中...</div>;
  if (!cardData?.content) return <div style={{ padding: 40, textAlign: "center", color: "#8b949e" }}>暂无内容</div>;
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={mdComponents}>
        {stripFrontmatter(cardData.content)}
      </ReactMarkdown>
    </div>
  );
}

/** Renders article HTML content */
function ArticleHtmlRenderer({ articleId }: { articleId: string }) {
  const { data: articleData, isLoading } = useArticleContent(articleId);
  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: "#8b949e" }}>加载中...</div>;
  const html = articleData?.rawHtml;
  if (!html) return <div style={{ padding: 40, textAlign: "center", color: "#8b949e" }}>暂无原文内容</div>;
  return <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add curation-app/src/components/FavoritesReader.tsx
git commit -m "feat(app): add FavoritesReader component with card/article drawers"
```

---

### Task 11: Wire Favorites into App.tsx and Sidebar

**Files:**
- Modify: `curation-app/src/App.tsx`
- Modify: `curation-app/src/components/Sidebar.tsx`

- [ ] **Step 1: Update Sidebar props and add favorites entry**

In `curation-app/src/components/Sidebar.tsx`:

1. Add `Star` to the lucide-react import:
```typescript
import { Inbox, ChevronLeft, ChevronRight, ChevronDown, Menu, ShieldCheck, LogOut, Paperclip, Trash2, UserMinus, UserPlus, Star } from "lucide-react";
```

2. Update the `SidebarProps` interface — change `selectedView` type and add `onSelectFavorites` and `favoritesCount`:
```typescript
  selectedView: "inbox" | "temporary" | "discarded" | "favorites";
  // ... existing props ...
  onSelectFavorites: () => void;
  favoritesCount: number;
```

3. Add `onSelectFavorites` and `favoritesCount` to the destructured props:
```typescript
export function Sidebar({
  // ... existing props ...
  onSelectFavorites,
  favoritesCount,
}: SidebarProps) {
```

4. Add the favorites entry in the `account-list` div, right after the "全部卡片" Inbox entry (after the closing `</div>` of that item, before the subscribed accounts section):

```typescript
        {/* Favorites */}
        <div
          className={`account-item ${selectedView === "favorites" ? "active" : ""}`}
          onClick={onSelectFavorites}
          title="收藏"
        >
          <div className="account-avatar" style={{ background: "#21262d", display: "flex", alignItems: "center", justifyContent: "center", color: "#e3b341" }}>
            <Star size={16} fill="#e3b341" />
          </div>
          {!isSidebarCollapsed && (
            <div className="account-info">
              <div className="account-name">收藏</div>
            </div>
          )}
          {favoritesCount > 0 && (
            <span className="unread-badge" style={{ background: "#e3b341", color: "#0d1117" }}>{favoritesCount}</span>
          )}
        </div>
```

- [ ] **Step 2: Update App.tsx**

In `curation-app/src/App.tsx`:

1. Add imports:
```typescript
import { FavoritesList } from './components/FavoritesList';
import { FavoritesReader } from './components/FavoritesReader';
import { useFavorites } from './hooks/useFavorites';
import type { FavoriteItem } from './types';
```

2. Update the `selectedView` state type (line 137):
```typescript
const [selectedView, setSelectedView] = useState<"inbox" | "temporary" | "discarded" | "favorites">("inbox");
```

3. Add favorites state and data after the existing state declarations (around line 141):
```typescript
  const [selectedFavorite, setSelectedFavorite] = useState<FavoriteItem | null>(null);
  const { data: favoritesData } = useFavorites();
```

4. Add handler function (after `handleSelectDiscarded`):
```typescript
  function handleSelectFavorites() {
    setSelectedView("favorites");
    setSelectedCardId(null);
    setSelectedDiscardedId(null);
    setSelectedFavorite(null);
  }

  function handleSelectFavoriteItem(item: FavoriteItem) {
    setSelectedFavorite(item);
  }
```

5. Pass new props to Sidebar:
```typescript
      <Sidebar
        // ... existing props ...
        onSelectFavorites={handleSelectFavorites}
        favoritesCount={favoritesData?.length ?? 0}
      />
```

6. Update the middle pane to show FavoritesList when in favorites view. Replace the InboxList block:
```typescript
      {/* Pane 2: List */}
      {selectedView === "favorites" ? (
        <FavoritesList
          selectedId={selectedFavorite ? `${selectedFavorite.item_type}:${selectedFavorite.item_id}` : null}
          onSelect={handleSelectFavoriteItem}
          listWidth={listWidth}
        />
      ) : (
        <InboxList
          items={isDiscardedView ? undefined : inboxItems}
          discardedItems={isDiscardedView ? discardedItems : undefined}
          isDiscardedView={isDiscardedView}
          selectedId={currentSelectedId}
          onSelect={handleListSelect}
          isLoading={isDiscardedView ? isLoadingDiscarded : isLoadingInbox}
          listWidth={listWidth}
        />
      )}
```

7. Update the reader pane to show FavoritesReader when in favorites view. Update the Pane 3 block:
```typescript
      {/* Pane 3: Reader / Admin */}
      {isAdminMode ? (
        <main className="reader-pane" style={{ overflow: "hidden" }}>
          <AdminPane
            adminView={adminView}
            onAdminViewChange={setAdminView}
            currentUser={currentUser}
            onExitAdmin={() => setIsAdminMode(false)}
          />
        </main>
      ) : selectedView === "favorites" ? (
        <FavoritesReader selectedFavorite={selectedFavorite} />
      ) : (
        <ReaderPane
          selectedItem={selectedItem}
          selectedDiscardedItem={selectedDiscardedItem}
          isDiscardedView={isDiscardedView}
          onOpenDrawer={() => setIsDrawerOpen(true)}
        />
      )}
```

- [ ] **Step 3: Commit**

```bash
git add curation-app/src/App.tsx curation-app/src/components/Sidebar.tsx
git commit -m "feat(app): wire favorites view into sidebar and App routing"
```

---

### Task 12: Card Separator Improvement

Improve card separation across all multi-card displays. The existing `ArticleDrawer` doesn't visually separate cards well. The `CardsDrawer` in FavoritesReader already has separators (done in Task 10). This task adds separators to the existing `ArticleDrawer` and any admin panel drawers.

**Files:**
- Modify: `curation-app/src/components/ArticleDrawer.tsx`
- Modify: `curation-app/src/components/ArticlePreviewDrawer.tsx` (admin panel)

- [ ] **Step 1: Check if ArticlePreviewDrawer exists and has multi-card rendering**

Read `curation-app/src/components/ArticlePreviewDrawer.tsx` to understand its current card rendering.

- [ ] **Step 2: Update ArticlePreviewDrawer card separation**

In `curation-app/src/components/ArticlePreviewDrawer.tsx`, find where multiple cards are rendered and add:
- Card index label: `卡片 {idx + 1}/{total}` with the card title
- A separator `<hr>` between cards with `margin: "24px 0", border: "none", height: 2, background: "linear-gradient(90deg, transparent, #475569, transparent)"`

- [ ] **Step 3: Commit**

```bash
git add curation-app/src/components/ArticlePreviewDrawer.tsx
git commit -m "fix(app): improve card separation with index labels and visible dividers"
```

---

### Task 13: Deploy and Test

**Files:** No new files

- [ ] **Step 1: Start the frontend dev server**

```bash
cd curation-app && npm run dev
```

- [ ] **Step 2: Deploy the server**

```bash
rsync -avz --exclude='.venv' --exclude='__pycache__' curation-server/ root@47.99.247.46:/opt/curation/curation-server/
ssh root@47.99.247.46 "systemctl restart curation-server"
```

- [ ] **Step 3: Test end-to-end**

In the browser at http://localhost:1420:
1. Open any card in Inbox — verify star button appears in SourceBar
2. Click star — verify it fills yellow and shows "已收藏"
3. Click "查看原文" — verify star button appears in the ArticleDrawer header
4. Click article star — verify it fills yellow
5. Click "收藏" in sidebar — verify favorites view shows both items
6. Click a favorited card — verify card content loads, "查看原文" button works
7. Click a favorited article — verify article HTML loads, "查看卡片" button works with card separators
8. Click filled star to un-favorite — verify item disappears from list
9. Verify card separators in all multi-card drawers show index labels

- [ ] **Step 4: Build and release**

Bump version in `curation-app/src-tauri/tauri.conf.json`, then:

```bash
cd curation-app
git tag v0.1.52 && git push origin v0.1.52
```

Monitor with `gh run watch`.
