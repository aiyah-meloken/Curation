import { useState } from "react";
import { Trash2, RefreshCw, Loader2, Plus } from "lucide-react";
import { SubscribeModal } from "./SubscribeModal";

import { apiFetch } from "../lib/api";

interface Account {
  id: number;
  name: string;
  biz: string;
  avatar_url?: string;
  description?: string;
  last_monitored_at?: string;
  article_count?: number;
  subscription_type?: "subscribed" | "temporary";
  avg_daily_freq?: number;
  estimated_daily_cost?: number;
  total_cost?: number;
  sync_count?: number;
}

interface Props {
  accounts: Account[];
  onRefresh: () => void;
}

export function AdminManagementPanel({ accounts, onRefresh }: Props) {
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [syncMsgs, setSyncMsgs] = useState<Record<number, string>>({});
  const [deletingAccId, setDeletingAccId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);

  const subscribedAccounts = accounts.filter(a => !a.subscription_type || a.subscription_type === 'subscribed');
  const temporaryAccounts = accounts.filter(a => a.subscription_type === 'temporary');

  const handleSyncAccount = async (acc: Account) => {
    setSyncingId(acc.id);
    try {
      const resp = await apiFetch(`/accounts/${acc.id}/sync`, { method: "POST" }).then(r => r.json());
      setSyncMsgs(prev => ({
        ...prev,
        [acc.id]: resp.new_count > 0 ? `+${resp.new_count}篇` : "已最新",
      }));
      onRefresh();
    } catch {
      setSyncMsgs(prev => ({ ...prev, [acc.id]: "失败" }));
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeleteAccount = async (acc: Account) => {
    if (!confirm(`删除公众号「${acc.name}」？文章将保留但不再关联。`)) return;
    setDeletingAccId(acc.id);
    setErrorMsg(null);
    try {
      const resp = await apiFetch(`/accounts/${acc.id}`, { method: "DELETE" });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        setErrorMsg(data.detail || `删除失败 (${resp.status})`);
        return;
      }
      onRefresh();
    } catch {
      setErrorMsg("网络错误，删除失败");
    } finally {
      setDeletingAccId(null);
    }
  };

  const renderAccountRow = (acc: Account) => (
    <div key={acc.id} style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "#0d1117", borderRadius: 7, padding: "8px 10px",
    }}>
      {acc.avatar_url && (
        <img src={acc.avatar_url} alt="" referrerPolicy="no-referrer"
          style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#e6edf3", fontSize: "0.82rem", fontWeight: 500 }}>{acc.name}</div>
        <div style={{ color: "#8b949e", fontSize: "0.72rem" }}>
          {acc.article_count ?? 0} 篇文章
          {acc.last_monitored_at ? ` · 最后同步 ${new Date(acc.last_monitored_at).toLocaleDateString("zh-CN")}` : ""}
          {acc.avg_daily_freq != null ? ` · ${acc.avg_daily_freq.toFixed(1)} 篇/天` : ""}
          {acc.estimated_daily_cost != null ? ` · 约 ¥${acc.estimated_daily_cost.toFixed(3)}/天` : ""}
        </div>
      </div>
      {syncMsgs[acc.id] && (
        <span style={{ fontSize: "0.72rem", color: syncMsgs[acc.id].startsWith("+") ? "#3fb950" : "#8b949e" }}>
          {syncMsgs[acc.id]}
        </span>
      )}
      {acc.subscription_type !== "temporary" && (
        <button
          onClick={() => handleSyncAccount(acc)}
          disabled={syncingId !== null}
          title="同步最新文章"
          style={{
            background: "none", border: "1px solid #30363d", borderRadius: 5,
            color: "#8b949e", padding: "4px 8px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4, fontSize: "0.72rem",
            opacity: syncingId !== null ? 0.4 : 1,
          }}
        >
          {syncingId === acc.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          同步
        </button>
      )}
      <button
        onClick={() => handleDeleteAccount(acc)}
        disabled={deletingAccId === acc.id}
        title="删除"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#6e7681", padding: 4, borderRadius: 4,
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {errorMsg && (
        <div style={{ margin: "10px 20px 0", padding: "8px 12px", background: "#3d1a1a", border: "1px solid #6e3535", borderRadius: 6, fontSize: "0.8rem", color: "#f85149", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {errorMsg}
          <button onClick={() => setErrorMsg(null)} style={{ background: "none", border: "none", color: "#f85149", cursor: "pointer", padding: 0, marginLeft: 8 }}>✕</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 24px" }}>

      {/* Accounts */}
      <div style={{ padding: "8px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: "0.72rem", color: "#8b949e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            已订阅公众号
          </span>
          <button
            onClick={() => setIsSubscribeOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "#21262d", border: "1px solid #30363d", borderRadius: 5,
              color: "#60a5fa", fontSize: "0.75rem", padding: "4px 10px", cursor: "pointer",
            }}
          >
            <Plus size={12} /> 订阅
          </button>
        </div>

        {subscribedAccounts.length === 0 ? (
          <p style={{ color: "#4b5563", fontSize: "0.82rem", margin: "8px 0" }}>暂无订阅</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {subscribedAccounts.map(acc => renderAccountRow(acc))}
          </div>
        )}

        {temporaryAccounts.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: "0.68rem", color: "#6e7681", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              临时阅读
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {temporaryAccounts.map(acc => renderAccountRow(acc))}
            </div>
          </div>
        )}
      </div>

      </div>{/* end scroll container */}

      <SubscribeModal
        open={isSubscribeOpen}
        onClose={() => setIsSubscribeOpen(false)}
        onSuccess={() => { setIsSubscribeOpen(false); onRefresh(); }}
      />
    </div>
  );
}
