import { ArrowUp, ArrowDown } from "lucide-react";
import type { ReactNode } from "react";

export function fmtTime(t: string | null | undefined): string {
  if (!t) return "—";
  return t.replace("T", " ").slice(5, 16);
}

export function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "zh-Hans-CN");
}

export function runStatusColor(s: string): string {
  const m: Record<string, string> = {
    done: "var(--accent-green)",
    failed: "var(--accent-red)",
    running: "var(--accent-gold)",
    pending: "var(--text-muted)",
  };
  return m[s] ?? "var(--text-muted)";
}

export function statusLabel(
  s: string,
  failReason?: string | null,
  retryCount?: number,
  lastErrorType?: string | null,
) {
  const m: Record<string, { text: string; color: string }> = {
    pending:  { text: "待处理", color: "var(--text-muted)" },
    queued:   { text: "已排队", color: "var(--accent-blue)" },
    running:  { text: "运行中", color: "var(--accent-gold)" },
    done:     { text: "完成",   color: "var(--accent-green)" },
    failed:   { text: "失败",   color: "var(--accent-red)" },
    locked:   { text: "已锁定", color: "var(--accent-green)" },
  };
  const v = m[s] ?? { text: s, color: "var(--text-muted)" };
  const retrying = s === "pending" && retryCount && retryCount > 0;
  const displayText = retrying ? `待重试(${retryCount})` : v.text;
  const displayColor = retrying ? "var(--accent-gold)" : v.color;
  const tooltip = retrying
    ? `${lastErrorType || "unknown"}: ${failReason || ""}`
    : (failReason || undefined);
  return (
    <span title={tooltip}
          style={{ color: displayColor, fontSize: "var(--fs-sm)",
                   cursor: tooltip ? "help" : undefined }}>
      {displayText}
    </span>
  );
}

export function routingPill(routing: string | null | undefined) {
  if (!routing) {
    return (
      <span style={{ background: "var(--bg-base)", color: "var(--text-faint)",
                     padding: "1px 8px", borderRadius: 10, fontSize: "var(--fs-xs)" }}>
        未推送
      </span>
    );
  }
  const m: Record<string, { text: string; bg: string; color: string }> = {
    ai_curation:   { text: "AI梳理",   bg: "var(--bg-panel)", color: "var(--accent-green)" },
    reading_guide: { text: "阅前导读", bg: "var(--bg-panel)", color: "var(--accent-green)" },
    post_read:     { text: "阅后梳理", bg: "var(--bg-panel)", color: "var(--accent-gold)" },
    discard:       { text: "丢弃",     bg: "var(--bg-panel)", color: "var(--accent-gold)" },
    // legacy
    original_push: { text: "原文推送", bg: "var(--bg-panel)", color: "var(--accent-green)" },
  };
  const v = m[routing] ?? { text: routing, bg: "var(--bg-base)", color: "var(--text-faint)" };
  return (
    <span style={{ background: v.bg, color: v.color,
                   padding: "1px 8px", borderRadius: 10, fontSize: "var(--fs-xs)" }}>
      {v.text}
    </span>
  );
}

/** Sortable grid column header. `align="center"` for centered columns. */
export function SortableHeader({
  label, active, dir, onClick, align,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "center";
}): ReactNode {
  return (
    <span onClick={onClick}
          style={{
            cursor: "pointer", userSelect: "none",
            display: "inline-flex", alignItems: "center",
            justifyContent: align === "center" ? "center" : undefined,
            gap: 2,
          }}>
      {label}
      {active && (dir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
    </span>
  );
}
