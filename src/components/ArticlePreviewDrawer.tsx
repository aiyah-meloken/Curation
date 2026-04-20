import { useState } from "react";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { stripFrontmatter, mdComponents } from "../lib/markdown";
import { useArticleContent } from "../hooks/useArticles";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

function RoutingPill({ routing }: { routing: string | null }) {
  if (!routing) {
    return <span style={{ background: "#1c1c1c", color: "#484f58", padding: "1px 8px", borderRadius: 10, fontSize: "0.68rem" }}>未推送</span>;
  }
  const m: Record<string, { text: string; bg: string; color: string }> = {
    ai_curation:   { text: "AI梳理",  bg: "#1a3a1a", color: "#3fb950" },
    original_push: { text: "原文推送", bg: "#1a3a1a", color: "#3fb950" },
    discard:       { text: "丢弃",     bg: "#2d2a1a", color: "#d29922" },
  };
  const v = m[routing] ?? { text: routing, bg: "#1c1c1c", color: "#484f58" };
  return <span style={{ background: v.bg, color: v.color, padding: "1px 8px", borderRadius: 10, fontSize: "0.68rem" }}>{v.text}</span>;
}

function CardMarkdownView({ articleId }: { articleId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["articleServingCard", articleId],
    queryFn: async () => {
      const res = await apiFetch(`/articles/${articleId}/content`);
      return res.json();
    },
    enabled: !!articleId,
  });

  if (isLoading) return <div style={{ padding: 20, color: "#8b949e" }}>加载中...</div>;

  const markdown = data?.markdown;
  if (!markdown) return <div style={{ padding: 20, color: "#8b949e" }}>暂无卡片内容</div>;

  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={mdComponents}>
        {stripFrontmatter(markdown)}
      </ReactMarkdown>
    </div>
  );
}

function ArticleHtmlView({ articleId }: { articleId: string }) {
  const { data, isLoading } = useArticleContent(articleId);

  if (isLoading) return <div style={{ padding: 20, color: "#8b949e" }}>加载中...</div>;

  const html = data?.rawHtml;
  if (!html) return <div style={{ padding: 20, color: "#8b949e" }}>暂无原文内容</div>;

  return <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: html }} />;
}

interface ArticlePreviewDrawerProps {
  articleId: string | null;
  routing: string | null;
  onClose: () => void;
}

export function ArticlePreviewDrawer({ articleId, routing, onClose }: ArticlePreviewDrawerProps) {
  const [tab, setTab] = useState<"user" | "original">("user");

  if (!articleId) return null;

  const isNotPushed = !routing || routing === "discard";

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "65%",
        background: "#0d1117", borderLeft: "1px solid #30363d", zIndex: 101,
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.2s ease-out",
      }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#e6edf3", fontWeight: 500, fontSize: "0.88rem" }}>内容预览</span>
            <RoutingPill routing={routing} />
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #21262d", padding: "0 16px" }}>
          <button onClick={() => setTab("user")}
            style={{ background: "none", border: "none", color: tab === "user" ? "#e6edf3" : "#8b949e", padding: "8px 12px", cursor: "pointer", fontSize: "0.82rem", borderBottom: tab === "user" ? "2px solid #58a6ff" : "2px solid transparent" }}>
            用户视角
          </button>
          <button onClick={() => setTab("original")}
            style={{ background: "none", border: "none", color: tab === "original" ? "#e6edf3" : "#8b949e", padding: "8px 12px", cursor: "pointer", fontSize: "0.82rem", borderBottom: tab === "original" ? "2px solid #58a6ff" : "2px solid transparent" }}>
            文章原文
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {tab === "user" ? (
            isNotPushed ? (
              <div style={{ padding: 40, textAlign: "center", color: "#8b949e" }}>该文章未推送给用户</div>
            ) : (
              <CardMarkdownView articleId={articleId} />
            )
          ) : (
            <ArticleHtmlView articleId={articleId} />
          )}
        </div>
      </div>
    </>
  );
}
