import { useEffect, useMemo, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { apiFetch } from "../lib/api";

interface InviteCode {
  id: number;
  code: string;
  is_active: boolean;
  use_count: number;
  max_uses: number | null;
  last_used_by_email: string | null;
  creator_email: string | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

type SortKey = "code" | "is_active" | "use_count" | "expires_at" | "last_used_at" | "created_at";
type SortDir = "asc" | "desc";

export function InviteManagementPanel() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [count, setCount] = useState(1);
  const [maxUses, setMaxUses] = useState<string>("");       // "" = unlimited
  const [expiresInDays, setExpiresInDays] = useState<string>("");  // "" = never
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function fetchCodes() {
    setLoading(true);
    const resp = await apiFetch("/invites");
    if (resp.ok) setCodes(await resp.json());
    setLoading(false);
  }

  useEffect(() => { fetchCodes(); }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...codes].sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [codes, sortKey, sortDir]);

  function SortTh({ label, col }: { label: string; col: SortKey }) {
    const active = sortKey === col;
    return (
      <th
        style={{ ...th, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
        onClick={() => handleSort(col)}
      >
        {label}
        <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3 }}>
          {active && sortDir === "desc" ? "↓" : "↑"}
        </span>
      </th>
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    const body: Record<string, number> = { count };
    if (maxUses !== "") body.max_uses = Number(maxUses);
    if (expiresInDays !== "") body.expires_in_days = Number(expiresInDays);
    const resp = await apiFetch("/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (resp.ok) await fetchCodes();
    setGenerating(false);
  }

  async function handleRevoke(code: string) {
    await apiFetch(`/invites/${code}`, { method: "DELETE" });
    await fetchCodes();
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  function usageLabel(c: InviteCode) {
    if (c.max_uses === null) return `${c.use_count} 次`;
    return `${c.use_count} / ${c.max_uses}`;
  }

  function statusLabel(c: InviteCode) {
    if (!c.is_active) return { text: "已撤销", bg: "var(--bg-panel)", color: "var(--text-muted)" };
    if (c.max_uses !== null && c.use_count >= c.max_uses)
      return { text: "已满", bg: "var(--accent-gold-dim)", color: "var(--accent-gold)" };
    return { text: "可用", bg: "var(--bg-panel)", color: "var(--accent-green)" };
  }

  return (
    <div style={{ padding: 20, color: "var(--text-primary)", fontSize: 13 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>邀请码管理</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
          <label style={{ color: "var(--text-muted)" }}>数量</label>
          <input
            type="number" min={1} max={20} value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            style={numInput(52)}
          />
          <label style={{ color: "var(--text-muted)" }}>次数上限</label>
          <input
            type="number" min={1} placeholder="无限"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            style={numInput(72)}
          />
          <label style={{ color: "var(--text-muted)" }}>有效天数</label>
          <input
            type="number" min={1} placeholder="永久"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            style={numInput(72)}
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: "6px 14px",
              background: "var(--accent-green)",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {generating ? "生成中…" : "生成邀请码"}
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>加载中…</p>
      ) : codes.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>暂无邀请码</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
              <SortTh label="邀请码" col="code" />
              <SortTh label="状态" col="is_active" />
              <SortTh label="已用/上限" col="use_count" />
              <SortTh label="到期时间" col="expires_at" />
              <SortTh label="最近使用" col="last_used_at" />
              <th style={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const status = statusLabel(c);
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--bg-panel)" }}>
                  <td style={td}>
                    <code style={{ fontSize: 12, color: "var(--accent-blue)" }}>{c.code}</code>
                  </td>
                  <td style={td}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 12, fontSize: 11,
                      background: status.bg, color: status.color,
                    }}>
                      {status.text}
                    </span>
                  </td>
                  <td style={{ ...td, color: "var(--text-muted)" }}>{usageLabel(c)}</td>
                  <td style={{ ...td, color: "var(--text-muted)" }}>
                    {c.expires_at ? c.expires_at.slice(0, 10) : "永久"}
                  </td>
                  <td style={{ ...td, color: "var(--text-muted)" }}>{c.last_used_by_email || "—"}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleCopy(c.code)} title="复制" style={iconBtn}>
                        {copied === c.code
                          ? <span style={{ fontSize: 11, color: "var(--accent-green)" }}>✓</span>
                          : <Copy size={13} />}
                      </button>
                      {c.is_active && (
                        <button
                          onClick={() => handleRevoke(c.code)}
                          title="撤销"
                          style={{ ...iconBtn, color: "var(--accent-red)" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function numInput(width: number): React.CSSProperties {
  return {
    width,
    padding: "4px 8px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--text-primary)",
    fontSize: 13,
  };
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 12px",
  fontWeight: 500,
  fontSize: 12,
};

const td: React.CSSProperties = { padding: "8px 12px" };

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text-muted)",
  padding: 4,
  display: "flex",
  alignItems: "center",
};
