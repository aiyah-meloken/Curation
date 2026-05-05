import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, RotateCcw, Trash2, RefreshCw, ChevronRight, ChevronDown, Eye } from "lucide-react";
import {
  fetchDedupQueue, deleteDedupQueueRow, dispatchDedup, retryDedupQueueRow,
  fetchDedupAutoConfig, setDedupAutoConfig, apiFetch,
} from "../lib/api";
import type { DedupQueueRow } from "../types";
import { fmtTime, statusLabel } from "../lib/tableHelpers";
import { SourceCardsDrawer } from "./SourceCardsDrawer";
import { ArticleDrawer } from "./ArticleDrawer";

interface AdminUser {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
}

export function DedupQueuePanel({ onOpenPreview }: { onOpenPreview: () => void }) {
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter]     = useState<string>("");
  const [expanded, setExpanded]         = useState<Set<string>>(new Set());

  // Drawer state — owned by this panel so admins can preview without leaving.
  const [drawerSig, setDrawerSig] = useState<string | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [articleTitle, setArticleTitle] = useState<string | null>(null);
  const [articleUrl, setArticleUrl] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["dedupQueue"] });

  const { data: queue = [], refetch, isFetching } = useQuery<DedupQueueRow[]>({
    queryKey: ["dedupQueue", statusFilter === "all" ? undefined : statusFilter, dateFilter || undefined],
    queryFn: () => fetchDedupQueue({
      status: statusFilter === "all" ? undefined : statusFilter,
      date:   dateFilter || undefined,
    }),
    refetchInterval: 3000,
    staleTime: 2000,
  });

  // User lookup so the group rows can display username/email instead of raw id.
  const [users, setUsers] = useState<AdminUser[]>([]);
  useEffect(() => {
    apiFetch("/users")
      .then((r) => r.json())
      .then((all: AdminUser[]) => setUsers(all))
      .catch(() => {});
  }, []);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const dispatchMut = useMutation({
    mutationFn: (ids: number[]) => dispatchDedup(ids),
    onSuccess: () => invalidate(),
  });
  const retryMut = useMutation({
    mutationFn: (id: number) => retryDedupQueueRow(id),
    onSuccess: () => invalidate(),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteDedupQueueRow(id),
    onSuccess: () => invalidate(),
  });

  const { data: autoConfig } = useQuery({
    queryKey: ["dedupAutoConfig"],
    queryFn: fetchDedupAutoConfig,
    refetchInterval: 5000,
    staleTime: 2000,
  });
  const autoToggleMut = useMutation({
    mutationFn: (enabled: boolean) => setDedupAutoConfig(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dedupAutoConfig"] }),
  });

  // Group rows by (user_id, card_date).
  type Group = {
    key: string;
    user_id: number;
    card_date: string;
    rows: DedupQueueRow[];
    pending: number;
    running: number;
    done: number;
    failed: number;
  };
  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    for (const r of queue) {
      const key = `${r.user_id}|${r.card_date}`;
      let g = map.get(key);
      if (!g) {
        g = { key, user_id: r.user_id, card_date: r.card_date, rows: [],
              pending: 0, running: 0, done: 0, failed: 0 };
        map.set(key, g);
      }
      g.rows.push(r);
      if (r.status === "pending") g.pending++;
      else if (r.status === "running") g.running++;
      else if (r.status === "done") g.done++;
      else if (r.status === "failed") g.failed++;
    }
    return Array.from(map.values()).sort((a, b) => {
      // Newest date first, then user_id asc.
      if (a.card_date !== b.card_date) return a.card_date < b.card_date ? 1 : -1;
      return a.user_id - b.user_id;
    });
  }, [queue]);

  const toggleGroup = (k: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    return next;
  });

  const dispatchGroup = (g: Group) => {
    const ids = g.rows.filter((r) => r.status === "pending").map((r) => r.id);
    if (ids.length > 0) dispatchMut.mutate(ids);
  };

  // Header summaries
  const totalPending = queue.filter((r) => r.status === "pending").length;
  const totalRunning = queue.filter((r) => r.status === "running").length;
  const totalDone    = queue.filter((r) => r.status === "done").length;
  const totalFailed  = queue.filter((r) => r.status === "failed").length;

  const chips: { key: string; label: string }[] = [
    { key: "all",     label: "全部" },
    { key: "pending", label: "待处理" },
    { key: "running", label: "运行中" },
    { key: "done",    label: "完成" },
    { key: "failed",  label: "失败" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Summary bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 16px", borderBottom: "1px solid var(--bg-panel)", background: "var(--bg-base)", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
        <span>共 {queue.length} 条 ({groups.length} 组)</span>
        <span style={{ color: "var(--border)" }}>|</span>
        {totalPending > 0 && <span>待处理 <b style={{ color: "var(--text-primary)" }}>{totalPending}</b></span>}
        {totalRunning > 0 && <span style={{ color: "var(--accent-gold)" }}>运行中 <b>{totalRunning}</b></span>}
        {totalDone    > 0 && <span style={{ color: "var(--accent-green)" }}>完成 <b>{totalDone}</b></span>}
        {totalFailed  > 0 && <span style={{ color: "var(--accent-red)" }}>失败 <b>{totalFailed}</b></span>}
        <div style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
          title={autoConfig?.schedule ?? "daily 05:00 CST"}>
          <input type="checkbox"
            checked={!!autoConfig?.enabled}
            disabled={autoToggleMut.isPending}
            onChange={(e) => autoToggleMut.mutate(e.target.checked)} />
          <span>每日5点自动 {autoConfig?.enabled ? <b style={{ color: "var(--accent-green)" }}>已启用</b> : "未启用"}</span>
          {autoConfig?.last_run_date && (
            <span style={{ color: "var(--text-faint)" }}>· 上次 {autoConfig.last_run_date}</span>
          )}
        </label>
      </div>

      {/* Controls bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--bg-panel)", background: "var(--bg-panel)", flexWrap: "wrap", fontSize: "var(--fs-sm)" }}>
        {chips.map((c) => (
          <button key={c.key} onClick={() => setStatusFilter(c.key)}
            style={{
              background: statusFilter === c.key ? "var(--accent-gold)" : "var(--bg-base)",
              color: statusFilter === c.key ? "#fff" : "var(--text-muted)",
              border: "none", borderRadius: 10, padding: "2px 10px",
              cursor: "pointer", fontSize: "var(--fs-xs)", fontWeight: statusFilter === c.key ? 600 : 400,
            }}>
            {c.label}
          </button>
        ))}

        <span style={{ color: "var(--border)" }}>|</span>

        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
          style={{ background: "var(--bg-panel)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 6px", fontSize: "var(--fs-xs)" }} />
        {dateFilter && (
          <button onClick={() => setDateFilter("")} title="清除日期"
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0 2px", fontSize: "var(--fs-xs)" }}>×</button>
        )}

        <div style={{ flex: 1 }} />

        <button onClick={onOpenPreview}
          style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: "var(--fs-xs)" }}>
          + 预触发
        </button>

        <button onClick={() => refetch()} title="刷新" disabled={isFetching}
          style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 4, padding: "2px 6px", cursor: isFetching ? "default" : "pointer", display: "flex", alignItems: "center" }}>
          <RefreshCw size={12} style={isFetching ? { animation: "spin 1s linear infinite" } : undefined} />
        </button>
      </div>

      {/* Hierarchical body */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {groups.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)" }}>暂无数据</div>
        )}

        {groups.map((g) => {
          const u = userById.get(g.user_id);
          const isOpen = expanded.has(g.key);
          return (
            <div key={g.key}>
              {/* Group header row */}
              <div
                onClick={() => toggleGroup(g.key)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px minmax(160px, 1fr) 110px 1fr 120px",
                  alignItems: "center",
                  padding: "8px 16px",
                  borderBottom: "1px solid var(--bg-panel)",
                  background: isOpen ? "color-mix(in srgb, var(--accent-gold) 6%, transparent)" : "var(--bg-base)",
                  cursor: "pointer",
                  fontSize: "var(--fs-sm)",
                }}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                  {u ? (u.username || u.email) : `user #${g.user_id}`}
                  <span style={{ color: "var(--text-faint)", fontWeight: 400, marginLeft: 6, fontSize: "var(--fs-xs)" }}>#{g.user_id}</span>
                </span>
                <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>{g.card_date}</span>
                <span style={{ display: "flex", gap: 12, fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
                  <span>{g.rows.length} cluster</span>
                  {g.pending > 0 && <span>· 待 <b style={{ color: "var(--text-primary)" }}>{g.pending}</b></span>}
                  {g.running > 0 && <span style={{ color: "var(--accent-gold)" }}>· 跑 <b>{g.running}</b></span>}
                  {g.done    > 0 && <span style={{ color: "var(--accent-green)" }}>· 完 <b>{g.done}</b></span>}
                  {g.failed  > 0 && <span style={{ color: "var(--accent-red)" }}>· 败 <b>{g.failed}</b></span>}
                </span>
                <span style={{ display: "flex", justifyContent: "flex-end", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => dispatchGroup(g)}
                    disabled={g.pending === 0 || dispatchMut.isPending}
                    title="派发该组所有待处理"
                    style={{
                      background: g.pending > 0 ? "var(--accent-green)" : "var(--bg-panel)",
                      border: "1px solid var(--border)",
                      color: g.pending > 0 ? "#fff" : "var(--text-faint)",
                      borderRadius: 4, padding: "2px 8px", cursor: g.pending > 0 ? "pointer" : "default",
                      fontSize: "var(--fs-xs)", fontWeight: 500,
                    }}>
                    派发 ({g.pending})
                  </button>
                </span>
              </div>

              {/* Expanded cluster rows */}
              {isOpen && g.rows.map((row) => (
                <div key={row.id} style={{
                  display: "grid",
                  gridTemplateColumns: "44px 130px 90px 80px 130px 1fr",
                  alignItems: "center",
                  padding: "6px 16px",
                  paddingLeft: 36,
                  borderBottom: "1px solid var(--bg-panel)",
                  background: "var(--bg-panel)",
                  fontSize: "var(--fs-xs)",
                }}>
                  <span style={{ color: "var(--text-faint)" }}>#{row.id}</span>
                  <span style={{ fontFamily: "monospace", color: "var(--text-muted)", letterSpacing: "0.02em" }}>
                    {row.cluster_signature.slice(0, 12)}
                  </span>
                  <span>{statusLabel(row.status, row.error_msg, row.retry_count)}</span>
                  <span style={{ color: row.task_id != null ? "var(--accent-blue)" : "var(--text-faint)" }}>
                    {row.task_id != null ? `#${row.task_id}` : "—"}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>{fmtTime(row.created_at)}</span>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                    <button onClick={() => setDrawerSig(row.cluster_signature)} title="查看原卡片"
                      style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "2px 6px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Eye size={12} /> 查看原卡片
                    </button>
                    {row.status === "pending" && (
                      <button onClick={() => dispatchMut.mutate([row.id])} title="派发"
                        style={{ background: "none", border: "none", color: "var(--accent-green)", cursor: "pointer", padding: 2 }}>
                        <Play size={14} />
                      </button>
                    )}
                    {(row.status === "done" || row.status === "failed") && (
                      <button onClick={() => retryMut.mutate(row.id)} title="重试"
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}>
                        <RotateCcw size={14} />
                      </button>
                    )}
                    <button onClick={() => { if (confirm("删除此队列行?")) deleteMut.mutate(row.id); }} title="删除"
                      style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", padding: 2 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Source-cards drawer (cluster mode) */}
      <SourceCardsDrawer
        clusterSignature={drawerSig}
        isOpen={!!drawerSig}
        onClose={() => setDrawerSig(null)}
        onOpenArticle={(aid, atitle, aurl) => {
          setArticleId(aid);
          setArticleTitle(atitle ?? null);
          setArticleUrl(aurl ?? null);
        }}
      />

      {/* Article drawer reused via override mode */}
      <ArticleDrawer
        isOpen={!!articleId}
        onClose={() => { setArticleId(null); setArticleTitle(null); setArticleUrl(null); }}
        item={null}
        siblingCards={[]}
        onSelectCard={() => {}}
        articleIdOverride={articleId}
        articleTitleOverride={articleTitle}
        articleUrlOverride={articleUrl}
      />
    </div>
  );
}
