import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type Status = "loading" | "ok" | "down";

const POLL_MS = 5000;

export function BackendHealthDot() {
  const [status, setStatus] = useState<Status>("loading");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      const t0 = performance.now();
      try {
        const r = await apiFetch("/health");
        if (cancelled) return;
        if (r.ok) {
          setStatus("ok");
          setLatency(Math.round(performance.now() - t0));
        } else {
          setStatus("down");
          setLatency(null);
        }
      } catch {
        if (cancelled) return;
        setStatus("down");
        setLatency(null);
      }
    };

    probe();
    const id = setInterval(probe, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const color =
    status === "ok" ? "var(--accent-green, #4ade80)" :
    status === "down" ? "var(--accent-red, #ef4444)" :
    "var(--text-muted, #888)";

  const tooltip =
    status === "ok" ? `后端健康${latency != null ? ` · ${latency}ms` : ""}` :
    status === "down" ? "后端无响应" :
    "正在探测…";

  return (
    <div
      className="health-dot-wrap"
      data-tooltip={tooltip}
      aria-label={tooltip}
      role="status"
    >
      <span
        className={`health-dot health-dot--${status}`}
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      />
    </div>
  );
}
