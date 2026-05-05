import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, RotateCcw, Trash2, RefreshCw, ChevronRight, ChevronDown, Eye } from "lucide-react";
import {
  fetchDedupQueue, deleteDedupQueueRow, dispatchDedup, retryDedupQueueRow,
  fetchDedupAutoConfig, setDedupAutoConfig, apiFetch,
} from "../lib/api";
import type { DedupQueueRow } from "../types";
import { cmp, fmtTime, SortableHeader, statusLabel } from "../lib/tableHelpers";
import { SourceCardsDrawer } from "./SourceCardsDrawer";
import { ArticleDrawer } from "./ArticleDrawer";

interface AdminUser {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
}

type SortKey = "user_id" | "card_date" | "cluster_count" | "status" | "created_at" | "updated_at";
const GROUP_COLS = "minmax(180px,1fr) 120px 90px 130px 100px 100px 110px";
const CLUSTER_COLS = "70px minmax(220px,1fr) 90px 90px 120px 120px 96px";

interface DedupQueueGroup {
  key: string;
  user_id: number;
  card_date: string;
  rows: DedupQueueRow[];
  status: DedupQueueRow["status"];
  created_at: string;
  updated_at: string;
}

function groupStatus(rows: DedupQueueRow[]): DedupQueueRow["status"] {
  const order: DedupQueueRow["status"][] = ["failed", "running", "queued", "pending", "done"];
  return order.find((s) => rows.some((r) => r.status === s)) ?? "done";
}

function groupStatusSummary(rows: DedupQueueRow[]) {
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  return [
    ["failed", "失败"],
    ["running", "运行中"],
    ["queued", "已排队"],
    ["pending", "待派发"],
    ["done", "完成"],
  ]
    .filter(([s]) => counts[s] > 0)
    .map(([s, label]) => `${label} ${counts[s]}`)
    .join(" · ");
}

export function DedupQueuePanel({ onOpenPreview }: { onOpenPreview: () => void }) {
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter]     = useState<string>("");
  const [expandedKey, setExpandedKey]   = useState<string | null>(null);
  const [sortKey, setSortKey]           = useState<SortKey>("created_at");
  const [sortDir, setSortDir]           = useState<"asc" | "desc">("desc");

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
    refetchInterval: 1000,
    staleTime: 500,
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
    refetchInterval: 1000,
    staleTime: 500,
  });
  const autoToggleMut = useMutation({
    mutationFn: (patch: Partial<{ enabled: boolean; auto_launch: boolean; max_concurrency: number }>) =>
      setDedupAutoConfig(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dedupAutoConfig"] }),
  });

  const grouped = useMemo<DedupQueueGroup[]>(() => {
    const byKey = new Map<string, DedupQueueRow[]>();
    for (const row of queue) {
      const key = `${row.user_id}:${row.card_date}`;
      const rows = byKey.get(key);
      if (rows) rows.push(row);
      else byKey.set(key, [row]);
    }
    const groups = Array.from(byKey.entries()).map(([key, rows]) => ({
      key,
      user_id: rows[0].user_id,
      card_date: rows[0].card_date,
      rows: rows.slice().sort((a, b) => cmp(a.cluster_signature, b.cluster_signature)),
      status: groupStatus(rows),
      created_at: rows.reduce((min, r) => cmp(r.created_at, min) < 0 ? r.created_at : min, rows[0].created_at),
      updated_at: rows.reduce((max, r) => cmp(r.updated_at, max) > 0 ? r.updated_at : max, rows[0].updated_at),
    }));
    const dir = sortDir === "asc" ? 1 : -1;
    return groups.sort((a, b) => {
      const av = sortKey === "cluster_count" ? a.rows.length : (a as any)[sortKey];
      const bv = sortKey === "cluster_count" ? b.rows.length : (b as any)[sortKey];
      return cmp(av, bv) * dir;
    });
  }, [queue, sortDir, sortKey]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  // Header summaries
  const totalPending = queue.filter((r) => r.status === "pending").length;
  const totalQueued  = queue.filter((r) => r.status === "queued").length;
  const totalRunning = queue.filter((r) => r.status === "running").length;
  const totalDone    = queue.filter((r) => r.status === "done").length;
  const totalFailed  = queue.filter((r) => r.status === "failed").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Summary bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 16px", borderBottom: "1px solid var(--bg-panel)", background: "var(--bg-base)", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
        <span>共 {queue.length}</span>
        <span style={{ color: "var(--border)" }}>|</span>
        {totalPending > 0 && <span>待派发 <b style={{ color: "var(--text-primary)" }}>{totalPending}</b></span>}
        {totalQueued  > 0 && <span style={{ color: "var(--accent-blue)" }}>已排队 <b>{totalQueued}</b></span>}
        {totalRunning > 0 && <span style={{ color: "var(--accent-gold)" }}>运行中 <b>{totalRunning}</b></span>}
        {totalDone    > 0 && <span style={{ color: "var(--accent-green)" }}>完成 <b>{totalDone}</b></span>}
        {totalFailed  > 0 && <span style={{ color: "var(--accent-red)" }}>失败 <b>{totalFailed}</b></span>}
        <div style={{ flex: 1 }} />
        {/* Tab1 controls only the cluster auto-preview (whether 5am batch
            generates clusters & enqueues them). Execution scheduler controls
            (auto_launch / max_concurrency) live on Tab2. */}
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
          title={autoConfig?.schedule ?? "daily 05:00 CST"}>
          <input type="checkbox"
            checked={!!autoConfig?.enabled}
            disabled={autoToggleMut.isPending}
            onChange={(e) => autoToggleMut.mutate({ enabled: e.target.checked })} />
          <span>每日5点自动入队 {autoConfig?.enabled ? <b style={{ color: "var(--accent-green)" }}>开</b> : <b style={{ color: "var(--text-muted)" }}>关</b>}</span>
          {autoConfig?.last_run_date && (
            <span style={{ color: "var(--text-faint)" }}>· {autoConfig.last_run_date}</span>
          )}
        </label>
      </div>

      {/* Controls bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderBottom: "1px solid var(--bg-panel)", background: "var(--bg-panel)", flexWrap: "wrap", fontSize: "var(--fs-sm)" }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ background: "var(--bg-panel)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", fontSize: "var(--fs-xs)" }}>
          <option value="all">全部状态</option>
          <option value="pending">待派发</option>
          <option value="queued">已排队</option>
          <option value="running">运行中</option>
          <option value="done">完成</option>
          <option value="failed">失败</option>
        </select>
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

      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: GROUP_COLS, padding: "6px 16px", borderBottom: "1px solid var(--bg-panel)", background: "var(--bg-panel)", color: "var(--text-muted)", fontSize: "var(--fs-xs)", fontWeight: 500, position: "sticky", top: 0, zIndex: 1, alignItems: "center" }}>
          {([
            ["user_id", "用户", false],
            ["card_date", "日期", true],
            ["cluster_count", "Clusters", true],
            ["status", "状态", true],
            ["created_at", "入队时间", true],
            ["updated_at", "更新时间", true],
          ] as [SortKey, string, boolean][]).map(([k, label, center]) => (
            <SortableHeader key={k} label={label}
                            active={sortKey === k}
                            dir={sortDir}
                            onClick={() => toggleSort(k)}
                            align={center ? "center" : undefined} />
          ))}
          <span style={{ textAlign: "center" }}>操作</span>
        </div>

        {grouped.map((group) => {
          const u = userById.get(group.user_id);
          const isOpen = expandedKey === group.key;
          const pendingIds = group.rows.filter((r) => r.status === "pending").map((r) => r.id);
          return (
            <div key={group.key} style={{ borderBottom: "1px solid var(--bg-panel)" }}>
              <div style={{ display: "grid", gridTemplateColumns: GROUP_COLS, padding: "8px 16px", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                  <span
                    onClick={() => setExpandedKey(isOpen ? null : group.key)}
                    style={{ cursor: "pointer", color: "var(--text-muted)", flexShrink: 0, width: 16 }}
                  >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <span style={{ color: "var(--text-primary)", fontSize: "var(--fs-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u ? (u.username || u.email) : `user #${group.user_id}`}
                  </span>
                  <span style={{ color: "var(--text-faint)", fontSize: "var(--fs-xs)", flexShrink: 0 }}>#{group.user_id}</span>
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", textAlign: "center" }}>{group.card_date}</span>
                <span style={{ color: "var(--accent-blue)", fontSize: "var(--fs-sm)", textAlign: "center", fontWeight: 600 }}>{group.rows.length}</span>
                <span title={groupStatusSummary(group.rows)} style={{ textAlign: "center" }}>{statusLabel(group.status)}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", textAlign: "center" }}>{fmtTime(group.created_at)}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", textAlign: "center" }}>{fmtTime(group.updated_at)}</span>
                <div style={{ display: "flex", justifyContent: "center", gap: 2 }}>
                  {pendingIds.length > 0 && (
                    <button onClick={() => dispatchMut.mutate(pendingIds)} title={`派发 ${pendingIds.length} 个待派发 cluster`}
                      style={{ background: "none", border: "none", color: "var(--accent-green)", cursor: "pointer", padding: 2 }}>
                      <Play size={14} />
                    </button>
                  )}
                  <button onClick={() => setExpandedKey(isOpen ? null : group.key)} title={isOpen ? "收起" : "展开 clusters"}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div style={{ background: "var(--bg-panel)", borderTop: "1px solid var(--bg-panel)", padding: "6px 16px 6px 36px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: CLUSTER_COLS, color: "var(--text-muted)", fontSize: "var(--fs-xs)", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                    <span>Queue ID</span><span>Signature</span><span style={{ textAlign: "center" }}>状态</span><span style={{ textAlign: "center" }}>Task</span><span style={{ textAlign: "center" }}>入队</span><span style={{ textAlign: "center" }}>更新</span><span style={{ textAlign: "center" }}>操作</span>
                  </div>
                  {group.rows.map((row) => (
                    <div key={row.id} style={{ display: "grid", gridTemplateColumns: CLUSTER_COLS, padding: "5px 0", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>#{row.id}</span>
                      <a onClick={() => setDrawerSig(row.cluster_signature)}
                        style={{ fontFamily: "monospace", color: "var(--accent-blue)", cursor: "pointer", textDecoration: "none", fontSize: "var(--fs-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.cluster_signature}
                      </a>
                      <span style={{ textAlign: "center" }}>{statusLabel(row.status, row.error_msg, row.retry_count)}</span>
                      <span style={{ color: row.task_id != null ? "var(--accent-blue)" : "var(--text-faint)", fontSize: "var(--fs-sm)", textAlign: "center" }}>
                        {row.task_id != null ? `#${row.task_id}` : "—"}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", textAlign: "center" }}>{fmtTime(row.created_at)}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", textAlign: "center" }}>{fmtTime(row.updated_at)}</span>
                      <div style={{ display: "flex", justifyContent: "center", gap: 2 }}>
                        {row.status === "pending" && (
                          <button onClick={() => dispatchMut.mutate([row.id])} title="加入调度队列"
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
                        <button onClick={() => setDrawerSig(row.cluster_signature)} title="查看原卡片"
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}>
                          <Eye size={14} />
                        </button>
                        <button onClick={() => { if (confirm("删除此 cluster?")) deleteMut.mutate(row.id); }} title="删除"
                          style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", padding: 2 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {grouped.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)" }}>暂无数据</div>
        )}
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
