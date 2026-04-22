import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { UserDrawer } from "./UserDrawer";

interface AppUser {
  id: number;
  phone: string | null;
  email: string;
  username: string;
  picture: string | null;
  role: "admin" | "user";
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

type SortKey = "username" | "phone" | "email" | "role" | "is_active" | "created_at" | "last_login";
type SortDir = "asc" | "desc";

export function UserManagementPanel() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [drawerUser, setDrawerUser] = useState<AppUser | null>(null);

  async function fetchUsers() {
    setLoading(true);
    const resp = await apiFetch("/users");
    if (resp.ok) setUsers(await resp.json());
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...users].sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [users, sortKey, sortDir]);

  async function handleUpdate(userId: number, patch: { role?: string; is_active?: boolean }) {
    await apiFetch(`/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await fetchUsers();
  }

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

  return (
    <div style={{ padding: 20, color: "var(--text-primary)", fontSize: 13 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 600 }}>用户管理</h2>

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>加载中…</p>
      ) : users.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>暂无用户</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
              <SortTh label="用户" col="username" />
              <SortTh label="手机号" col="phone" />
              <SortTh label="邮箱" col="email" />
              <SortTh label="角色" col="role" />
              <SortTh label="状态" col="is_active" />
              <SortTh label="注册时间" col="created_at" />
              <SortTh label="最后登录" col="last_login" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => (
              <tr key={u.id}
                  onClick={() => setDrawerUser(u)}
                  style={{ borderBottom: "1px solid var(--bg-panel)", cursor: "pointer" }}>
                <td style={{ ...td, display: "flex", alignItems: "center", gap: 8 }}>
                  {u.picture ? (
                    <img
                      src={u.picture}
                      alt=""
                      style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: "var(--border)", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 12, color: "var(--text-muted)",
                    }}>
                      {(u.username || "?")[0]}
                    </span>
                  )}
                  <span>{u.username || "—"}</span>
                </td>
                <td style={td}>{u.phone || "—"}</td>
                <td style={{ ...td, color: "var(--text-muted)" }}>{u.email || "—"}</td>
                <td style={{ ...td, color: u.role === "admin" ? "var(--accent-gold-hi)" : "var(--text-muted)", fontSize: 12 }}>
                  {u.role}
                </td>
                <td style={td} onClick={e => e.stopPropagation()}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={u.is_active}
                      onChange={(e) => handleUpdate(u.id, { is_active: e.target.checked })}
                    />
                    <span style={{ color: u.is_active ? "var(--accent-green)" : "var(--text-muted)" }}>
                      {u.is_active ? "活跃" : "禁用"}
                    </span>
                  </label>
                </td>
                <td style={{ ...td, color: "var(--text-muted)" }}>
                  {u.created_at ? u.created_at.slice(0, 10) : "—"}
                </td>
                <td style={{ ...td, color: "var(--text-muted)" }}>
                  {u.last_login ? u.last_login.slice(0, 10) : "从未"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {drawerUser && (
        <UserDrawer user={drawerUser} onClose={() => setDrawerUser(null)} />
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 12px",
  fontWeight: 500,
  fontSize: 12,
};

const td: React.CSSProperties = {
  padding: "8px 12px",
};
