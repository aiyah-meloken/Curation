import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { apiFetch, previewDedup } from "../lib/api";

interface AppUser {
  id: number;
  email: string;
  username: string;
  role: "admin" | "user";
  is_active: boolean;
}

interface PreviewSummaryRow {
  user_id: number;
  date: string;
  n_candidates: number;
  n_singletons: number;
  n_forced_singletons: number;
  queue_ids: number[];
}

function dateRange(start: string, end: string): string[] {
  // String-based YYYY-MM-DD arithmetic to avoid timezone-induced drift across
  // browsers in different timezones / DST boundaries. Inputs are 'YYYY-MM-DD'
  // from <input type="date">; iterate in UTC to step a day cleanly.
  if (!start || !end) return [];
  if (start > end) return [];
  const dates: string[] = [];
  let cur = start;
  while (cur <= end) {
    dates.push(cur);
    const [y, m, d] = cur.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d));
    next.setUTCDate(next.getUTCDate() + 1);
    cur = next.toISOString().slice(0, 10);
  }
  return dates;
}

export function PreviewTriggerModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewSummaryRow[] | null>(null);

  useEffect(() => {
    apiFetch("/users")
      .then((r) => r.json())
      .then((all: AppUser[]) => {
        setUsers(all.filter((u) => u.is_active));
      })
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, []);

  const toggleUser = (id: number) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map((u) => u.id)));
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (selectedUsers.size === 0) { setError("请至少选择一个用户"); return; }
    const dates = dateRange(startDate, endDate);
    if (dates.length === 0) { setError("请选择有效的日期范围"); return; }

    setSubmitting(true);
    try {
      const resp = await previewDedup(Array.from(selectedUsers), dates);
      const rows = (resp.summary as PreviewSummaryRow[]) || [];
      setResult(rows);
      onSuccess?.(); // notify parent to refresh queue list, but keep modal open
                     // so the admin can see the per-(user,date) breakdown
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setSubmitting(false);
    }
  };

  const totalCandidates = result?.reduce((s, r) => s + r.n_candidates, 0) ?? 0;
  const userById = new Map(users.map((u) => [u.id, u]));

  return (
    /* Overlay */
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>

      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 24,
          width: 420,
          maxWidth: "90vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          color: "var(--text-primary)",
          fontSize: "var(--fs-sm)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}>

        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: "var(--fs-base)" }}>预触发聚合</span>
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2, display: "flex" }}>
            <X size={16} />
          </button>
        </div>

        {/* User list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)", fontWeight: 500, marginBottom: 2 }}>
            用户
          </div>
          {loadingUsers ? (
            <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>加载中…</span>
          ) : (
            <div style={{
              border: "1px solid var(--border)", borderRadius: 4,
              overflow: "hidden", maxHeight: 180, overflowY: "auto",
            }}>
              {/* Select all */}
              <label style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px",
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
                background: "var(--bg-base)",
                fontSize: "var(--fs-xs)", color: "var(--text-muted)",
              }}>
                <input
                  type="checkbox"
                  checked={users.length > 0 && selectedUsers.size === users.length}
                  onChange={toggleAll}
                  style={{ accentColor: "var(--accent-gold)" }}
                />
                全选 ({users.length})
              </label>
              {users.map((u) => (
                <label key={u.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px",
                  borderBottom: "1px solid var(--bg-panel)",
                  cursor: "pointer",
                  background: selectedUsers.has(u.id)
                    ? "color-mix(in srgb, var(--accent-gold) 8%, transparent)"
                    : undefined,
                }}>
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(u.id)}
                    onChange={() => toggleUser(u.id)}
                    style={{ accentColor: "var(--accent-gold)" }}
                  />
                  <span style={{ flex: 1 }}>{u.username || u.email}</span>
                  <span style={{ color: "var(--text-faint)", fontSize: "var(--fs-xs)" }}>{u.email}</span>
                </label>
              ))}
              {users.length === 0 && (
                <div style={{ padding: "10px", color: "var(--text-faint)", fontSize: "var(--fs-xs)", textAlign: "center" }}>
                  暂无活跃用户
                </div>
              )}
            </div>
          )}
        </div>

        {/* Date range */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)", fontWeight: 500 }}>日期范围</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                flex: 1,
                background: "var(--bg-base)", color: "var(--text-primary)",
                border: "1px solid var(--border)", borderRadius: 4,
                padding: "4px 8px", fontSize: "var(--fs-xs)",
              }}
            />
            <span style={{ color: "var(--text-muted)" }}>—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                flex: 1,
                background: "var(--bg-base)", color: "var(--text-primary)",
                border: "1px solid var(--border)", borderRadius: 4,
                padding: "4px 8px", fontSize: "var(--fs-xs)",
              }}
            />
          </div>
          {startDate && endDate && startDate <= endDate && (
            <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-xs)" }}>
              共 {dateRange(startDate, endDate).length} 天
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ color: "var(--accent-red)", fontSize: "var(--fs-xs)" }}>{error}</div>
        )}

        {/* Result summary (post-submit) */}
        {result && (
          <div style={{
            border: "1px solid var(--border)", borderRadius: 4,
            background: "var(--bg-base)", padding: 10,
            display: "flex", flexDirection: "column", gap: 6,
            maxHeight: 200, overflowY: "auto",
          }}>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
              触发结果：共 {result.length} 组 (user × 日期)，
              入队 cluster 总数{" "}
              <b style={{ color: totalCandidates > 0 ? "var(--accent-green)" : "var(--text-faint)" }}>
                {totalCandidates}
              </b>
              {totalCandidates === 0 && "（说明：该范围内没有跨文章可合并的事件）"}
            </div>
            <table style={{ fontSize: "var(--fs-xs)", borderCollapse: "collapse" }}>
              <thead style={{ color: "var(--text-faint)" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: "2px 6px" }}>用户</th>
                  <th style={{ textAlign: "left", padding: "2px 6px" }}>日期</th>
                  <th style={{ textAlign: "right", padding: "2px 6px" }}>cluster</th>
                  <th style={{ textAlign: "right", padding: "2px 6px" }}>独立卡</th>
                  <th style={{ textAlign: "right", padding: "2px 6px" }}>无法分析</th>
                </tr>
              </thead>
              <tbody>
                {result.map((r) => {
                  const u = userById.get(r.user_id);
                  return (
                    <tr key={`${r.user_id}-${r.date}`}>
                      <td style={{ padding: "2px 6px" }}>{u?.username || u?.email || `#${r.user_id}`}</td>
                      <td style={{ padding: "2px 6px", fontFamily: "monospace" }}>{r.date}</td>
                      <td style={{ padding: "2px 6px", textAlign: "right",
                        color: r.n_candidates > 0 ? "var(--accent-green)" : "var(--text-faint)",
                        fontWeight: r.n_candidates > 0 ? 600 : 400,
                      }}>{r.n_candidates}</td>
                      <td style={{ padding: "2px 6px", textAlign: "right", color: "var(--text-muted)" }}>{r.n_singletons}</td>
                      <td style={{ padding: "2px 6px", textAlign: "right", color: "var(--text-muted)" }}>{r.n_forced_singletons}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button onClick={onClose}
            style={{
              background: "var(--bg-base)", border: "1px solid var(--border)",
              color: "var(--text-muted)", borderRadius: 4,
              padding: "5px 16px", cursor: "pointer", fontSize: "var(--fs-sm)",
            }}>
            {result ? "关闭" : "取消"}
          </button>
          {!result && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                background: submitting ? "var(--bg-base)" : "var(--accent-gold)",
                border: "none", borderRadius: 4,
                color: submitting ? "var(--text-muted)" : "#fff",
                padding: "5px 16px",
                cursor: submitting ? "default" : "pointer",
                fontSize: "var(--fs-sm)", fontWeight: 500,
              }}>
              {submitting ? "提交中…" : "触发"}
            </button>
          )}
          {result && (
            <button
              onClick={() => { setResult(null); setError(null); }}
              style={{
                background: "var(--bg-base)", border: "1px solid var(--border)",
                color: "var(--text-primary)", borderRadius: 4,
                padding: "5px 16px", cursor: "pointer", fontSize: "var(--fs-sm)",
              }}>
              再触发一次
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
