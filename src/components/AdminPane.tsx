import { ShieldCheck } from "lucide-react";
import { AdminSubscriptionPanel } from "./AdminSubscriptionPanel";
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
  return (
    <>
      {/* Admin toolbar with tabs */}
      <div className="reader-toolbar" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, justifyContent: 'flex-start', gap: 8 }}>
        <ShieldCheck size={15} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', fontWeight: 600, flexShrink: 0 }}>管理</span>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
          <button
            onClick={() => onAdminViewChange("management")}
            style={{
              fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
              background: adminView === "management" ? 'var(--accent-gold)' : 'var(--bg-panel)',
              color: adminView === "management" ? '#1a1208' : 'var(--text-muted)',
            }}
          >
            公众号订阅管理
          </button>
          <button
            onClick={() => onAdminViewChange("queue")}
            style={{
              fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
              background: adminView === "queue" ? 'var(--accent-gold)' : 'var(--bg-panel)',
              color: adminView === "queue" ? '#1a1208' : 'var(--text-muted)',
            }}
          >
            文章队列
          </button>
          <button
            onClick={() => onAdminViewChange("aggregation")}
            style={{
              fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
              background: adminView === "aggregation" ? 'var(--accent-gold)' : 'var(--bg-panel)',
              color: adminView === "aggregation" ? '#1a1208' : 'var(--text-muted)',
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
                  background: adminView === "invites" ? 'var(--accent-gold)' : 'var(--bg-panel)',
                  color: adminView === "invites" ? '#1a1208' : 'var(--text-muted)',
                }}
              >
                邀请码
              </button>
              <button
                onClick={() => onAdminViewChange("users")}
                style={{
                  fontSize: '0.75rem', padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  background: adminView === "users" ? 'var(--accent-gold)' : 'var(--bg-panel)',
                  color: adminView === "users" ? '#1a1208' : 'var(--text-muted)',
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
          <AdminSubscriptionPanel />
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
