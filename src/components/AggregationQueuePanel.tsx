import { useState, useMemo } from "react";
import { RefreshCw, Play, RotateCcw, Trash2, ArrowUp, ArrowDown, ChevronRight, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AggregationQueueEntry, AggregationRunEntry, AggregationStrategy, AgentBackends } from "../types";
import { apiFetch, fetchBackends } from "../lib/api";

const STATUS_LABEL: Record<string, string> = {
  prereq: "等待中",
  pending: "待处理",
  running: "处理中",
  done: "已完成",
  failed: "失败",
  skipped: "已跳过",
};

const STATUS_COLOR: Record<string, string> = {
  prereq: "var(--text-muted)",
  pending: "var(--text-muted)",
  running: "var(--accent-gold)",
  done: "var(--accent-green)",
  failed: "var(--accent-red)",
  skipped: "var(--text-faint)",
};

type SortField = "created_at" | "date" | "status" | "request_count";
type SortDir = "asc" | "desc";

export default function AggregationQueuePanel() {
  const queryClient = useQueryClient();

  const { data: queueData, isLoading: isLoadingQueue, isFetching } = useQuery({
    queryKey: ["aggregationQueue"],
    queryFn: async () => {
      const resp = await apiFetch("/aggregation-queue").then(r => r.json());
      return resp.status === "ok" ? (resp.data as AggregationQueueEntry[]) : [];
    },
    refetchInterval: 1000,
    staleTime: 500,
  });
  const queue = queueData ?? [];

  const { data: strategyData } = useQuery({
    queryKey: ["aggregationStrategy"],
    queryFn: async () => {
      const resp = await apiFetch("/aggregation-strategy").then(r => r.json());
      return resp.status === "ok" ? (resp.data as AggregationStrategy) : { auto_launch: true, max_concurrency: 1, default_backend: "" };
    },
    refetchInterval: 1000,
    staleTime: 500,
  });
  const strategy = strategyData ?? { auto_launch: true, max_concurrency: 1, default_backend: "" };

  const { data: backendsData } = useQuery<AgentBackends>({ queryKey: ["analysisBackends"], queryFn: fetchBackends, staleTime: 60_000 });
  const backendList = backendsData ? Object.keys(backendsData.backends ?? {}) : [];

  const loading = isFetching;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [entryRuns, setEntryRuns] = useState<AggregationRunEntry[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  const invalidateQueue = () => {
    queryClient.invalidateQueries({ queryKey: ["aggregationQueue"] });
  };

  const patchStrategy = async (patch: Partial<AggregationStrategy>) => {
    const resp = await apiFetch("/aggregation-strategy", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then(r => r.json());
    if (resp.status === "ok") {
      queryClient.invalidateQueries({ queryKey: ["aggregationStrategy"] });
    }
  };

  const triggerRunMutation = useMutation({
    mutationFn: async ({ userId, date }: { userId: number; date: string }) => {
      await apiFetch(`/aggregation-queue/${userId}/${date}/run`, { method: "POST" });
    },
    onSuccess: () => invalidateQueue(),
  });

  const triggerRun = async (userId: number, date: string) => {
    await triggerRunMutation.mutateAsync({ userId, date });
  };

  const retryMutation = useMutation({
    mutationFn: async ({ userId, date }: { userId: number; date: string }) => {
      await apiFetch(`/aggregation-queue/${userId}/${date}/retry`, { method: "POST" });
    },
    onSuccess: () => invalidateQueue(),
  });

  const retryEntry = async (userId: number, date: string) => {
    await retryMutation.mutateAsync({ userId, date });
  };

  const deleteRunMutation = useMutation({
    mutationFn: async (runId: number) => {
      await apiFetch(`/aggregation-runs/${runId}`, { method: "DELETE" });
    },
    onSuccess: () => invalidateQueue(),
  });

  const deleteRun = async (runId: number) => {
    await deleteRunMutation.mutateAsync(runId);
  };

  const toggleExpand = async (userId: number, date: string) => {
    const key = `${userId}-${date}`;
    if (expandedEntry === key) {
      setExpandedEntry(null);
      return;
    }
    setExpandedEntry(key);
    setLoadingRuns(true);
    try {
      const resp = await apiFetch(`/aggregation-queue/${userId}/${date}/runs`).then(r => r.json());
      if (resp.status === "ok") setEntryRuns(resp.data);
    } finally {
      setLoadingRuns(false);
    }
  };

  const filteredQueue = useMemo(() => {
    let items = statusFilter === "all" ? [...queue] : queue.filter(e => e.status === statusFilter);
    if (dateFilter) items = items.filter(e => e.date && e.date.startsWith(dateFilter));
    items.sort((a, b) => {
      const av = a[sortField] ?? "";
      const bv = b[sortField] ?? "";
      const cmp = sortField === "request_count"
        ? (Number(av) - Number(bv))
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [queue, statusFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };


  const fmtTime = (s: string | null) => {
    if (!s) return "";
    const d = new Date(s);
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const fmtElapsed = (s: number | null | undefined): string => {
    if (s == null) return "";
    if (s < 60) return `${s.toFixed(0)}s`;
    return `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
  };

  if (isLoadingQueue) return <div style={{padding:'2rem',textAlign:'center',color:'var(--text-muted)'}}>加载队列...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Strategy controls — same layout as ArticleQueuePanel */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderBottom: "1px solid var(--bg-panel)", background: "var(--bg-panel)", flexWrap: "wrap", fontSize: "var(--fs-sm)" }}>
        <span style={{ color: "var(--text-muted)" }}>自动调度</span>
        <button
          onClick={() => patchStrategy({ auto_launch: !strategy.auto_launch })}
          style={{ background: strategy.auto_launch ? "var(--accent-green)" : "var(--border)", color: "#fff", border: "none", borderRadius: 10, padding: "1px 10px", cursor: "pointer", fontSize: "var(--fs-xs)" }}
        >{strategy.auto_launch ? "开" : "关"}</button>

        <span style={{ color: "var(--border)" }}>|</span>
        <span style={{ color: "var(--text-muted)" }}>并发</span>
        <select value={strategy.max_concurrency} onChange={e => patchStrategy({ max_concurrency: Number(e.target.value) })}
          style={{ background: "var(--bg-panel)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 4px", fontSize: "var(--fs-sm)" }}>
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <span style={{ color: "var(--border)" }}>|</span>
        <span style={{ color: "var(--text-muted)" }}>后端</span>
        <select value={strategy.default_backend} onChange={e => patchStrategy({ default_backend: e.target.value })}
          style={{ background: "var(--bg-panel)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 4px", fontSize: "var(--fs-sm)" }}>
          {backendList.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ background: "var(--bg-panel)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", fontSize: "var(--fs-xs)" }}>
          <option value="all">全部状态</option>
          {Object.entries(STATUS_LABEL).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          style={{ background: "var(--bg-panel)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 6px", fontSize: "var(--fs-xs)" }} />
        {dateFilter && (
          <button onClick={() => setDateFilter("")} title="清除日期"
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0 2px", fontSize: "var(--fs-xs)" }}>×</button>
        )}

        <button onClick={() => invalidateQueue()} title="刷新"
          style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", color: "var(--text-primary)", borderRadius: 4, padding: "2px 6px", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <RefreshCw size={12} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
        </button>
      </div>

      {/* Queue list — grid layout matching ArticleQueuePanel */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) 100px 80px 100px 70px 100px 60px", padding: "6px 16px", borderBottom: "1px solid var(--bg-panel)", background: "var(--bg-panel)", color: "var(--text-muted)", fontSize: "var(--fs-xs)", fontWeight: 500, position: "sticky", top: 0, zIndex: 1 }}>
          {([
            ["created_at", "用户"],
            ["date", "日期"],
            ["status", "状态"],
          ] as [SortField, string][]).map(([k, label]) => (
            <span key={k} onClick={() => handleSort(k)}
              style={{ cursor: "pointer", userSelect: "none", display: "inline-flex", alignItems: "center", gap: 2 }}>
              {label}
              {sortField === k && (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
            </span>
          ))}
          <span>等待至</span>
          <span onClick={() => handleSort("request_count")}
            style={{ cursor: "pointer", userSelect: "none", display: "inline-flex", alignItems: "center", gap: 2 }}>
            请求次数
            {sortField === "request_count" && (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
          </span>
          <span onClick={() => handleSort("created_at")}
            style={{ cursor: "pointer", userSelect: "none", display: "inline-flex", alignItems: "center", gap: 2 }}>
            入队时间
            {sortField === "created_at" && (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
          </span>
          <span style={{ textAlign: "center" }}>操作</span>
        </div>

        {filteredQueue.map(entry => {
          const entryKey = `${entry.user_id}-${entry.date}`;
          const isExpanded = expandedEntry === entryKey;
          return (
            <div key={entryKey} style={{ borderBottom: "1px solid var(--bg-panel)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) 100px 80px 100px 70px 100px 60px", padding: "8px 16px", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                  <span
                    onClick={() => toggleExpand(entry.user_id, entry.date)}
                    style={{ cursor: "pointer", color: "var(--text-muted)", flexShrink: 0, width: 16 }}
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.username || entry.email || `#${entry.user_id}`}</span>
                </div>
                <span style={{ color: "var(--text-primary)", fontSize: "var(--fs-sm)" }}>{entry.date}</span>
                <span>
                  <span style={{ color: STATUS_COLOR[entry.status], fontSize: "var(--fs-sm)" }}>
                    {STATUS_LABEL[entry.status] || entry.status}
                  </span>
                  {entry.error_msg && (
                    <span style={{ color: "var(--accent-red)", fontSize: "var(--fs-xs)", marginLeft: 4 }} title={entry.error_msg}>!</span>
                  )}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>
                  {entry.status === "prereq" && entry.wait_until ? fmtTime(entry.wait_until) : "—"}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", textAlign: "center" }}>{entry.request_count}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>{fmtTime(entry.created_at)}</span>
                <div style={{ textAlign: "center" }}>
                  {(entry.status === "pending" || entry.status === "prereq" || entry.status === "skipped") && (
                    <button onClick={() => triggerRun(entry.user_id, entry.date)} title="触发运行"
                      style={{ background: "none", border: "none", color: "var(--accent-green)", cursor: "pointer", padding: 2 }}>
                      <Play size={14} />
                    </button>
                  )}
                  {(entry.status === "done" || entry.status === "failed") && (
                    <button onClick={() => retryEntry(entry.user_id, entry.date)} title="重试"
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}>
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div style={{ background: "var(--bg-panel)", borderTop: "1px solid var(--bg-panel)", padding: "6px 16px 6px 36px" }}>
                  {entry.error_msg && (
                    <div style={{ color: "var(--accent-red)", fontSize: "var(--fs-sm)", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      {entry.error_msg}
                    </div>
                  )}
                  {loadingRuns ? (
                    <div style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", padding: 8 }}>加载中...</div>
                  ) : entryRuns.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)", padding: 8 }}>暂无运行记录</div>
                  ) : (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 70px 60px 100px 30px", color: "var(--text-muted)", fontSize: "var(--fs-xs)", padding: "4px 0", borderBottom: "1px solid var(--bg-panel)" }}>
                        <span>Run ID</span><span>后端</span><span>状态</span><span>耗时</span><span>创建时间</span><span></span>
                      </div>
                      {entryRuns.map(run => (
                        <div key={run.id} style={{ display: "grid", gridTemplateColumns: "60px 1fr 70px 60px 100px 30px", padding: "5px 0", borderBottom: "1px solid var(--bg-panel)", alignItems: "center" }}>
                          <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>
                            #{run.id}
                            {entry.run_id === run.id && (
                              <span style={{ marginLeft: 4, fontSize: "var(--fs-xs)", color: "var(--accent-green)" }}>★</span>
                            )}
                          </span>
                          <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.backend}</span>
                          <span style={{ color: STATUS_COLOR[run.status] || "var(--text-muted)", fontSize: "var(--fs-xs)" }}>
                            {STATUS_LABEL[run.status] || run.status}
                          </span>
                          <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>{fmtElapsed(run.elapsed_s)}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>{fmtTime(run.created_at)}</span>
                          <button onClick={() => deleteRun(run.id)} title="删除"
                            style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", padding: 2 }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filteredQueue.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-faint)", fontSize: "var(--fs-base)" }}>
            暂无聚合任务
          </div>
        )}
      </div>
    </div>
  );
}
