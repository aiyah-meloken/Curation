import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { fetchCardSources } from "../lib/api";
import { mdComponents, stripFrontmatter } from "../lib/markdown";
import type { CardSource } from "../types";

interface SourceCardsDrawerProps {
  cardId: string | null;
  isOpen: boolean;
  onClose: () => void;
  /** Called when user clicks "查看原文" on a source frame */
  onOpenArticle: (articleId: string) => void;
}

export function SourceCardsDrawer({
  cardId,
  isOpen,
  onClose,
  onOpenArticle,
}: SourceCardsDrawerProps) {
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

  const { data: sources = [], isLoading } = useQuery<CardSource[]>({
    queryKey: ["cardSources", cardId],
    queryFn: () => (cardId ? fetchCardSources(cardId) : Promise.resolve([])),
    enabled: !!cardId && isOpen,
    staleTime: 60_000,
  });

  if (!isOpen || !cardId) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <header style={{
          position: "sticky", top: 0, zIndex: 1,
          background: "var(--bg-base)",
          borderBottom: "1px solid var(--bg-panel)",
          padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ fontWeight: 500 }}>原卡片（{sources.length}）</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </header>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {isLoading && (
            <div style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>加载中…</div>
          )}
          {sources.map((s) => (
            <article key={s.card_id} style={{
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: 16,
              background: "var(--bg-base)",
            }}>
              <h3 style={{ fontSize: "var(--fs-md)", fontWeight: 500, margin: 0, marginBottom: 4 }}>
                {s.title}
              </h3>
              {s.article && (
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: 12 }}>
                  {s.article.account ?? ""}{s.article.publish_time ? ` · ${s.article.publish_time.slice(0, 10)}` : ""}
                </div>
              )}
              <div className="markdown-body" style={{ fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={mdComponents}
                >
                  {stripFrontmatter(s.content ?? s.description ?? "")}
                </ReactMarkdown>
              </div>
              {s.article && (
                <button
                  onClick={() => onOpenArticle(s.article!.short_id)}
                  style={{
                    marginTop: 12,
                    padding: "4px 10px",
                    fontSize: "var(--fs-xs)",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-primary)",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  查看原文
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
