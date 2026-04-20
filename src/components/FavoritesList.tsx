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
  return <span className="inbox-tag" style={{ background: "var(--bg-panel)", color: "var(--text-muted)" }}>原文</span>;
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
        <Star size={12} fill="var(--accent-gold)" style={{ color: "var(--accent-gold)", flexShrink: 0, marginTop: 3 }} />
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
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", flexShrink: 0 }}>
          {favorites?.length ?? 0} 项
        </span>
      </header>

      <div className="list-content">
        {isLoading ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            加载中...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
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
