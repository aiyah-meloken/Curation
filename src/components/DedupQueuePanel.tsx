import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, RotateCcw, Trash2, RefreshCw } from "lucide-react";
import {
  fetchDedupQueue, deleteDedupQueueRow, dispatchDedup, retryDedupQueueRow,
} from "../lib/api";
import type { DedupQueueRow } from "../types";
import {
  fmtTime, cmp, statusLabel, SortableHeader,
} from "../lib/tableHelpers";

type SortKey = "user_id" | "card_date" | "cluster_signature" | "status" | "task_id" | "created_at";

export function DedupQueuePanel({ onOpenPreview }: { onOpenPreview: () => void }) {
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter]     = useState<string>("");
  const [sortKey, setSortKey]           = useState<SortKey>("created_at");
  const [sortDir, setSortDir]           = useState<"asc" | "desc">("desc");
  const [selected, setSelected]         = useState<Set<number>>(new Set());

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

  const dispatchMut = useMutation({
    mutationFn: (ids: number[]) => dispatchDedup(ids),
    onSuccess: () => { setSelected(new Set()); invalidate(); },
  });

  const retryMut = useMutation({
    mutationFn: (id: number) => retryDedupQueueRow(id),
    onSuccess: () => invalidate(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteDedupQueueRow(id),
    onSuccess: () => { setSelected((prev) => { const s = new Set(prev); return s; }); invalidate(); },
  });

  const filtered = queue.slice().sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    return cmp((a as never)[sortKey], (b as never)[sortKey]) * dir;
  });

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const allVisibleIds = filtered.map((r) => r.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allVisibleIds));
    }
  };

  const toggleRow = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Count summaries
  const pending = queue.filter((r) => r.status === "pending").length;
  const running = queue.filter((r) => r.status === "running").length;
  const done    = queue.filter((r) => r.status === "done").length;
  const failed  = queue.filter((r) => r.status === "failed").length;

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
        <span>共 {queue.length}</span>
        <span style={{ color: "var(--border)" }}>|</span>
        {pending > 0 && <span>待处理 <b style={{ color: "var(--text-primary)" }}>{pending}</b></span>}
        {running > 0 && <span style={{ color: "var(--accent-gold)" }}>运行中 <b>{running}</b></span>}
        {done    > 0 && <span style={{ color: "var(--accent-green)" }}>完成 <b>{done}</b></span>}
        {failed  > 0 && <span style={{ color: "var(--accent-red)" }}>失败 <b>{failed}</b></span>}
      </div>

      {/* Controls bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--bg-panel)", background: "var(--bg-panel)", flexWrap: "wrap", fontSize: "var(--fs-sm)" }}>

        {/* Filter chips */}
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

        {/* Date filter */}
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
          style={{ background: "var(--bg-panel)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 6px", fontSize: "var(--fs-xs)" }} />
        {dateFilter && (
          <button onClick={() => setDateFilter("")} title="清除日期"
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0 2px", fontSize: "var(--fs-xs)" }}>×</button>
        )}

        <div style={{ flex: 1 }} />

        {/* + 预触发 */}
        <button onClick={onOpenPreview}
          style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: "var(--fs-xs)" }}>
          + 预触发
        </button>

        {/* 批量派发 */}
        <button
          onClick={() => dispatchMut.mutate(Array.from(selected))}
          disabled={selected.size === 0 || dispatchMut.isPending}
          style={{
            background: selected.size > 0 ? "var(--accent-green)" : "var(--bg-base)",
            border: "1px solid var(--border)",
            color: selected.size > 0 ? "#fff" : "var(--text-faint)",
            borderRadius: 4, padding: "2px 10px",
            cursor: selected.size > 0 ? "pointer" : "default",
            fontSize: "var(--fs-xs)", fontWeight: 500,
          }}>
          批量派发 ({selected.size})
        </button>

        {/* Refresh */}
        <button onClick={() => refetch()} title="刷新" disabled={isFetching}
          style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 4, padding: "2px 6px", cursor: isFetching ? "default" : "pointer", display: "flex", alignItems: "center" }}>
          <RefreshCw size={12} style={isFetching ? { animation: "spin 1s linear infinite" } : undefined} />
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "32px 80px 100px 110px 90px 80px 110px 90px", padding: "6px 16px", borderBottom: "1px solid var(--bg-panel)", background: "var(--bg-panel)", color: "var(--text-muted)", fontSize: "var(--fs-xs)", fontWeight: 500, position: "sticky", top: 0, zIndex: 1, alignItems: "center" }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll}
            style={{ cursor: "pointer", accentColor: "var(--accent-gold)" }} />
          <SortableHeader label="User ID"   active={sortKey === "user_id"}   dir={sortDir} onClick={() => toggleSort("user_id")}   align="center" />
          <SortableHeader label="日期"      active={sortKey === "card_date"}  dir={sortDir} onClick={() => toggleSort("card_date")}  align="center" />
          <SortableHeader label="Signature" active={sortKey === "cluster_signature"} dir={sortDir} onClick={() => toggleSort("cluster_signature")} align="center" />
          <SortableHeader label="状态"      active={sortKey === "status"}     dir={sortDir} onClick={() => toggleSort("status")}     align="center" />
          <SortableHeader label="Task ID"   active={sortKey === "task_id"}    dir={sortDir} onClick={() => toggleSort("task_id")}    align="center" />
          <SortableHeader label="创建时间"  active={sortKey === "created_at"} dir={sortDir} onClick={() => toggleSort("created_at")} align="center" />
          <span style={{ textAlign: "center" }}>操作</span>
        </div>

        {/* Rows */}
        {filtered.map((row) => (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "32px 80px 100px 110px 90px 80px 110px 90px", padding: "7px 16px", borderBottom: "1px solid var(--bg-panel)", alignItems: "center", background: selected.has(row.id) ? "color-mix(in srgb, var(--accent-gold) 8%, transparent)" : undefined }}>
            <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)}
              style={{ cursor: "pointer", accentColor: "var(--accent-gold)" }} />

            {/* User ID */}
            <span style={{ color: "var(--text-primary)", fontSize: "var(--fs-sm)", textAlign: "center" }}>
              {row.user_id}
            </span>

            {/* Date */}
            <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", textAlign: "center" }}>
              {row.card_date}
            </span>

            {/* Signature (first 8 chars, monospace) */}
            <span style={{ fontFamily: "monospace", fontSize: "var(--fs-xs)", color: "var(--text-muted)", textAlign: "center", letterSpacing: "0.02em" }}>
              {row.cluster_signature.slice(0, 8)}
            </span>

            {/* Status badge */}
            <span style={{ textAlign: "center" }}>
              {statusLabel(row.status, row.error_msg, row.retry_count)}
            </span>

            {/* Task ID */}
            <span style={{ color: row.task_id != null ? "var(--accent-blue)" : "var(--text-faint)", fontSize: "var(--fs-sm)", textAlign: "center" }}>
              {row.task_id != null ? `#${row.task_id}` : "—"}
            </span>

            {/* Created */}
            <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", textAlign: "center" }}>
              {fmtTime(row.created_at)}
            </span>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "center", gap: 2 }}>
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

        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)" }}>暂无数据</div>
        )}
      </div>
    </div>
  );
}
