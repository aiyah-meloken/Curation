import { useState, useMemo } from "react";
import { X, Loader2, Plus, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { useDiscoverableAccounts, DiscoverableAccount } from "../hooks/useDiscoverableAccounts";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** If provided, subscription is created for these users (admin proxy). Omit to subscribe caller. */
  targetUserIds?: number[];
}

type PendingItem = { biz?: string; name?: string; label: string };

export function SubscribeModal({ open, onClose, onSuccess, targetUserIds }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, PendingItem>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const qc = useQueryClient();

  const firstTarget = targetUserIds?.[0];
  const { data: discoverable = [], isLoading } = useDiscoverableAccounts(firstTarget, open);

  const filtered = useMemo(() => {
    if (!search.trim()) return discoverable;
    const q = search.trim().toLowerCase();
    return discoverable.filter(
      a => (a.name || "").toLowerCase().includes(q)
        || (a.description || "").toLowerCase().includes(q),
    );
  }, [discoverable, search]);

  const hasExactMatch = useMemo(
    () => !!search.trim() && discoverable.some(a => (a.name || "") === search.trim()),
    [discoverable, search],
  );

  if (!open) return null;

  const toggle = (a: DiscoverableAccount) => {
    const key = `biz:${a.biz}`;
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, { biz: a.biz, label: a.name });
      return next;
    });
  };

  const addByName = () => {
    const name = search.trim();
    if (!name) return;
    const key = `name:${name}`;
    setSelected(prev => {
      const next = new Map(prev);
      if (!next.has(key)) next.set(key, { name, label: name });
      return next;
    });
    setSearch("");
  };

  const submit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setResults(null);
    try {
      const items = Array.from(selected.values()).map(it =>
        it.biz ? { biz: it.biz } : { name: it.name });
      const body: Record<string, unknown> = { items };
      if (targetUserIds && targetUserIds.length > 0) body.target_user_ids = targetUserIds;
      const resp = await apiFetch("/accounts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json());
      setResults(resp.results || []);
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      const allOk = (resp.results || []).every((r: any) => r.status === "ok");
      if (resp.status === "ok" && allOk) {
        setSelected(new Map());
        onSuccess();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
               display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12,
                 padding: 20, width: 520, maxWidth: "92vw", maxHeight: "80vh",
                 display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                      marginBottom: 14 }}>
          <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1rem" }}>订阅公众号</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer",
                                             color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索已追踪的公众号，或输入新公众号名称"
          autoFocus
          style={{ background: "var(--bg-base)", border: "1px solid var(--border)",
                   borderRadius: 6, padding: "8px 12px", color: "var(--text-primary)",
                   fontSize: "0.85rem", outline: "none", marginBottom: 10 }}
        />

        <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border)",
                      borderRadius: 6 }}>
          {isLoading ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
              <Loader2 size={18} className="animate-spin" style={{ display: "inline-block" }} />
            </div>
          ) : (
            <>
              {filtered.map(a => {
                const key = `biz:${a.biz}`;
                const checked = selected.has(key);
                return (
                  <div
                    key={key}
                    onClick={() => toggle(a)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                             cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                  >
                    <div style={{ width: 18, height: 18, border: "1px solid var(--border)",
                                  borderRadius: 4, display: "flex", alignItems: "center",
                                  justifyContent: "center",
                                  background: checked ? "var(--accent-gold)" : "transparent" }}>
                      {checked && <Check size={12} color="#1a1208" />}
                    </div>
                    {a.avatar_url && (
                      <img src={a.avatar_url} alt="" referrerPolicy="no-referrer"
                           style={{ width: 28, height: 28, borderRadius: "50%" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "var(--text-primary)", fontSize: "0.82rem",
                                    fontWeight: 500 }}>
                        {a.name}
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.72rem",
                                    overflow: "hidden", textOverflow: "ellipsis",
                                    whiteSpace: "nowrap" }}>
                        {a.description}
                      </div>
                    </div>
                    {a.already_subscribed && (
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)",
                                     background: "var(--bg-base)", padding: "2px 6px",
                                     borderRadius: 4 }}>
                        已订阅
                      </span>
                    )}
                  </div>
                );
              })}
              {search.trim() && !hasExactMatch && (
                <div
                  onClick={addByName}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                           cursor: "pointer", color: "var(--accent-blue)", fontSize: "0.82rem" }}
                >
                  <Plus size={14} /> 添加新公众号『{search.trim()}』
                </div>
              )}
              {!isLoading && filtered.length === 0 && !search.trim() && (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-faint)",
                              fontSize: "0.8rem" }}>
                  暂无可发现的公众号
                </div>
              )}
            </>
          )}
        </div>

        {results && (
          <div style={{ marginTop: 10, maxHeight: 120, overflowY: "auto", fontSize: "0.78rem" }}>
            {results.map((r, i) => (
              <div
                key={i}
                style={{ color: r.status === "ok" ? "var(--accent-green)" : "var(--accent-red)" }}
              >
                {r.status === "ok" ? "✓" : "✗"} {r.name || r.input?.name || r.input?.biz}
                {r.error ? `: ${r.error}` : ""}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            已选 {selected.size} 个
          </span>
          <button
            onClick={submit}
            disabled={submitting || selected.size === 0}
            style={{ background: "var(--accent-gold)", color: "#1a1208", border: "none",
                     borderRadius: 6, padding: "8px 18px",
                     cursor: submitting || selected.size === 0 ? "default" : "pointer",
                     fontSize: "0.85rem",
                     opacity: submitting || selected.size === 0 ? 0.6 : 1,
                     display: "flex", alignItems: "center", gap: 6 }}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            订阅
          </button>
        </div>
      </div>
    </div>
  );
}
