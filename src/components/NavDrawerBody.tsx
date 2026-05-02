// curation-app/src/components/NavDrawerBody.tsx
import { useState } from "react";
import { Inbox, Star, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { useUnsubscribe, useResubscribe } from "../hooks/useAccounts";
import type { Account } from "../types";

interface NavDrawerBodyProps {
  accounts: Account[];
  selectedView: "inbox" | "discarded" | "favorites" | "search" | "home";
  selectedBiz: string | null;
  unreadCounts: Record<string, number>;
  userName: string;
  appVersion: string;
  onSelectInbox: () => void;
  onSelectFavorites: () => void;
  onSelectDiscarded: () => void;
  onSelectAccount: (biz: string) => void;
}

export function NavDrawerBody({
  accounts,
  selectedView,
  selectedBiz,
  unreadCounts,
  userName,
  appVersion,
  onSelectInbox,
  onSelectFavorites,
  onSelectDiscarded,
  onSelectAccount,
}: NavDrawerBodyProps) {
  const unsubscribe = useUnsubscribe();
  const resubscribe = useResubscribe();
  const [isSubsOpen, setIsSubsOpen] = useState(true);
  const [isTempOpen, setIsTempOpen] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  const subscribed = accounts.filter((a) => !a.subscription_type || a.subscription_type === "subscribed");
  const temporary = accounts.filter((a) => a.subscription_type === "temporary");
  const totalUnread = unreadCounts["total"] ?? 0;
  const favoritesCount = unreadCounts["favorites"] ?? 0;

  const isViewActive = (view: "inbox" | "favorites" | "discarded") =>
    selectedView === view && (view !== "inbox" || selectedBiz === null);

  const renderAccountItem = (acc: Account, kind: "subscribed" | "temporary") => {
    const count = unreadCounts[acc.biz] ?? 0;
    return (
      <button
        key={acc.id}
        className={`drawer-acct ${selectedView === "inbox" && selectedBiz === acc.biz ? "active" : ""} ${count > 0 ? "unread" : ""}`}
        onClick={() => onSelectAccount(acc.biz)}
        onContextMenu={(e) => {
          e.preventDefault();
          const items: ContextMenuItem[] = kind === "subscribed"
            ? [{ label: "取消订阅", danger: true, onClick: () => {
                if (!confirm("确定取消订阅该公众号？已有文章数据不会删除。")) return;
                unsubscribe.mutate(acc.id);
              } }]
            : [{ label: "添加订阅", onClick: () => resubscribe.mutate(acc.id) }];
          setContextMenu({ x: e.clientX, y: e.clientY, items });
        }}
      >
        <img
          src={acc.avatar_url || "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07xvMibqLuWicX7Y16H1xP81v6B0Sraia9zK0dYniamHwJxiaGvH6v97K8K1icYibib9eA/0"}
          alt={acc.name}
          referrerPolicy="no-referrer"
        />
        <span className="drawer-acct-name">{acc.name}</span>
        {count > 0 && <span className="drawer-acct-badge">{count}</span>}
      </button>
    );
  };

  return (
    <div className="drawer-body">
      <div className="drawer-brand">
        <div className="drawer-brand-name">Curation</div>
        <div className="drawer-brand-rule" />
        <div className="drawer-brand-tag">
          <span>值得读完的文章</span>
          <span>远比你以为的少</span>
        </div>
      </div>

      <div className="drawer-section-label">视图</div>
      <nav className="drawer-nav">
        <button
          className={`drawer-nav-item ${isViewActive("inbox") ? "active" : ""}`}
          onClick={onSelectInbox}
        >
          <Inbox size={14} className="glyph" /><span>全部卡片</span>
          {totalUnread > 0 && <span className="drawer-nav-badge unread">{totalUnread}</span>}
        </button>
        <button
          className={`drawer-nav-item ${isViewActive("favorites") ? "active" : ""}`}
          onClick={onSelectFavorites}
        >
          <Star size={14} className="glyph" /><span>收藏</span>
          {favoritesCount > 0 && <span className="drawer-nav-badge">{favoritesCount}</span>}
        </button>
        <button
          className={`drawer-nav-item ${isViewActive("discarded") ? "active" : ""}`}
          onClick={onSelectDiscarded}
        >
          <Trash2 size={14} className="glyph" /><span>未推送</span>
        </button>
      </nav>

      {subscribed.length > 0 && (
        <>
          <button
            className="drawer-section-label drawer-section-toggle"
            onClick={() => setIsSubsOpen(!isSubsOpen)}
          >
            {isSubsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <span>公众号 · {subscribed.length}</span>
          </button>
          {isSubsOpen && subscribed.map((acc) => renderAccountItem(acc, "subscribed"))}
        </>
      )}

      {temporary.length > 0 && (
        <>
          <button
            className="drawer-section-label drawer-section-toggle"
            onClick={() => setIsTempOpen(!isTempOpen)}
          >
            {isTempOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <span>临时文章 · {temporary.length}</span>
          </button>
          {isTempOpen && temporary.map((acc) => renderAccountItem(acc, "temporary"))}
        </>
      )}

      <div className="drawer-footer">
        <span className="drawer-footer-user">{userName}</span>
        {appVersion && <span className="drawer-footer-ver">v{appVersion}</span>}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
