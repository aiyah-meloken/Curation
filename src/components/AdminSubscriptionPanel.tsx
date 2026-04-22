import { useState } from "react";
import { Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { useDajialaBalance } from "../hooks/useDajialaBalance";
import {
  useAdminByAccount,
  useAdminByUser,
  BizSummary,
  UserSummary,
} from "../hooks/useAdminSubscriptions";
import { SubscribeModal } from "./SubscribeModal";

type Tab = "by-account" | "by-user";

export function AdminSubscriptionPanel() {
  const [tab, setTab] = useState<Tab>("by-account");
  const [includeEnded, setIncludeEnded] = useState(false);
  const [subscribeFor, setSubscribeFor] = useState<number[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const { data: balance } = useDajialaBalance();
  const byAccount = useAdminByAccount(includeEnded);
  const byUser = useAdminByUser(includeEnded);

  const toggleExpanded = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const closeWindow = async (windowId: number) => {
    await apiFetch(`/api/admin/subscriptions/windows/${windowId}/close`, { method: "POST" });
    qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
  };

  const deleteWindow = async (windowId: number) => {
    if (!confirm("删除此订阅记录？（该用户历史将丢失）")) return;
    await apiFetch(`/api/admin/subscriptions/windows/${windowId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Balance header */}
      <div style={{ padding: "12px 20px", background: "var(--bg-panel)",
                    borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <MetricCell label="当前余额" value={balance?.current_remain} prefix="¥" />
          <MetricCell label="今日消耗" value={balance?.today_consumed} prefix="¥" />
          <MetricCell label="昨日消耗" value={balance?.yesterday_consumed} prefix="¥" />
          <MetricCell label="跨日变化" value={balance?.day_delta} prefix="¥" />
          <div style={{ marginLeft: "auto", color: "var(--text-faint)", fontSize: "0.72rem" }}>
            {balance?.latest_snapshot_at
              ? `最近快照：${new Date(balance.latest_snapshot_at).toLocaleString("zh-CN")}`
              : "暂无快照"}
          </div>
        </div>
      </div>

      {/* Tabs + filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 20px",
                    borderBottom: "1px solid var(--border)" }}>
        <TabButton active={tab === "by-account"} onClick={() => setTab("by-account")}>
          按公众号
        </TabButton>
        <TabButton active={tab === "by-user"} onClick={() => setTab("by-user")}>
          按用户
        </TabButton>
        <label style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--text-muted)",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={includeEnded}
            onChange={e => setIncludeEnded(e.target.checked)}
          />
          显示已结束的订阅
        </label>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px" }}>
        {tab === "by-account" && (byAccount.data || []).map(row => (
          <AccountRow
            key={row.biz}
            row={row}
            expanded={expanded.has(`a:${row.biz}`)}
            onToggle={() => toggleExpanded(`a:${row.biz}`)}
            onAddSubscriber={() => alert("待实现：多用户订阅选择")}
            onClose={closeWindow}
            onDelete={deleteWindow}
          />
        ))}
        {tab === "by-account" && byAccount.data?.length === 0 && (
          <EmptyState msg="暂无公众号订阅" />
        )}
        {tab === "by-user" && (byUser.data || []).map(row => (
          <UserRow
            key={row.user_id}
            row={row}
            expanded={expanded.has(`u:${row.user_id}`)}
            onToggle={() => toggleExpanded(`u:${row.user_id}`)}
            onAddAccount={() => setSubscribeFor([row.user_id])}
            onClose={closeWindow}
            onDelete={deleteWindow}
          />
        ))}
        {tab === "by-user" && byUser.data?.length === 0 && (
          <EmptyState msg="暂无用户订阅" />
        )}
      </div>

      {subscribeFor !== null && (
        <SubscribeModal
          open
          targetUserIds={subscribeFor}
          onClose={() => setSubscribeFor(null)}
          onSuccess={() => {
            setSubscribeFor(null);
            qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-faint)",
                  fontSize: "0.85rem" }}>
      {msg}
    </div>
  );
}

function MetricCell({ label, value, prefix = "" }:
    { label: string; value: number | null | undefined; prefix?: string }) {
  const display = value == null ? "—" : `${prefix} ${Math.abs(value).toFixed(2)}`;
  return (
    <div>
      <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>{label}</div>
      <div style={{ color: "var(--text-primary)", fontSize: "1.05rem", fontWeight: 600 }}>
        {display}
      </div>
    </div>
  );
}

function TabButton({ active, children, onClick }:
    { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ background: "none", border: "none",
               color: active ? "var(--text-primary)" : "var(--text-muted)",
               borderBottom: active ? "2px solid var(--accent-gold)" : "2px solid transparent",
               padding: "6px 4px", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

function AccountRow({ row, expanded, onToggle, onAddSubscriber, onClose, onDelete }: {
  row: BizSummary;
  expanded: boolean;
  onToggle: () => void;
  onAddSubscriber: () => void;
  onClose: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div style={{ background: "var(--bg-base)", borderRadius: 7, marginBottom: 6,
                  padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onToggle} style={{ background: "none", border: "none",
                                            cursor: "pointer", color: "var(--text-muted)",
                                            padding: 0 }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {row.avatar_url && (
          <img src={row.avatar_url} alt="" referrerPolicy="no-referrer"
               style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--text-primary)", fontSize: "0.82rem",
                        fontWeight: 500 }}>
            {row.name || row.biz}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
            {row.subscriber_count} 订阅 · {row.active_count} 活跃 · {row.article_count} 文章
            {row.avg_daily_freq ? ` · ${row.avg_daily_freq.toFixed(1)} 篇/天` : ""}
            {row.estimated_daily_cost ? ` · ¥${row.estimated_daily_cost.toFixed(3)}/天` : ""}
            {row.last_monitored_at
              ? ` · 最后同步 ${new Date(row.last_monitored_at).toLocaleDateString("zh-CN")}`
              : ""}
          </div>
        </div>
        <button
          onClick={onAddSubscriber}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 5,
                   color: "var(--accent-blue)", padding: "4px 8px", cursor: "pointer",
                   fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 4 }}
        >
          <Plus size={11} /> 添加订阅者
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, paddingLeft: 30 }}>
          {row.subscribers.map(s => (
            <div
              key={s.window_id}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0",
                       fontSize: "0.76rem",
                       color: s.ended_at ? "var(--text-faint)" : "var(--text-primary)" }}
            >
              <span style={{ flex: 1 }}>
                {s.user_name} · {new Date(s.started_at).toLocaleDateString("zh-CN")} 起
                {s.ended_at
                  ? ` · 已结束 ${new Date(s.ended_at).toLocaleDateString("zh-CN")}`
                  : ""}
              </span>
              {!s.ended_at && (
                <button
                  onClick={() => onClose(s.window_id)}
                  style={{ background: "none", border: "1px solid var(--border)",
                           borderRadius: 4, color: "var(--text-muted)", padding: "2px 6px",
                           cursor: "pointer", fontSize: "0.7rem" }}
                >
                  关闭订阅
                </button>
              )}
              <button
                onClick={() => onDelete(s.window_id)}
                style={{ background: "none", border: "none", color: "var(--text-muted)",
                         cursor: "pointer" }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({ row, expanded, onToggle, onAddAccount, onClose, onDelete }: {
  row: UserSummary;
  expanded: boolean;
  onToggle: () => void;
  onAddAccount: () => void;
  onClose: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div style={{ background: "var(--bg-base)", borderRadius: 7, marginBottom: 6,
                  padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onToggle} style={{ background: "none", border: "none",
                                            cursor: "pointer", color: "var(--text-muted)",
                                            padding: 0 }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--text-primary)", fontSize: "0.82rem",
                        fontWeight: 500 }}>
            {row.user_name}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
            {row.email} · {row.window_count} 订阅 · {row.active_count} 活跃
          </div>
        </div>
        <button
          onClick={onAddAccount}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 5,
                   color: "var(--accent-blue)", padding: "4px 8px", cursor: "pointer",
                   fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 4 }}
        >
          <Plus size={11} /> 添加公众号
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, paddingLeft: 30 }}>
          {row.windows.map(w => (
            <div
              key={w.window_id}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0",
                       fontSize: "0.76rem",
                       color: w.ended_at ? "var(--text-faint)" : "var(--text-primary)" }}
            >
              <span style={{ flex: 1 }}>
                {w.name || w.biz} · {new Date(w.started_at).toLocaleDateString("zh-CN")} 起
                {w.ended_at
                  ? ` · 已结束 ${new Date(w.ended_at).toLocaleDateString("zh-CN")}`
                  : ""}
              </span>
              {!w.ended_at && (
                <button
                  onClick={() => onClose(w.window_id)}
                  style={{ background: "none", border: "1px solid var(--border)",
                           borderRadius: 4, color: "var(--text-muted)", padding: "2px 6px",
                           cursor: "pointer", fontSize: "0.7rem" }}
                >
                  关闭订阅
                </button>
              )}
              <button
                onClick={() => onDelete(w.window_id)}
                style={{ background: "none", border: "none", color: "var(--text-muted)",
                         cursor: "pointer" }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
