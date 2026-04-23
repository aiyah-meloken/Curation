import { useState } from "react";
import { useAdminCards } from "../hooks/useFeedback";
import { ArticlePreviewDrawer } from "./ArticlePreviewDrawer";

type Order = "recent" | "downvotes" | "annotations";

export function AdminAnnotationTab() {
  const [hasAnnotation, setHasAnnotation] = useState<boolean | undefined>(undefined);
  const [hasDownvote, setHasDownvote] = useState<boolean | undefined>(undefined);
  const [routing, setRouting] = useState<string | undefined>(undefined);
  const [order, setOrder] = useState<Order>("recent");

  const [previewArticleId, setPreviewArticleId] = useState<string | null>(null);
  const [previewRouting, setPreviewRouting] = useState<string | null>(null);

  const { data = [], isLoading } = useAdminCards(
    {
      has_annotation: hasAnnotation,
      has_downvote: hasDownvote,
      routing,
      order,
      limit: 50,
    },
    true,
  );

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <label>
          <input
            type="checkbox"
            checked={hasAnnotation === true}
            onChange={(e) => setHasAnnotation(e.target.checked ? true : undefined)}
          />
          只看已标注
        </label>
        <label>
          <input
            type="checkbox"
            checked={hasDownvote === true}
            onChange={(e) => setHasDownvote(e.target.checked ? true : undefined)}
          />
          只看有点踩
        </label>
        <select value={routing ?? ""} onChange={(e) => setRouting(e.target.value || undefined)}>
          <option value="">全部路由</option>
          <option value="ai_curation">AI总结</option>
          <option value="original_push">原文</option>
          <option value="discarded">丢弃</option>
        </select>
        <select value={order} onChange={(e) => setOrder(e.target.value as Order)}>
          <option value="recent">最近</option>
          <option value="downvotes">点踩多</option>
          <option value="annotations">标注多</option>
        </select>
      </div>
      {isLoading ? (
        <div>加载中...</div>
      ) : data.length === 0 ? (
        <div style={{ color: "var(--text-muted)" }}>无结果</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">标题</th>
              <th align="left">路由</th>
              <th>📌</th>
              <th>👍</th>
              <th>👎</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr
                key={c.card_id}
                onClick={() => {
                  setPreviewArticleId(c.article_id);
                  setPreviewRouting(c.routing);
                }}
                style={{ cursor: "pointer", borderTop: "1px solid var(--border)" }}
              >
                <td>{c.title}</td>
                <td>{c.routing ?? "-"}</td>
                <td align="center">{c.annotation_count}</td>
                <td align="center">{c.upvote_count}</td>
                <td align="center">{c.downvote_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ArticlePreviewDrawer
        articleId={previewArticleId}
        routing={previewRouting}
        onClose={() => setPreviewArticleId(null)}
      />
    </div>
  );
}
