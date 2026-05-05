import { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useArticleContent } from "../hooks/useArticles";
import { FavoriteButton } from "./FavoriteButton";
import { AdminAnnotationFlag } from "./AdminAnnotationFlag";
import { useAuth } from "../lib/authStore";
import { openExternal } from "../lib/platform/url-opener";
import { mdComponents, stripFrontmatter } from "../lib/markdown";
import type { InboxItem } from "../types";

interface ArticleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** When `articleIdOverride` is set, `item` may be null — drawer renders
   * just the article HTML without card-level chrome (siblings, favorites,
   * description, entity chips). Used by SourceCardsDrawer to view a source
   * card's article without that source being in the user's inbox. */
  item: InboxItem | null;
  /** Other cards from the same article (ignored when articleIdOverride set) */
  siblingCards: InboxItem[];
  onSelectCard: (cardId: string) => void;
  /** Force the drawer to fetch + show this article id, regardless of `item`. */
  articleIdOverride?: string | null;
  /** Header title shown when override is in use (no card context). */
  articleTitleOverride?: string | null;
  /** External URL shown in the "open in browser" button when override is in use. */
  articleUrlOverride?: string | null;
}

export function ArticleDrawer({
  isOpen,
  onClose,
  item,
  siblingCards,
  onSelectCard,
  articleIdOverride,
  articleTitleOverride,
  articleUrlOverride,
}: ArticleDrawerProps) {
  const articleId = articleIdOverride ?? item?.article_id ?? null;
  const { data: articleData, isLoading } = useArticleContent(articleId);
  const { state: authState } = useAuth();
  const isAdmin = authState.status === "authenticated" && authState.user.role === "admin";

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Allow opening with only an article id (override mode used by SourceCardsDrawer).
  if (!isOpen || (!item && !articleIdOverride)) return null;

  const html = articleData?.rawHtml;
  const markdown = articleData?.rawMarkdown;
  const headerTitle = articleTitleOverride ?? "原文";
  const externalUrl = articleUrlOverride ?? item?.article_meta.url ?? null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, overflow: "hidden" }}>
            <button className="btn-icon" onClick={onClose} style={{ padding: 4, flexShrink: 0 }}>
              <X size={18} />
            </button>
            <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {headerTitle}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {articleId && (
              <FavoriteButton itemType="article" itemId={articleId} />
            )}
            {item && isAdmin && (item.card_id || item.article_id) && (
              <AdminAnnotationFlag cardId={item.card_id} articleId={item.article_id} />
            )}
            {item && siblingCards.length > 1 && (
              <div style={{ position: "relative" }}>
                <select
                  value={item.card_id ?? ""}
                  onChange={(e) => onSelectCard(e.target.value)}
                  style={{
                    background: "var(--bg-panel)", color: "var(--text-muted)", border: "1px solid var(--border)",
                    borderRadius: 6, padding: "3px 8px", fontSize: "0.76rem", cursor: "pointer",
                    appearance: "auto",
                  }}
                >
                  {siblingCards.map((c) => (
                    <option key={c.card_id ?? c.article_id} value={c.card_id ?? ""}>
                      {c.title.slice(0, 30)}{c.title.length > 30 ? "..." : ""}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: 4 }}>
                  同文章卡片 ({siblingCards.length})
                </span>
              </div>
            )}
            {externalUrl && (
              <button
                className="btn-icon"
                onClick={() => openExternal(externalUrl)}
                title="在浏览器打开"
                style={{ padding: 4 }}
              >
                <ExternalLink size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Card metadata: description + entity chips (only in inbox-card mode) */}
        {item && (item.description || (item.entities && item.entities.length > 0)) && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-base)" }}>
            {item.description && (
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: item.entities?.length ? 8 : 0 }}>
                {item.description}
              </div>
            )}
            {item.entities && item.entities.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {item.entities.map((e) => (
                  <span
                    key={e}
                    style={{
                      display: "inline-block", padding: "2px 8px", fontSize: "0.72rem", lineHeight: 1.4,
                      color: "var(--text-secondary)", background: "var(--bg-elev)",
                      border: "1px solid var(--border)", borderRadius: 4, whiteSpace: "nowrap",
                    }}
                  >
                    {e}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="drawer-content">
          {isLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              加载中...
            </div>
          ) : html ? (
            <div
              className="rich-text-content"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : markdown ? (
            <div className="markdown-body" style={{ padding: "18px 24px" }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={mdComponents}
              >
                {stripFrontmatter(markdown)}
              </ReactMarkdown>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              暂无原文内容
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
