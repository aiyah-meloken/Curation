import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import {
  fetchDedupTasks, fetchDedupTaskRuns, fetchDedupTaskServing, forceDedupTaskRun,
  fetchDedupAutoConfig, setDedupAutoConfig,
} from "../lib/api";
import type { DedupTaskRow, DedupTaskRun, DedupQueueRow } from "../types";
import { fmtTime, statusLabel } from "../lib/tableHelpers";

function TaskRunHistory({ taskId }: { taskId: number }) {
  const { data: runs = [], isLoading } = useQuery<DedupTaskRun[]>({
    queryKey: ["dedupTaskRuns", taskId],
    queryFn: () => fetchDedupTaskRuns(taskId),
    staleTime: 10_000,
  });

  if (isLoading) return <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>加载中…</span>;
  if (runs.length === 0) return <span style={{ color: "var(--text-faint)", fontSize: "var(--fs-xs)" }}>暂无运行记录</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {runs.map((r) => (
        <div key={r.run_id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
          <span style={{ fontFamily: "monospace", color: "var(--accent-blue)" }}>#{r.run_id}</span>
          <span style={{ color: "var(--text-faint)" }}>{r.backend ?? "—"}</span>
          {statusLabel(r.status, r.error_msg)}
          <span>{fmtTime(r.started_at)}</span>
        </div>
      ))}
    </div>
  );
}

function TaskServingRows({ taskId }: { taskId: number }) {
  const { data: rows = [], isLoading } = useQuery<DedupQueueRow[]>({
    queryKey: ["dedupTaskServing", taskId],
    queryFn: () => fetchDedupTaskServing(taskId),
    staleTime: 10_000,
  });

  if (isLoading) return <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>加载中…</span>;
  if (rows.length === 0) return <span style={{ color: "var(--text-faint)", fontSize: "var(--fs-xs)" }}>暂无队列行</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {rows.map((r) => (
        <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
          <span style={{ color: "var(--text-primary)" }}>User {r.user_id}</span>
          <span>{r.card_date}</span>
          {statusLabel(r.status, r.error_msg, r.retry_count)}
        </div>
      ))}
    </div>
  );
}

function ExpandedRow({ task }: { task: DedupTaskRow }) {
  return (
    <div style={{
      gridColumn: "1 / -1",
      padding: "12px 16px 12px 40px",
      background: "color-mix(in srgb, var(--bg-panel) 60%, transparent)",
      borderBottom: "1px solid var(--bg-panel)",
      display: "flex",
      gap: 32,
      flexWrap: "wrap",
    }}>
      <div style={{ minWidth: 200 }}>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>运行历史</div>
        <TaskRunHistory taskId={task.task_id} />
      </div>
      <div style={{ minWidth: 200 }}>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>服务中的队列行</div>
        <TaskServingRows taskId={task.task_id} />
      </div>
    </div>
  );
}

const COLS = "24px 110px 90px 80px 160px 110px 80px";

export function DedupTasksPanel() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: tasks = [], refetch, isFetching } = useQuery<DedupTaskRow[]>({
    queryKey: ["dedupTasks", statusFilter === "all" ? undefined : statusFilter],
    queryFn: () => fetchDedupTasks({ status: statusFilter === "all" ? undefined : statusFilter }),
    refetchInterval: 1000,
    staleTime: 500,
  });

  const forceMut = useMutation({
    mutationFn: (taskId: number) => forceDedupTaskRun(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dedupTasks"] });
      qc.invalidateQueries({ queryKey: ["dedupTaskRuns"] });
    },
  });

  const { data: cfg } = useQuery({
    queryKey: ["dedupAutoConfig"],
    queryFn: fetchDedupAutoConfig,
    refetchInterval: 1000,
    staleTime: 500,
  });
  const cfgMut = useMutation({
    mutationFn: (patch: Partial<{ auto_launch: boolean; max_concurrency: number }>) =>
      setDedupAutoConfig(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dedupAutoConfig"] }),
  });

  const toggleExpand = (taskId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Task statuses are pending/running/done/failed (no 'queued' on the Task
  // itself; queued is at DedupQueue layer). Mirror article queue filter set.
  const chips: { key: string; label: string }[] = [
    { key: "all",     label: "全部" },
    { key: "pending", label: "待执行" },
    { key: "running", label: "运行中" },
    { key: "done",    label: "完成" },
    { key: "failed",  label: "失败" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Scheduler control bar (mirrors ArticleQueuePanel; controls execution
          of queued rows). Tab1 controls cluster generation; this controls
          how queued rows turn into Runs. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 16px", borderBottom: "1px solid var(--bg-panel)", background: "var(--bg-base)", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
          title="开 = scheduler 拉 queued 行 spawn run；关 = 全停（队列里只标记不执行）">
          <input type="checkbox"
            checked={!!cfg?.auto_launch}
            disabled={cfgMut.isPending}
            onChange={(e) => cfgMut.mutate({ auto_launch: e.target.checked })} />
          <span>调度 {cfg?.auto_launch ? <b style={{ color: "var(--accent-green)" }}>开</b> : <b style={{ color: "var(--accent-red)" }}>停</b>}</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}
          title={`并发上限（硬顶 ${cfg?.max_concurrency_hard_cap ?? 2}）`}>
          <span>并发</span>
          <select
            value={cfg?.max_concurrency ?? 1}
            disabled={cfgMut.isPending || !cfg}
            onChange={(e) => cfgMut.mutate({ max_concurrency: Number(e.target.value) })}
            style={{ background: "var(--bg-panel)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 4px", fontSize: "var(--fs-xs)" }}>
            {Array.from({ length: cfg?.max_concurrency_hard_cap ?? 2 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Controls bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
        borderBottom: "1px solid var(--bg-panel)", background: "var(--bg-panel)",
        flexWrap: "wrap", fontSize: "var(--fs-sm)",
      }}>
        {chips.map((c) => (
          <button key={c.key} onClick={() => setStatusFilter(c.key)}
            style={{
              background: statusFilter === c.key ? "var(--accent-gold)" : "var(--bg-base)",
              color: statusFilter === c.key ? "#fff" : "var(--text-muted)",
              border: "none", borderRadius: 10, padding: "2px 10px",
              cursor: "pointer", fontSize: "var(--fs-xs)",
              fontWeight: statusFilter === c.key ? 600 : 400,
            }}>
            {c.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <button onClick={() => refetch()} title="刷新" disabled={isFetching}
          style={{
            background: "var(--bg-panel)", border: "1px solid var(--border)",
            color: "var(--text-primary)", borderRadius: 4, padding: "2px 6px",
            cursor: isFetching ? "default" : "pointer", display: "flex", alignItems: "center",
          }}>
          <RefreshCw size={12} style={isFetching ? { animation: "spin 1s linear infinite" } : undefined} />
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>

        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: COLS,
          padding: "6px 16px", borderBottom: "1px solid var(--bg-panel)",
          background: "var(--bg-panel)", color: "var(--text-muted)",
          fontSize: "var(--fs-xs)", fontWeight: 500,
          position: "sticky", top: 0, zIndex: 1, alignItems: "center", gap: 4,
        }}>
          <span />
          <span>Signature</span>
          <span style={{ textAlign: "center" }}>状态</span>
          <span style={{ textAlign: "center" }}>Served</span>
          <span>最近运行</span>
          <span>创建时间</span>
          <span style={{ textAlign: "center" }}>操作</span>
        </div>

        {/* Rows */}
        {tasks.map((task) => {
          const isOpen = expanded.has(task.task_id);
          const latestRun = task.latest_run;

          return (
            <div key={task.task_id}>
              {/* Main row */}
              <div style={{
                display: "grid", gridTemplateColumns: COLS,
                padding: "7px 16px", borderBottom: isOpen ? "none" : "1px solid var(--bg-panel)",
                alignItems: "center", gap: 4,
                background: isOpen ? "color-mix(in srgb, var(--bg-panel) 40%, transparent)" : undefined,
              }}>
                {/* Expand chevron */}
                <span
                  onClick={() => toggleExpand(task.task_id)}
                  style={{ cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>

                {/* Signature */}
                <span style={{ fontFamily: "monospace", fontSize: "var(--fs-xs)", color: "var(--text-muted)", letterSpacing: "0.02em" }}>
                  {task.signature.slice(0, 8)}
                </span>

                {/* Status */}
                <span style={{ textAlign: "center" }}>
                  {statusLabel(task.status)}
                </span>

                {/* Served count */}
                <span style={{ color: "var(--text-primary)", fontSize: "var(--fs-sm)", textAlign: "center" }}>
                  {task.served_count}
                </span>

                {/* Latest run */}
                <span style={{ fontSize: "var(--fs-xs)", color: latestRun ? "var(--text-muted)" : "var(--text-faint)" }}>
                  {latestRun
                    ? `#${latestRun.run_id} (${latestRun.status})`
                    : "—"}
                </span>

                {/* Created */}
                <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>
                  {fmtTime(task.created_at)}
                </span>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button
                    onClick={() => forceMut.mutate(task.task_id)}
                    disabled={forceMut.isPending}
                    title="强制重跑"
                    style={{
                      background: "none", border: "none",
                      color: "var(--accent-gold)", cursor: "pointer", padding: 2,
                      display: "flex", alignItems: "center", gap: 3,
                      fontSize: "var(--fs-xs)",
                    }}>
                    <RefreshCw size={12} />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && <ExpandedRow task={task} />}
            </div>
          );
        })}

        {tasks.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)" }}>暂无数据</div>
        )}
      </div>
    </div>
  );
}
