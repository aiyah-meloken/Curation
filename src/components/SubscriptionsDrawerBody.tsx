// curation-app/src/components/SubscriptionsDrawerBody.tsx
import { useState } from "react";
import { ChevronDown, ChevronRight, Rss, FilePlus } from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { SubscribeModal } from "./SubscribeModal";
import { AddArticleModal } from "./AddArticleModal";
import { useUnsubscribe, useResubscribe } from "../hooks/useAccounts";
import { useQueryClient } from "@tanstack/react-query";
import type { Account } from "../types";

interface SubscriptionsDrawerBodyProps {
  accounts: Account[];
  selectedView: "inbox" | "discarded" | "favorites" | "search" | "home" | "map";
  selectedBiz: string | null;
  unreadCounts: Record<string, number>;
  userName: string;
  appVersion: string;
  onSelectAccount: (biz: string) => void;
  onNavigateToCard?: (cardId: string) => void;
}

export function SubscriptionsDrawerBody({
  accounts,
  selectedView,
  selectedBiz,
  unreadCounts,
  userName,
  appVersion,
  onSelectAccount,
  onNavigateToCard,
}: SubscriptionsDrawerBodyProps) {
  const queryClient = useQueryClient();
  const unsubscribe = useUnsubscribe();
  const resubscribe = useResubscribe();
  const [isSubsOpen, setIsSubsOpen] = useState(true);
  const [isTempOpen, setIsTempOpen] = useState(true);
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
  const [isAddArticleOpen, setIsAddArticleOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  const subscribed = accounts.filter((a) => !a.subscription_type || a.subscription_type === "subscribed");
  const temporary = accounts.filter((a) => a.subscription_type === "temporary");

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
      <div className="drawer-settings-title">
        <span className="drawer-settings-title-serif">Subscriptions</span>
        <span className="drawer-settings-title-sans">订阅列表</span>
      </div>

      <p className="drawer-hint">
        点击公众号可筛选其文章；再次点击同一公众号取消筛选。
      </p>

      <div className="drawer-cta-row">
        <button
          className="drawer-cta-btn"
          onClick={() => setIsSubscribeOpen(true)}
        >
          <Rss size={16} />
          <span>订阅公众号</span>
        </button>
        <button
          className="drawer-cta-btn"
          onClick={() => setIsAddArticleOpen(true)}
        >
          <FilePlus size={16} />
          <span>添加文章</span>
        </button>
      </div>

      {subscribed.length > 0 && (
        <>
          <button
            className="drawer-section-label drawer-section-toggle"
            onClick={() => setIsSubsOpen(!isSubsOpen)}
            aria-expanded={isSubsOpen}
          >
            {isSubsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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
            aria-expanded={isTempOpen}
          >
            {isTempOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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

      <SubscribeModal
        open={isSubscribeOpen}
        onClose={() => setIsSubscribeOpen(false)}
        onSuccess={() => {
          setIsSubscribeOpen(false);
          queryClient.invalidateQueries({ queryKey: ["accounts"] });
        }}
      />
      <AddArticleModal
        open={isAddArticleOpen}
        onClose={() => setIsAddArticleOpen(false)}
        accounts={accounts}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ["accounts"] });
          queryClient.invalidateQueries({ queryKey: ["inbox"] });
        }}
        onNavigateToCard={onNavigateToCard}
      />
    </div>
  );
}
