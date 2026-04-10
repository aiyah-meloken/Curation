import { useState } from "react";
import { Rss, ChevronLeft, Menu, Layers, ShieldCheck, LogOut, UserMinus, UserPlus } from "lucide-react";
import { useAccounts, useUnsubscribe, useResubscribe } from "../hooks/useAccounts";
import { useQueryClient } from "@tanstack/react-query";
import { AddMenu } from "./AddMenu";
import { SubscribeModal } from "./SubscribeModal";
import { AddArticleModal } from "./AddArticleModal";
import type { Account } from "../types";

interface SidebarProps {
  appMode: "articles" | "cards";
  onAppModeChange: (mode: "articles" | "cards") => void;
  selectedAccountId: number | null;
  onSelectAccount: (id: number | null) => void;
  cardViewDate: string | null;
  onCardViewDateChange: (date: string | null) => void;
  cardDates: string[];
  isSidebarCollapsed: boolean;
  sidebarWidth: number;
  onToggleSidebar: () => void;
  isAdminMode: boolean;
  onToggleAdminMode: () => void;
  currentUser: { id: number; email: string; username: string; role: string };
  onLogout: () => void;
  appVersion: string;
}

export function Sidebar({
  appMode, onAppModeChange, selectedAccountId, onSelectAccount,
  cardViewDate, onCardViewDateChange, cardDates,
  isSidebarCollapsed, sidebarWidth, onToggleSidebar,
  isAdminMode, onToggleAdminMode,
  currentUser, onLogout, appVersion,
}: SidebarProps) {
  const { data: accounts = [] } = useAccounts();
  const queryClient = useQueryClient();
  const unsubscribe = useUnsubscribe();
  const resubscribe = useResubscribe();

  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
  const [isAddArticleOpen, setIsAddArticleOpen] = useState(false);

  const subscribedAccounts = accounts.filter((a: Account) => !a.subscription_type || a.subscription_type === 'subscribed');
  const temporaryAccounts = accounts.filter((a: Account) => a.subscription_type === 'temporary');

  const handleUnsubscribe = (e: React.MouseEvent, accountId: number) => {
    e.stopPropagation();
    if (!confirm("确定取消订阅该公众号？已有文章数据不会删除。")) return;
    unsubscribe.mutate(accountId);
  };

  const handleResubscribe = (e: React.MouseEvent, accountId: number) => {
    e.stopPropagation();
    resubscribe.mutate(accountId);
  };

  return (
    <aside
      className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}
      style={{ width: isSidebarCollapsed ? 72 : sidebarWidth }}
    >
      <div className="sidebar-header">
        <h2 className="sidebar-title">
          <Rss size={20} />
          <span>公众号订阅</span>
        </h2>
        <button className="btn-icon" onClick={onToggleSidebar}>
          {isSidebarCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      {/* Mode switch: articles vs cards */}
      {!isSidebarCollapsed && (
        <div className="flex border-b border-gray-200 mb-2" style={{ display: 'flex', borderBottom: '1px solid #30363d' }}>
          <button
            style={{
              flex: 1, padding: '8px 0', fontSize: '0.82rem', border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: appMode === "articles" ? '#e6edf3' : '#8b949e',
              borderBottom: appMode === "articles" ? '2px solid #3b82f6' : '2px solid transparent',
              fontWeight: appMode === "articles" ? 600 : 400,
            }}
            onClick={() => onAppModeChange("articles")}
          >
            文章
          </button>
          <button
            style={{
              flex: 1, padding: '8px 0', fontSize: '0.82rem', border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: appMode === "cards" ? '#e6edf3' : '#8b949e',
              borderBottom: appMode === "cards" ? '2px solid #3b82f6' : '2px solid transparent',
              fontWeight: appMode === "cards" ? 600 : 400,
            }}
            onClick={() => onAppModeChange("cards")}
          >
            卡片
          </button>
        </div>
      )}

      <div className="account-list" style={{ display: appMode === "articles" ? undefined : "none" }}>
        {/* Virtual Entry: All Articles */}
        <div
          className={`account-item ${selectedAccountId === -1 ? 'active' : ''}`}
          onClick={() => onSelectAccount(-1)}
          title="全部文章"
        >
          <div className="account-avatar" style={{ background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Layers size={18} />
          </div>
          <div className="account-info">
            <div className="account-name">全部文章</div>
          </div>
        </div>

        {subscribedAccounts.map(acc => (
          <div
            key={acc.id}
            className={`account-item ${selectedAccountId === acc.id ? 'active' : ''}`}
            onClick={() => onSelectAccount(acc.id)}
            title={isSidebarCollapsed ? acc.name : ""}
            style={{ position: 'relative' }}
            onMouseEnter={e => {
              const btn = e.currentTarget.querySelector('.account-action-btn') as HTMLElement | null;
              if (btn) btn.style.opacity = '1';
            }}
            onMouseLeave={e => {
              const btn = e.currentTarget.querySelector('.account-action-btn') as HTMLElement | null;
              if (btn) btn.style.opacity = '0';
            }}
          >
            <img
              src={acc.avatar_url || "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07xvMibqLuWicX7Y16H1xP81v6B0Sraia9zK0dYniamHwJxiaGvH6v97K8K1icYibib9eA/0"}
              alt={acc.name}
              className="account-avatar"
              referrerPolicy="no-referrer"
            />
            <div className="account-info">
              <div className="account-name">{acc.name}</div>
            </div>
            {!isSidebarCollapsed && (
              <button
                className="btn-icon account-action-btn"
                title="取消订阅"
                onClick={(e) => handleUnsubscribe(e, acc.id)}
                style={{
                  opacity: 0,
                  transition: 'opacity 0.15s',
                  padding: 3,
                  flexShrink: 0,
                  background: 'none',
                }}
              >
                <UserMinus size={13} style={{ color: '#f85149' }} />
              </button>
            )}
          </div>
        ))}

        {temporaryAccounts.length > 0 && (
          <>
            {!isSidebarCollapsed && (
              <div style={{ padding: '10px 14px 4px', fontSize: '0.68rem', color: '#6e7681', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                临时阅读
              </div>
            )}
            {temporaryAccounts.map(acc => (
              <div
                key={acc.id}
                className={`account-item ${selectedAccountId === acc.id ? 'active' : ''}`}
                onClick={() => onSelectAccount(acc.id)}
                title={isSidebarCollapsed ? acc.name : ""}
                style={{ opacity: 0.8, position: 'relative' }}
                onMouseEnter={e => {
                  const btn = e.currentTarget.querySelector('.account-action-btn') as HTMLElement | null;
                  if (btn) btn.style.opacity = '1';
                  (e.currentTarget as HTMLElement).style.opacity = '1';
                }}
                onMouseLeave={e => {
                  const btn = e.currentTarget.querySelector('.account-action-btn') as HTMLElement | null;
                  if (btn) btn.style.opacity = '0';
                  (e.currentTarget as HTMLElement).style.opacity = '0.8';
                }}
              >
                <img
                  src={acc.avatar_url || "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07xvMibqLuWicX7Y16H1xP81v6B0Sraia9zK0dYniamHwJxiaGvH6v97K8K1icYibib9eA/0"}
                  alt={acc.name}
                  className="account-avatar"
                  referrerPolicy="no-referrer"
                />
                <div className="account-info">
                  <div className="account-name">{acc.name}</div>
                </div>
                {!isSidebarCollapsed && (
                  <button
                    className="btn-icon account-action-btn"
                    title="订阅此公众号"
                    onClick={(e) => handleResubscribe(e, acc.id)}
                    style={{
                      opacity: 0,
                      transition: 'opacity 0.15s',
                      padding: 3,
                      flexShrink: 0,
                      background: 'none',
                    }}
                  >
                    <UserPlus size={13} style={{ color: '#3fb950' }} />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Card mode sidebar: date picker */}
      {appMode === "cards" && (
        <div className="account-list">
          {/* 全部卡片 */}
          <div
            className={`account-item ${cardViewDate === null ? 'active' : ''}`}
            onClick={() => onCardViewDateChange(null)}
            title="全部卡片"
          >
            <div className="account-avatar" style={{ background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Layers size={18} />
            </div>
            {!isSidebarCollapsed && (
              <div className="account-info">
                <div className="account-name">全部卡片</div>
              </div>
            )}
          </div>
          {/* 日期列表 */}
          {cardDates.map((date) => {
            const d = new Date(date + 'T00:00:00');
            const isToday = date === new Date().toISOString().split("T")[0];
            const label = isToday ? '今天' : `${d.getMonth() + 1}月${d.getDate()}日`;
            const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
            return (
              <div
                key={date}
                className={`account-item ${cardViewDate === date ? 'active' : ''}`}
                onClick={() => onCardViewDateChange(date)}
                title={isSidebarCollapsed ? `${label} 周${weekday}` : ""}
              >
                <div className="account-avatar" style={{
                  background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isToday ? '#3b82f6' : '#8b949e', fontSize: '0.75rem', fontWeight: 600,
                }}>
                  {d.getDate()}
                </div>
                {!isSidebarCollapsed && (
                  <div className="account-info">
                    <div className="account-name">{label}</div>
                    <div style={{ fontSize: '0.7rem', color: '#8b949e' }}>周{weekday}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="sidebar-footer" style={{ padding: '10px', borderTop: '1px solid #30363d' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', position: 'relative' }}>
          {/* + button with popup menu */}
          <div style={{ position: 'relative', flex: 1 }}>
            <AddMenu
              open={isAddMenuOpen}
              onClose={() => setIsAddMenuOpen(false)}
              onSubscribe={() => { setIsAddMenuOpen(false); setIsSubscribeOpen(true); }}
              onAddArticle={() => { setIsAddMenuOpen(false); setIsAddArticleOpen(true); }}
            />
            <button
              className="primary-btn"
              style={{ width: '100%', height: '36px', fontSize: '1.1rem' }}
              onClick={() => setIsAddMenuOpen(v => !v)}
              title="添加内容"
            >
              + {!isSidebarCollapsed && <span style={{ fontSize: '0.82rem', marginLeft: 4 }}>添加</span>}
            </button>
          </div>
          {!isSidebarCollapsed && currentUser.role === "admin" && (
            <button
              className="btn-icon"
              style={{ background: isAdminMode ? '#1d4ed8' : '#21262d' }}
              title="管理员模式"
              onClick={onToggleAdminMode}
            >
              <ShieldCheck size={18} />
            </button>
          )}
        </div>
        {/* User info + logout */}
        {!isSidebarCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px' }}>
            <span style={{ fontSize: '0.72rem', color: '#8b949e', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.email || currentUser.username}
            </span>
            {appVersion && <span style={{ fontSize: '0.68rem', color: '#484f58', flexShrink: 0 }}>v{appVersion}</span>}
            <button
              className="btn-icon"
              title="退出登录"
              onClick={onLogout}
              style={{ padding: 4 }}
            >
              <LogOut size={14} style={{ color: '#8b949e' }} />
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <SubscribeModal
        open={isSubscribeOpen}
        onClose={() => setIsSubscribeOpen(false)}
        onSuccess={() => { setIsSubscribeOpen(false); queryClient.invalidateQueries({ queryKey: ["accounts"] }); }}
      />
      <AddArticleModal
        open={isAddArticleOpen}
        onClose={() => setIsAddArticleOpen(false)}
        accounts={accounts}
        onRefresh={() => { queryClient.invalidateQueries({ queryKey: ["accounts"] }); queryClient.invalidateQueries({ queryKey: ["articles"] }); }}
      />
    </aside>
  );
}
