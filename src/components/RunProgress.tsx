import { useEffect, useRef, useState } from "react";
import { CheckCircle, XCircle, Loader2, Clock, FileText, Terminal } from "lucide-react";
import type { AnalysisRun, ProgressEvent } from "../types";
import { apiFetch, getAuthToken, getWsBase } from "../lib/api";

interface Props {
  run: AnalysisRun;
  onUpdate: (updated: AnalysisRun) => void;
}

function fmt(s: number | null | undefined): string {
  if (s == null) return "";
  if (s < 60) return `${s.toFixed(0)}s`;
  return `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}

/** Parse progress events from run.progress_log or live WebSocket events */
function parseProgressEvents(run: AnalysisRun, liveEvents: ProgressEvent[]): ProgressEvent[] {
  const fromLog: ProgressEvent[] = [];
  if (run.progress_log) {
    try {
      const parsed = JSON.parse(run.progress_log);
      if (Array.isArray(parsed)) fromLog.push(...parsed);
    } catch {}
  }
  return liveEvents.length > 0 ? liveEvents : fromLog;
}

interface StageInfo {
  name: string;
  status: "pending" | "running" | "done" | "failed";
  elapsed_s?: number;
}

function deriveStages(events: ProgressEvent[]): StageInfo[] {
  const stageMap = new Map<string, StageInfo>();
  for (const ev of events) {
    if (!ev.stage) continue;
    if (ev.type === "stage_start") {
      stageMap.set(ev.stage, { name: ev.stage, status: "running" });
    } else if (ev.type === "stage_done") {
      stageMap.set(ev.stage, { name: ev.stage, status: "done", elapsed_s: ev.elapsed_s });
    } else if (ev.type === "stage_failed") {
      stageMap.set(ev.stage, { name: ev.stage, status: "failed" });
    }
  }
  return Array.from(stageMap.values());
}

// ── Sub-agent activity extraction ────────────────────────────────────────────

interface ActivityItem {
  tool?: string;
  file?: string;
  cmd?: string;
  costUsd?: number;
  durationMs?: number;
  text?: string;
}

function extractActivities(events: ProgressEvent[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const ev of events) {
    if (ev.type !== "sub_agent") continue;
    const d = ev as any;

    // Tool call summaries (kind: "tool_calls")
    if (d.kind === "tool_calls" && Array.isArray(d.tools)) {
      for (const t of d.tools) {
        items.push({
          tool: t.tool,
          file: t.file || undefined,
          cmd: t.cmd || undefined,
        });
      }
    }

    // Result summary (kind: "result")
    if (d.kind === "result") {
      items.push({
        costUsd: d.cost_usd,
        durationMs: d.duration_ms,
        text: d.is_error ? "子 Agent 报错" : undefined,
      });
    }
  }
  return items;
}

// ── Components ───────────────────────────────────────────────────────────────

function StageRow({ stage }: { stage: StageInfo }) {
  const icon =
    stage.status === "done" ? <CheckCircle size={14} className="text-green-400" /> :
    stage.status === "failed" ? <XCircle size={14} className="text-red-400" /> :
    stage.status === "running" ? <Loader2 size={14} className="animate-spin text-blue-400" /> :
    <Clock size={14} className="text-gray-500" />;

  const barPct =
    stage.status === "done" ? 100 :
    stage.status === "running" ? 60 :
    0;

  return (
    <div className="flex items-center gap-3 py-1.5">
      {icon}
      <span className="w-24 text-sm capitalize text-gray-300">{stage.name}</span>
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            stage.status === "done" ? "bg-green-500" :
            stage.status === "failed" ? "bg-red-500" :
            stage.status === "running" ? "bg-blue-400 animate-pulse" :
            "bg-gray-600"
          }`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs text-gray-500">
        {stage.elapsed_s ? fmt(stage.elapsed_s) : stage.status === "running" ? "…" : ""}
      </span>
    </div>
  );
}

function ActivityLog({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) return null;

  // Show last 8 tool calls + result summary
  const toolCalls = activities.filter(a => a.tool);
  const result = activities.find(a => a.costUsd != null || a.durationMs != null);
  const recentTools = toolCalls.slice(-8);

  return (
    <div className="mt-2 space-y-0.5">
      <div className="text-xs text-gray-500 mb-1">
        子 Agent 活动 ({toolCalls.length} 次工具调用)
      </div>
      {recentTools.map((a, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-gray-400 pl-2">
          {a.cmd
            ? <Terminal size={11} className="text-gray-500 shrink-0" />
            : <FileText size={11} className="text-gray-500 shrink-0" />}
          <span className="text-blue-400 shrink-0 w-12">{a.tool}</span>
          <span className="truncate text-gray-500">
            {a.cmd || a.file || ""}
          </span>
        </div>
      ))}
      {toolCalls.length > 8 && (
        <div className="text-xs text-gray-600 pl-2">
          … 及 {toolCalls.length - 8} 项更早的调用
        </div>
      )}
      {result && (
        <div className="text-xs text-gray-500 pt-1 pl-2">
          {result.costUsd != null && <span>费用 ${result.costUsd.toFixed(4)}</span>}
          {result.durationMs != null && <span className="ml-3">耗时 {fmt(result.durationMs / 1000)}</span>}
          {result.text && <span className="ml-3 text-red-400">{result.text}</span>}
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function RunProgress({ run, onUpdate }: Props) {
  const wsRef = useRef<WebSocket | null>(null);
  const [localRun, setLocalRun] = useState<AnalysisRun>(run);
  const [liveEvents, setLiveEvents] = useState<ProgressEvent[]>([]);

  useEffect(() => {
    setLocalRun(run);
  }, [run]);

  useEffect(() => {
    if (!["pending", "running"].includes(run.overall_status)) return;

    const token = getAuthToken();
    if (!token) return;

    const wsBase = getWsBase();
    const qs = new URLSearchParams({ token });
    const ws = new WebSocket(`${wsBase}/runs/${run.id}/progress?${qs.toString()}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const event: ProgressEvent = JSON.parse(e.data);
        if (event.type === "snapshot") {
          const data = (event as any).data;
          if (data) {
            setLocalRun(data);
            onUpdate(data);
          }
        } else if (event.type === "stage_start" || event.type === "stage_done"
                   || event.type === "stage_failed" || event.type === "sub_agent") {
          setLiveEvents(prev => [...prev, event]);
        } else if (event.type === "done" || event.type === "failed") {
          setLiveEvents(prev => [...prev, event]);
          apiFetch(`/runs/${run.id}`)
            .then(r => r.json())
            .then(resp => {
              if (resp.data) {
                setLocalRun(resp.data);
                onUpdate(resp.data);
              }
            });
          ws.close();
        }
      } catch {}
    };

    return () => {
      ws.close();
    };
  }, [run.id, run.overall_status]);

  const events = parseProgressEvents(localRun, liveEvents);
  const stages = deriveStages(events);
  const activities = extractActivities(events);

  const isRunning = localRun.overall_status === "running";
  const showMinimalProgress = isRunning && stages.length === 0 && activities.length === 0;

  return (
    <div className="space-y-0.5">
      {showMinimalProgress && (
        <div className="flex items-center gap-3 py-1.5">
          <Loader2 size={14} className="animate-spin text-blue-400" />
          <span className="text-sm text-gray-300">分析进行中…</span>
        </div>
      )}
      {stages.map(stage => (
        <StageRow key={stage.name} stage={stage} />
      ))}
      <ActivityLog activities={activities} />
      {localRun.elapsed_s != null && localRun.elapsed_s > 0 && (
        <div className="pt-1 text-right text-xs text-gray-500">
          合计 {fmt(localRun.elapsed_s)}
        </div>
      )}
    </div>
  );
}
