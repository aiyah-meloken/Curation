import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Square, FastForward, FileText, Terminal, Cpu } from "lucide-react";
import { apiFetch } from "../lib/api";

interface Props {
  runId: number;
}

interface StreamSummary {
  total_lines: number;
  tool_calls: number;
  size_bytes: number;
  event_types: Record<string, number>;
}

interface StreamEvent {
  type: string;
  [key: string]: any;
}

type PlayState = "idle" | "playing" | "paused" | "done";

const PAGE_SIZE = 50;

// ── Event rendering ──────────────────────────────────────────────────────────

function renderEvent(ev: StreamEvent, index: number): React.ReactNode | null {
  const t = ev.type;

  // pi: tool execution
  if (t === "tool_execution_start") {
    const args = ev.args || {};
    const detail = args.path || args.file_path || args.pattern
      || (ev.toolName?.toLowerCase() === "bash" ? (args.command || "").slice(0, 100) : "")
      || "";
    return (
      <div key={index} className="flex items-start gap-2 py-0.5">
        <Terminal size={12} className="text-blue-400 mt-0.5 shrink-0" />
        <span className="text-blue-400 text-xs w-12 shrink-0">{ev.toolName}</span>
        <span className="text-xs text-gray-400 truncate">{detail}</span>
      </div>
    );
  }

  // pi: agent lifecycle
  if (t === "agent_start") {
    return (
      <div key={index} className="flex items-center gap-2 py-1 text-xs text-green-400">
        <Cpu size={12} /> Agent 启动
      </div>
    );
  }
  if (t === "agent_end") {
    return (
      <div key={index} className="flex items-center gap-2 py-1 text-xs text-green-400">
        <Cpu size={12} /> Agent 结束
      </div>
    );
  }

  // pi: turn boundaries
  if (t === "turn_start") {
    const turnNum = ev.turnNumber || "";
    return (
      <div key={index} className="text-xs text-gray-600 py-0.5 border-t border-gray-800 mt-1">
        ── Turn {turnNum} ──
      </div>
    );
  }

  // pi: message content (text output from the agent)
  if (t === "message_end") {
    const content = ev.content;
    if (typeof content === "string" && content.trim()) {
      const trimmed = content.length > 300 ? content.slice(0, 300) + "…" : content;
      return (
        <div key={index} className="text-xs text-gray-300 py-0.5 pl-4 whitespace-pre-wrap">
          {trimmed}
        </div>
      );
    }
  }

  // claude: assistant message with tool_use
  if (t === "assistant") {
    const content = ev.message?.content || [];
    const tools = content.filter((b: any) => b.type === "tool_use");
    if (tools.length === 0) return null;
    return (
      <div key={index}>
        {tools.map((tool: any, i: number) => {
          const inp = tool.input || {};
          const detail = inp.file_path || inp.path || inp.pattern
            || (tool.name === "Bash" ? (inp.command || "").slice(0, 100) : "")
            || "";
          return (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <Terminal size={12} className="text-blue-400 mt-0.5 shrink-0" />
              <span className="text-blue-400 text-xs w-12 shrink-0">{tool.name}</span>
              <span className="text-xs text-gray-400 truncate">{detail}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // claude: result
  if (t === "result") {
    const cost = ev.total_cost_usd;
    const dur = ev.duration_ms;
    return (
      <div key={index} className="flex items-center gap-2 py-1 text-xs text-green-400">
        <Cpu size={12} />
        完成
        {cost != null && <span className="text-gray-500">· ${cost.toFixed(4)}</span>}
        {dur != null && <span className="text-gray-500">· {(dur / 1000).toFixed(1)}s</span>}
      </div>
    );
  }

  // Skip noisy events (message_update, message_start, session, etc.)
  return null;
}

// ── Main component ───────────────────────────────────────────────────────────

export function StreamReplay({ runId }: Props) {
  const [summary, setSummary] = useState<StreamSummary | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [displayCount, setDisplayCount] = useState(0);
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [speed, setSpeed] = useState(1); // 1x, 2x, 5x
  const [offset, setOffset] = useState(0);
  const [totalLoaded, setTotalLoaded] = useState(0);

  const timerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<StreamEvent[]>([]);
  eventsRef.current = events;

  // Load summary on mount
  useEffect(() => {
    apiFetch(`/runs/${runId}/stream/summary`)
      .then(r => r.json())
      .then(resp => setSummary(resp.data))
      .catch(() => {});
  }, [runId]);

  // Fetch a page of events
  const fetchPage = useCallback(async (fromOffset: number): Promise<StreamEvent[]> => {
    const resp = await apiFetch(`/runs/${runId}/stream?offset=${fromOffset}&limit=${PAGE_SIZE}`);
    const data = await resp.json();
    return data.data || [];
  }, [runId]);

  // Start / resume replay
  const play = useCallback(async () => {
    if (playState === "idle") {
      // Fresh start — load first page
      setEvents([]);
      setDisplayCount(0);
      setOffset(0);
      setTotalLoaded(0);
      const page = await fetchPage(0);
      setEvents(page);
      setTotalLoaded(page.length);
      setOffset(PAGE_SIZE);
      eventsRef.current = page;
    }
    setPlayState("playing");
  }, [playState, fetchPage]);

  // Pause
  const pause = useCallback(() => {
    setPlayState("paused");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Stop (reset)
  const stop = useCallback(() => {
    setPlayState("idle");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setEvents([]);
    setDisplayCount(0);
    setOffset(0);
    setTotalLoaded(0);
  }, []);

  // Replay timer — advances displayCount and fetches more pages as needed
  useEffect(() => {
    if (playState !== "playing") return;

    const interval = Math.max(10, 80 / speed);
    timerRef.current = window.setInterval(async () => {
      setDisplayCount(prev => {
        const next = prev + 1;

        // Need more data?
        if (next >= eventsRef.current.length - 5 && summary && totalLoaded < summary.total_lines) {
          // Fetch next page (fire and forget, will append)
          fetchPage(offset).then(page => {
            if (page.length > 0) {
              setEvents(prev => [...prev, ...page]);
              eventsRef.current = [...eventsRef.current, ...page];
              setTotalLoaded(t => t + page.length);
              setOffset(o => o + PAGE_SIZE);
            }
          });
        }

        // Done?
        if (next >= eventsRef.current.length && summary && totalLoaded >= summary.total_lines) {
          setPlayState("done");
          if (timerRef.current) clearInterval(timerRef.current);
          return eventsRef.current.length;
        }

        return Math.min(next, eventsRef.current.length);
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playState, speed, offset, totalLoaded, summary, fetchPage]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current && playState === "playing") {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayCount, playState]);

  const speedLabel = speed === 1 ? "1x" : speed === 2 ? "2x" : "5x";

  return (
    <div className="flex flex-col h-full">
      {/* Header: summary + controls */}
      <div className="flex items-center gap-3 pb-2 border-b border-gray-700 shrink-0">
        <FileText size={14} className="text-gray-400" />
        <span className="text-xs text-gray-400">
          stream.jsonl
          {summary && (
            <span className="text-gray-500">
              {" "}· {summary.total_lines} 事件 · {summary.tool_calls} 次工具调用 · {(summary.size_bytes / 1024 / 1024).toFixed(1)}MB
            </span>
          )}
        </span>
        <span className="flex-1" />

        {/* Progress */}
        {playState !== "idle" && summary && (
          <span className="text-xs text-gray-500">
            {displayCount} / {summary.total_lines}
          </span>
        )}

        {/* Speed toggle */}
        <button
          onClick={() => setSpeed(s => s === 1 ? 2 : s === 2 ? 5 : 1)}
          className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
          title="回放速度"
        >
          <FastForward size={11} className="inline mr-1" />
          {speedLabel}
        </button>

        {/* Play / Pause / Stop */}
        {playState === "idle" || playState === "done" ? (
          <button
            onClick={play}
            disabled={!summary || summary.total_lines === 0}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-green-700 text-white hover:bg-green-600 disabled:opacity-50"
          >
            <Play size={12} />
            {playState === "done" ? "重播" : "回放"}
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={playState === "playing" ? pause : play}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-700 text-white hover:bg-blue-600"
            >
              {playState === "playing" ? <Pause size={12} /> : <Play size={12} />}
              {playState === "playing" ? "暂停" : "继续"}
            </button>
            <button
              onClick={stop}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
            >
              <Square size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Event stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto mt-2 font-mono"
        style={{ fontSize: "0.75rem" }}
      >
        {playState === "idle" && (
          <div className="text-gray-500 text-center py-8 text-sm">
            点击「回放」查看子 Agent 的完整执行过程
          </div>
        )}
        {events.slice(0, displayCount).map((ev, i) => renderEvent(ev, i))}
      </div>
    </div>
  );
}
