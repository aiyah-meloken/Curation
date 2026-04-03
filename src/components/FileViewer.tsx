import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { apiFetch } from "../lib/api";
import { StreamReplay } from "./StreamReplay";

interface Props {
  runId: number;
}

const FILE_LABELS: Record<string, string> = {
  "final_output.md":  "最终成文",
  "delivery_plan.md": "交付方案",
  "tone_field.md":    "调性场",
};

function fileLabel(f: string): string {
  if (FILE_LABELS[f]) return FILE_LABELS[f];
  const name = f.split("/").pop() ?? f;
  if (name.startsWith("eval_")) return "评估: " + name.replace("eval_", "").replace(".md", "");
  if (name.startsWith("iog_")) return "IOG: " + name.replace(".md", "");
  return name;
}

function fileGroup(f: string): string {
  if (f.startsWith("evaluations/")) return "evaluations";
  if (f.startsWith("iogs/")) return "iogs";
  return "output";
}

export function FileViewer({ runId }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [hasStream, setHasStream] = useState(false);
  const [showReplay, setShowReplay] = useState(false);

  useEffect(() => {
    setFiles([]);
    setSelected(null);
    setContent("");
    setShowReplay(false);
    apiFetch(`/runs/${runId}/files`)
      .then(r => r.json())
      .then(resp => {
        const list: string[] = resp.data ?? [];
        setFiles(list);
        const preferred = list.find(f => f === "final_output.md") ?? list[0];
        if (preferred) setSelected(preferred);
      });
    // Check if stream.jsonl exists
    apiFetch(`/runs/${runId}/stream/summary`)
      .then(r => r.json())
      .then(resp => setHasStream(resp.data != null && resp.data.total_lines > 0))
      .catch(() => setHasStream(false));
  }, [runId]);

  useEffect(() => {
    if (!selected || showReplay) return;
    setLoading(true);
    apiFetch(`/runs/${runId}/files/${selected}`)
      .then(r => r.json())
      .then(resp => setContent(resp.content ?? ""))
      .finally(() => setLoading(false));
  }, [runId, selected, showReplay]);

  if (files.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-8">
        暂无产出文件
      </div>
    );
  }

  const groups = ["output", "iogs", "evaluations"];
  const grouped: Record<string, string[]> = { output: [], iogs: [], evaluations: [] };
  files.forEach(f => grouped[fileGroup(f)].push(f));

  return (
    <div className="flex flex-col h-full">
      {/* File selector tabs */}
      <div className="flex flex-wrap gap-1 pb-2 border-b border-gray-700">
        {groups.map(g =>
          grouped[g].map(f => (
            <button
              key={f}
              onClick={() => { setSelected(f); setShowReplay(false); }}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                selected === f && !showReplay
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {fileLabel(f)}
            </button>
          ))
        )}
        {hasStream && (
          <button
            onClick={() => setShowReplay(true)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              showReplay
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Agent 回放
          </button>
        )}
      </div>

      {/* Content */}
      {showReplay ? (
        <div className="flex-1 overflow-hidden mt-2">
          <StreamReplay runId={runId} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto mt-3 prose prose-invert prose-sm max-w-none">
          {loading ? (
            <div className="text-gray-500 text-sm">加载中…</div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          )}
        </div>
      )}
    </div>
  );
}
