import { useEffect, useState } from "react";
import { Play, RefreshCw, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { RunProgress } from "./RunProgress";
import { FileViewer } from "./FileViewer";
import type { Article, AnalysisRun, AgentVersion, Stage } from "../types";
import { STAGES } from "../types";

const API_BASE = "http://127.0.0.1:8889";

interface Props {
  article: Article;
}

const BACKENDS = ["claude", "minimax", "sonnet"] as const;

function overallBadge(status: string) {
  const map: Record<string, string> = {
    done:    "bg-green-900 text-green-300",
    failed:  "bg-red-900 text-red-300",
    running: "bg-blue-900 text-blue-300 animate-pulse",
    pending: "bg-gray-700 text-gray-400",
  };
  const cls = map[status] ?? "bg-gray-700 text-gray-400";
  return <span className={`text-xs px-1.5 py-0.5 rounded ${cls}`}>{status}</span>;
}

function stageBadge(status: string) {
  const map: Record<string, string> = {
    done:    "text-green-400",
    failed:  "text-red-400",
    running: "text-blue-400 animate-pulse",
    pending: "text-gray-500",
  };
  return map[status] ?? "text-gray-500";
}

function fmtElapsed(s: number | null) {
  if (!s) return null;
  if (s < 60) return `${s.toFixed(0)}s`;
  return `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ArticleAdminPanel({ article }: Props) {
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [selectedHash, setSelectedHash] = useState<string>("");
  const [backend, setBackend] = useState<string>("claude");
  const [triggering, setTriggering] = useState(false);

  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [viewingRunId, setViewingRunId] = useState<number | null>(null);

  // Load agent versions
  useEffect(() => {
    fetch(`${API_BASE}/agent/versions?n=20`)
      .then(r => r.json())
      .then(resp => {
        const vs: AgentVersion[] = resp.data ?? [];
        setVersions(vs);
        if (vs.length > 0) setSelectedHash(vs[0].hash);
      })
      .catch(() => {});
  }, []);

  // Load runs for this article
  const loadRuns = () => {
    fetch(`${API_BASE}/articles/${article.id}/runs`)
      .then(r => r.json())
      .then(resp => setRuns(resp.data ?? []));
  };

  useEffect(() => {
    loadRuns();
  }, [article.id]);

  const triggerAnalysis = async () => {
    if (!selectedHash) return;
    setTriggering(true);
    try {
      const resp = await fetch(`${API_BASE}/articles/${article.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_commit_hash: selectedHash, backend }),
      });
      const data = await resp.json();
      if (data.run_id) {
        await loadRuns();
        setExpandedRunId(data.run_id);
      }
    } finally {
      setTriggering(false);
    }
  };

  const retriggerStage = async (runId: number, stage: Stage) => {
    await fetch(`${API_BASE}/runs/${runId}/stage/${stage}`, { method: "POST" });
    loadRuns();
  };

  const handleRunUpdate = (updated: AnalysisRun) => {
    setRuns(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden text-sm text-gray-200">

      {/* ── Trigger section ── */}
      <div className="px-4 py-3 border-b border-gray-700 space-y-2">
        <div className="text-xs text-gray-400 uppercase tracking-wide">触发新分析</div>
        <div className="flex gap-2 flex-wrap">
          {/* Agent version picker */}
          <select
            value={selectedHash}
            onChange={e => setSelectedHash(e.target.value)}
            className="flex-1 min-w-0 bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1.5"
          >
            {versions.length === 0 && (
              <option value="">（未连接 agent repo）</option>
            )}
            {versions.map(v => (
              <option key={v.hash} value={v.hash}>
                {v.short_hash} — {v.message.slice(0, 45)}
              </option>
            ))}
          </select>

          {/* Backend picker */}
          <div className="flex gap-1">
            {BACKENDS.map(b => (
              <button
                key={b}
                onClick={() => setBackend(b)}
                className={`px-2.5 py-1.5 text-xs rounded transition-colors ${
                  backend === b
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Run button */}
          <button
            onClick={triggerAnalysis}
            disabled={triggering || !selectedHash}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600
                       disabled:opacity-50 text-white text-xs rounded transition-colors"
          >
            {triggering
              ? <RefreshCw size={13} className="animate-spin" />
              : <Play size={13} />}
            一条龙运行
          </button>
        </div>
      </div>

      {/* ── Runs list / detail ── */}
      <div className="flex-1 overflow-y-auto">
        {runs.length === 0 ? (
          <div className="text-center text-gray-500 py-12">暂无分析记录</div>
        ) : (
          runs.map(run => {
            const isExpanded = expandedRunId === run.id;
            const isViewing = viewingRunId === run.id;

            return (
              <div key={run.id} className="border-b border-gray-700/60">
                {/* Run header row */}
                <div
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-800/50 cursor-pointer"
                  onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                >
                  {isExpanded
                    ? <ChevronDown size={13} className="text-gray-500 shrink-0" />
                    : <ChevronRight size={13} className="text-gray-500 shrink-0" />}

                  <span className="text-gray-400 text-xs w-5 shrink-0">#{run.id}</span>
                  <span className="text-xs font-mono text-blue-400 shrink-0">
                    {run.agent_commit_hash.slice(0, 7)}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{run.backend}</span>
                  <span className="flex-1 truncate text-xs text-gray-500">
                    {run.agent_commit_message}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">{fmtDate(run.created_at)}</span>
                  {overallBadge(run.overall_status)}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-10 pb-3 space-y-3">
                    {/* Live progress */}
                    <RunProgress run={run} onUpdate={handleRunUpdate} />

                    {/* Per-stage re-trigger */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {STAGES.map(stage => {
                        const status = run[`${stage}_status` as keyof AnalysisRun] as string;
                        const elapsed = run[`${stage}_elapsed_s` as keyof AnalysisRun] as number | null;
                        return (
                          <button
                            key={stage}
                            onClick={() => retriggerStage(run.id, stage)}
                            className="flex items-center gap-1 px-2 py-1 text-xs
                                       bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                          >
                            <span className={stageBadge(status)}>●</span>
                            <span className="capitalize">{stage}</span>
                            {elapsed && (
                              <span className="text-gray-500">{fmtElapsed(elapsed)}</span>
                            )}
                            <RefreshCw size={10} className="text-gray-500" />
                          </button>
                        );
                      })}
                    </div>

                    {/* View files toggle */}
                    {run.overall_status === "done" && (
                      <button
                        onClick={() => setViewingRunId(isViewing ? null : run.id)}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <Eye size={12} />
                        {isViewing ? "收起产出" : "查看产出"}
                      </button>
                    )}

                    {isViewing && run.id === viewingRunId && (
                      <div className="mt-2 border border-gray-700 rounded p-3 bg-gray-900"
                           style={{ minHeight: 300, maxHeight: 600, overflow: "hidden",
                                    display: "flex", flexDirection: "column" }}>
                        <FileViewer runId={run.id} />
                      </div>
                    )}

                    {run.error_msg && (
                      <div className="text-xs text-red-400 bg-red-900/20 rounded p-2">
                        {run.error_msg}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
