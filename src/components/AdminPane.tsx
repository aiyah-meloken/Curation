import { ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccounts } from "../hooks/useAccounts";
import { AdminManagementPanel } from "./AdminManagementPanel";
import { ArticleQueuePanel } from "./ArticleQueuePanel";
import AggregationQueuePanel from "./AggregationQueuePanel";
import { InviteManagementPanel } from "./InviteManagementPanel";
import { UserManagementPanel } from "./UserManagementPanel";

type AdminView = "management" | "queue" | "aggregation" | "invites" | "users";

interface AdminPaneProps {
  adminView: AdminView;
  onAdminViewChange: (view: AdminView) => void;
  currentUser: { role: string };
  onExitAdmin: () => void;
}

export function AdminPane({
  adminView, onAdminViewChange, currentUser,
}: AdminPaneProps) {
  const { data: accounts = [] } = useAccounts();
  const qc = useQueryClient();

  return (
    <>
      {/* Admin toolbar with tabs */}
      <div className="reader-toolbar" style={{ borderBottom: '1px solid #30363d', paddingBottom: 8, justifyContent: 'flex-start', gap: 8 }}>
        <ShieldCheck size={15} style={{ color: '#60a5fa', flexShrink: 0 }} />
        <span style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: 600, flexShrink: 0 }}>管理</span>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
          <button
            onClick={() => onAdminViewChange("management")}
            style={{
              fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
              background: adminView === "management" ? '#1f6feb' : '#21262d',
              color: adminView === "management" ? '#fff' : '#8b949e',
            }}
          >
            公众号订阅管理
          </button>
          <button
            onClick={() => onAdminViewChange("queue")}
            style={{
              fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
              background: adminView === "queue" ? '#1f6feb' : '#21262d',
              color: adminView === "queue" ? '#fff' : '#8b949e',
            }}
          >
            文章队列
          </button>
          <button
            onClick={() => onAdminViewChange("aggregation")}
            style={{
              fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
              background: adminView === "aggregation" ? '#1f6feb' : '#21262d',
              color: adminView === "aggregation" ? '#fff' : '#8b949e',
            }}
          >
            聚合队列
          </button>
          {currentUser.role === "admin" && (
            <>
              <button
                onClick={() => onAdminViewChange("invites")}
                style={{
                  fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  background: adminView === "invites" ? '#1f6feb' : '#21262d',
                  color: adminView === "invites" ? '#fff' : '#8b949e',
                }}
              >
                邀请码
              </button>
              <button
                onClick={() => onAdminViewChange("users")}
                style={{
                  fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  background: adminView === "users" ? '#1f6feb' : '#21262d',
                  color: adminView === "users" ? '#fff' : '#8b949e',
                }}
              >
                用户管理
              </button>
            </>
          )}
        </div>
        <div style={{ flex: 1 }} />
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {adminView === "management" ? (
          <AdminManagementPanel accounts={accounts} onRefresh={() => qc.invalidateQueries()} />
        ) : adminView === "queue" ? (
          <ArticleQueuePanel />
        ) : adminView === "aggregation" ? (
          <AggregationQueuePanel />
        ) : adminView === "invites" ? (
          <InviteManagementPanel />
        ) : (
          <UserManagementPanel />
        )}
      </div>
    </>
  );
}
