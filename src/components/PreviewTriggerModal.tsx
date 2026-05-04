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

function dateRange(start: string, end: string): string[] {
  if (!start || !end) return [];
  const dates: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  // Guard: don't loop forever if start > end
  if (cur > last) return [];
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
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
      await previewDedup(Array.from(selectedUsers), dates);
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setSubmitting(false);
    }
  };

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

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button onClick={onClose}
            style={{
              background: "var(--bg-base)", border: "1px solid var(--border)",
              color: "var(--text-muted)", borderRadius: 4,
              padding: "5px 16px", cursor: "pointer", fontSize: "var(--fs-sm)",
            }}>
            取消
          </button>
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
        </div>
      </div>
    </div>
  );
}
