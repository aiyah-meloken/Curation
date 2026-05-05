import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import {
  fetchDedupTasks, fetchDedupTaskRuns, fetchDedupTaskServing, forceDedupTaskRun,
  fetchDedupAutoConfig, setDedupAutoConfig, fetchBackends,
} from "../lib/api";
import type { AgentBackends, DedupTaskRow, DedupTaskRun, DedupQueueRow } from "../types";
import { fmtTime, runStatusColor, statusLabel } from "../lib/tableHelpers";
import { RunDetailDrawer } from "./RunDetailDrawer";
import { SourceCardsDrawer } from "./SourceCardsDrawer";
import { ArticleDrawer } from "./ArticleDrawer";

function TaskRunHistory({ taskId, onOpenRun }: { taskId: number; onOpenRun: (runId: number) => void }) {
  const { data: runs = [], isLoading } = useQuery<DedupTaskRun[]>({
    queryKey: ["dedupTaskRuns", taskId],
    queryFn: () => fetchDedupTaskRuns(taskId),
    staleTime: 10_000,
  });

  if (isLoading) return <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>加载中…</span>;
  if (runs.length === 0) return <span style={{ color: "var(--text-faint)", fontSize: "var(--fs-xs)" }}>暂无运行记录</span>;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 70px 90px 100px", color: "var(--text-muted)", fontSize: "var(--fs-xs)", padding: "4px 0", borderBottom: "1px solid var(--bg-panel)" }}>
        <span>Run ID</span><span>后端</span><span>状态</span><span>开始时间</span><span>完成时间</span>
      </div>
      {runs.map((r) => (
        <div key={r.run_id} style={{ display: "grid", gridTemplateColumns: "60px 1fr 70px 90px 100px", padding: "5px 0", borderBottom: "1px solid var(--bg-panel)", alignItems: "center" }}>
          <a onClick={() => onOpenRun(r.run_id)}
            style={{ color: "var(--accent-blue)", fontSize: "var(--fs-sm)", cursor: "pointer", textDecoration: "none" }}>
            #{r.run_id}
          </a>
          <span style={{ color: "var(--text-primary)", fontSize: "var(--fs-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.backend ?? "—"}</span>
          <span style={{ color: runStatusColor(r.status), fontSize: "var(--fs-sm)" }}>{r.status}</span>
          <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>{fmtTime(r.started_at)}</span>
          <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>{fmtTime(r.completed_at)}</span>
        </div>
      ))}
    </>
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

function taskDecisionLabel(task: DedupTaskRow) {
  const run = task.latest_run;
  const d = run?.decision;
  if (!run) return { text: "未判决", color: "var(--text-faint)" };
  if (run.status === "failed") return { text: "判决失败", color: "var(--accent-red)" };
  if (run.status !== "done") return { text: "判决中", color: "var(--accent-gold)" };
  const labels: Record<string, { text: string; color: string }> = {
    unified: { text: "统一聚合", color: "var(--accent-green)" },
    mixed: { text: "部分聚合", color: "var(--accent-gold)" },
    independent: { text: "互不相似", color: "var(--text-muted)" },
  };
  return labels[d?.verdict ?? ""] ?? { text: d?.verdict ?? "已完成", color: "var(--text-muted)" };
}

function taskDecisionTitle(task: DedupTaskRow) {
  const run = task.latest_run;
  const d = run?.decision;
  if (!run) return "暂无 run 判决";
  const parts = [
    `run #${run.run_id}`,
    d?.verdict ? `verdict: ${d.verdict}` : null,
    d ? `outputs: ${d.outputs_count}` : null,
    d ? `aggregated: ${d.aggregated_count}` : null,
    d ? `passthrough: ${d.passthrough_count}` : null,
    d ? `residual: ${d.residual_count}` : null,
    d?.error_msg ? `error: ${d.error_msg}` : null,
    d?.rationale || null,
  ].filter(Boolean);
  return parts.join("\n");
}

function ExpandedRow({ task, onOpenRun }: { task: DedupTaskRow; onOpenRun: (runId: number) => void }) {
  if (task.task_id == null) {
    return (
      <div style={{
        gridColumn: "1 / -1",
        background: "var(--bg-panel)",
        borderTop: "1px solid var(--bg-panel)",
        padding: "6px 16px 6px 36px",
        color: "var(--text-muted)",
        fontSize: "var(--fs-xs)",
      }}>
        Queue #{task.queue_id} 尚未被 scheduler claim 成 Task；进入运行后会显示 run 历史。
      </div>
    );
  }
  return (
    <div style={{
      gridColumn: "1 / -1",
      background: "var(--bg-panel)",
      borderTop: "1px solid var(--bg-panel)",
      padding: "6px 16px 6px 36px",
    }}>
      <div style={{ marginBottom: 10 }}>
        <TaskRunHistory taskId={task.task_id} onOpenRun={onOpenRun} />
      </div>
      <div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", padding: "4px 0", borderBottom: "1px solid var(--bg-panel)" }}>服务中的队列行</div>
        <TaskServingRows taskId={task.task_id} />
      </div>
    </div>
  );
}

const COLS = "24px 110px 100px 90px 80px 150px 110px 80px";

export function DedupTasksPanel() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [detailRunId, setDetailRunId] = useState<number | null>(null);
  const [drawerSig, setDrawerSig] = useState<string | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [articleTitle, setArticleTitle] = useState<string | null>(null);
  const [articleUrl, setArticleUrl] = useState<string | null>(null);

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
  const { data: backendsData } = useQuery<AgentBackends>({
    queryKey: ["dedupBackends"],
    queryFn: fetchBackends,
    staleTime: 60_000,
  });
  const cfgMut = useMutation({
    mutationFn: (patch: Partial<{ auto_launch: boolean; max_concurrency: number; dedup_backend: string }>) =>
      setDedupAutoConfig(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dedupAutoConfig"] }),
  });

  const rowKey = (task: DedupTaskRow) => String(task.task_id ?? `q${task.queue_id ?? task.signature}`);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalPending = tasks.filter((t) => t.status === "pending").length;
  const totalQueued  = tasks.filter((t) => t.status === "queued").length;
  const totalRunning = tasks.filter((t) => t.status === "running").length;
  const totalDone    = tasks.filter((t) => t.status === "done").length;
  const totalFailed  = tasks.filter((t) => t.status === "failed").length;
  const backendList = backendsData ? Object.keys(backendsData.backends ?? {}) : [];

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
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}
          title="聚合队列专用后端；不影响文章队列">
          <span>后端</span>
          <select
            value={cfg?.dedup_backend ?? ""}
            disabled={cfgMut.isPending || !cfg}
            onChange={(e) => cfgMut.mutate({ dedup_backend: e.target.value })}
            style={{ background: "var(--bg-panel)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 4px", fontSize: "var(--fs-xs)", maxWidth: 280 }}>
            {cfg?.dedup_backend && !backendList.includes(cfg.dedup_backend) && (
              <option value={cfg.dedup_backend}>{cfg.dedup_backend}</option>
            )}
            {backendList.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 16px", borderBottom: "1px solid var(--bg-panel)", background: "var(--bg-base)", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
        <span>共 {tasks.length}</span>
        <span style={{ color: "var(--border)" }}>|</span>
        {totalPending > 0 && <span>待执行 <b style={{ color: "var(--text-primary)" }}>{totalPending}</b></span>}
        {totalQueued  > 0 && <span style={{ color: "var(--accent-blue)" }}>已排队 <b>{totalQueued}</b></span>}
        {totalRunning > 0 && <span style={{ color: "var(--accent-gold)" }}>运行中 <b>{totalRunning}</b></span>}
        {totalDone    > 0 && <span style={{ color: "var(--accent-green)" }}>完成 <b>{totalDone}</b></span>}
        {totalFailed  > 0 && <span style={{ color: "var(--accent-red)" }}>失败 <b>{totalFailed}</b></span>}
      </div>

      {/* Controls bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "8px 16px",
        borderBottom: "1px solid var(--bg-panel)", background: "var(--bg-panel)",
        flexWrap: "wrap", fontSize: "var(--fs-sm)",
      }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ background: "var(--bg-panel)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", fontSize: "var(--fs-xs)" }}>
          <option value="all">全部状态</option>
          <option value="pending">待执行</option>
          <option value="queued">已排队</option>
          <option value="running">运行中</option>
          <option value="done">完成</option>
          <option value="failed">失败</option>
        </select>

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
          <span style={{ textAlign: "center" }}>判决</span>
          <span style={{ textAlign: "center" }}>状态</span>
          <span style={{ textAlign: "center" }}>Served</span>
          <span>最近运行</span>
          <span>创建时间</span>
          <span style={{ textAlign: "center" }}>操作</span>
        </div>

        {/* Rows */}
        {tasks.map((task) => {
          const key = rowKey(task);
          const isOpen = expanded.has(key);
          const latestRun = task.latest_run;

          return (
            <div key={key}>
              {/* Main row */}
              <div style={{
                display: "grid", gridTemplateColumns: COLS,
                padding: "7px 16px", borderBottom: isOpen ? "none" : "1px solid var(--bg-panel)",
                alignItems: "center", gap: 4,
                background: isOpen ? "color-mix(in srgb, var(--bg-panel) 40%, transparent)" : undefined,
              }}>
                {/* Expand chevron */}
                <span
                  onClick={() => toggleExpand(key)}
                  style={{ cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>

                {/* Signature */}
                <button
                  onClick={() => setDrawerSig(task.signature)}
                  title="查看 signature 原卡片"
                  style={{
                    background: "none", border: "none", padding: 0, margin: 0,
                    fontFamily: "monospace", fontSize: "var(--fs-xs)", color: "var(--accent-blue)",
                    letterSpacing: "0.02em", cursor: "pointer", textAlign: "left",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {task.signature.slice(0, 8)}
                </button>

                {/* Decision */}
                {(() => {
                  const label = taskDecisionLabel(task);
                  return (
                    <span title={taskDecisionTitle(task)} style={{ color: label.color, fontSize: "var(--fs-sm)", textAlign: "center", cursor: "help" }}>
                      {label.text}
                    </span>
                  );
                })()}

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
                    onClick={() => task.task_id != null && forceMut.mutate(task.task_id)}
                    disabled={forceMut.isPending || task.task_id == null}
                    title={task.task_id == null ? "尚未生成 Task" : "强制重跑"}
                    style={{
                      background: "none", border: "none",
                      color: task.task_id == null ? "var(--text-faint)" : "var(--accent-gold)",
                      cursor: task.task_id == null ? "default" : "pointer", padding: 2,
                      display: "flex", alignItems: "center", gap: 3,
                      fontSize: "var(--fs-xs)",
                    }}>
                    <RefreshCw size={12} />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && <ExpandedRow task={task} onOpenRun={setDetailRunId} />}
            </div>
          );
        })}

        {tasks.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)" }}>暂无数据</div>
        )}
      </div>
      <RunDetailDrawer
        runId={detailRunId}
        onClose={() => setDetailRunId(null)}
      />
      <SourceCardsDrawer
        clusterSignature={drawerSig}
        isOpen={!!drawerSig}
        onClose={() => setDrawerSig(null)}
        subtitle={drawerSig ? `${drawerSig} · signature` : undefined}
        onOpenArticle={(aid, atitle, aurl) => {
          setDrawerSig(null);
          setArticleId(aid);
          setArticleTitle(atitle ?? null);
          setArticleUrl(aurl ?? null);
        }}
      />
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
