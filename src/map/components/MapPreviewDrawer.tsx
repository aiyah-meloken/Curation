// Atlas — preview-only drawer.
//
// Migration note: replace this with curation-app's existing
// `<ArticleDrawer item={card} siblingCards={[]} ... />` when wiring into
// the main app. This slim version exists because ArticleDrawer depends on
// `useArticleContent` (which fetches via authed apiFetch) — preview has
// neither auth nor a server.

import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { ArticleContent, MapCard } from "../types";

type Props = {
  open: boolean;
  card: MapCard | null;
  articleContent: ArticleContent | null;
  onClose: () => void;
};

export function MapPreviewDrawer({ open, card, articleContent, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--map-scrim)",
          backdropFilter: "blur(2px)",
          display: open ? "block" : "none",
          zIndex: 40,
          animation: open ? "map-fade-in 220ms ease-out both" : undefined,
        }}
      />
      {/* Drawer */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "60vw",
          minWidth: 600,
          background: "var(--map-vellum)",
          borderLeft: "3px double var(--map-ink)",
          padding: "36px 48px",
          overflow: "auto",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform .32s cubic-bezier(.16,1,.3,1)",
          zIndex: 41,
          boxShadow: "var(--map-shadow-drawer)",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 22,
            right: 28,
            width: 32,
            height: 32,
            border: "1px solid var(--map-ink)",
            background: "transparent",
            fontFamily: "var(--map-display)",
            fontSize: 18,
            cursor: "pointer",
            color: "var(--map-ink)",
            lineHeight: 1,
          }}
          aria-label="Close"
        >
          ×
        </button>

        {card && (
          <>
            <div
              style={{
                fontFamily: "var(--map-mono)",
                fontSize: 10,
                letterSpacing: "0.22em",
                color: "var(--map-rust)",
                textTransform: "uppercase",
              }}
            >
              {card.article_meta?.account ?? "—"} ·{" "}
              {(card.article_date ?? "").replace(/-/g, " · ")}
            </div>
            <h2
              style={{
                fontFamily: "var(--map-display)",
                fontWeight: 400,
                fontSize: 30,
                margin: "8px 0 6px",
                lineHeight: 1.2,
                color: "var(--map-ink)",
              }}
            >
              {card.title}
            </h2>
            <div
              style={{
                fontFamily: "var(--map-serif)",
                fontStyle: "italic",
                color: "var(--map-ink-2)",
                fontSize: 14,
                marginBottom: card.entities?.length ? 12 : 24,
                paddingBottom: 16,
                borderBottom: card.entities?.length
                  ? "none"
                  : "1px solid var(--map-ink-2)",
              }}
            >
              {card.description ?? ""}
            </div>

            {/* Entities — small chips showing the card's named entities. These
                are what drive the cross-card "trade route" connections on the
                map. */}
            {card.entities && card.entities.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 24,
                  paddingBottom: 16,
                  borderBottom: "1px solid var(--map-ink-2)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--map-mono)",
                    fontSize: 9,
                    letterSpacing: "0.22em",
                    color: "var(--map-rust)",
                    textTransform: "uppercase",
                    alignSelf: "center",
                    marginRight: 4,
                  }}
                >
                  实体 ·
                </span>
                {card.entities.map((e) => (
                  <span
                    key={e}
                    style={{
                      fontFamily: "var(--map-serif)",
                      fontStyle: "italic",
                      fontSize: 12,
                      color: "var(--map-crimson)",
                      background: "var(--map-vellum)",
                      border: "1px solid var(--map-crimson)",
                      padding: "2px 8px",
                      borderRadius: 2,
                    }}
                  >
                    {e}
                  </span>
                ))}
              </div>
            )}
            <div
              style={{
                fontFamily: "var(--map-serif)",
                fontSize: 16,
                lineHeight: 1.75,
                color: "var(--map-ink)",
              }}
            >
              {articleContent ? (
                <ReactMarkdown
                  components={{
                    h1: (p) => (
                      <h1
                        style={{
                          fontFamily: "var(--map-display)",
                          fontStyle: "italic",
                          fontWeight: 400,
                          fontSize: 26,
                          margin: "20px 0 8px",
                        }}
                        {...p}
                      />
                    ),
                    h2: (p) => (
                      <h2
                        style={{
                          fontFamily: "var(--map-display)",
                          fontStyle: "italic",
                          fontWeight: 400,
                          fontSize: 20,
                          margin: "20px 0 8px",
                        }}
                        {...p}
                      />
                    ),
                    p: (p) => <p style={{ margin: "0 0 14px" }} {...p} />,
                    ul: (p) => (
                      <ul
                        style={{ margin: "8px 0 14px 1.4em", padding: 0 }}
                        {...p}
                      />
                    ),
                    li: (p) => <li style={{ margin: "4px 0" }} {...p} />,
                    strong: (p) => (
                      <strong
                        style={{ color: "var(--map-ink)" }}
                        {...p}
                      />
                    ),
                    blockquote: (p) => (
                      <blockquote
                        style={{
                          borderLeft: "3px solid var(--map-rust)",
                          paddingLeft: 14,
                          marginLeft: 0,
                          fontStyle: "italic",
                          color: "var(--map-ink-2)",
                        }}
                        {...p}
                      />
                    ),
                  }}
                >
                  {articleContent.content_md}
                </ReactMarkdown>
              ) : (
                <p style={{ fontStyle: "italic", color: "var(--map-ink-2)" }}>
                  原文加载中…
                </p>
              )}
            </div>
            <p
              style={{
                fontFamily: "var(--map-serif)",
                fontStyle: "italic",
                color: "var(--map-ink-2)",
                marginTop: 32,
                paddingTop: 16,
                borderTop: "1px solid var(--map-ink-2)",
                fontSize: 13,
              }}
            >
              — 来自当日远征记录，由 Curation 舆图汇编 —
            </p>
          </>
        )}
      </aside>
    </>
  );
}
