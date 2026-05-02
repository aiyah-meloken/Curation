// curation-app/src/components/SidebarRail.tsx
import { useState } from "react";
import { Inbox, Star, Plus, Trash2, ShieldCheck, Settings } from "lucide-react";
import { AddMenu } from "./AddMenu";
import { SubscribeModal } from "./SubscribeModal";
import { AddArticleModal } from "./AddArticleModal";
import { useQueryClient } from "@tanstack/react-query";
import type { Account } from "../types";

const RAIL_MAX_ACCOUNTS = 9;

interface SidebarRailProps {
  accounts: Account[];
  selectedView: "inbox" | "discarded" | "favorites" | "search" | "home";
  selectedBiz: string | null;
  unreadCounts: Record<string, number>;
  isAdminMode: boolean;
  currentUserRole: string;
  isSettingsOpen: boolean;
  onSelectInbox: () => void;
  onSelectFavorites: () => void;
  onSelectDiscarded: () => void;
  onSelectAccount: (biz: string) => void;
  onToggleAdmin: () => void;
  onToggleSettings: () => void;
  onMouseEnter: () => void;
  onNavigateToCard?: (cardId: string) => void;
}

export function SidebarRail({
  accounts,
  selectedView,
  selectedBiz,
  unreadCounts,
  isAdminMode,
  currentUserRole,
  isSettingsOpen,
  onSelectInbox,
  onSelectFavorites,
  onSelectDiscarded,
  onSelectAccount,
  onToggleAdmin,
  onToggleSettings,
  onMouseEnter,
  onNavigateToCard,
}: SidebarRailProps) {
  const queryClient = useQueryClient();
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
  const [isAddArticleOpen, setIsAddArticleOpen] = useState(false);

  // Subscribed + temp combined; sort: unread count desc, then stable tiebreaker.
  const filteredAccounts = [...accounts]
    .filter((a) => !a.subscription_type || a.subscription_type === "subscribed" || a.subscription_type === "temporary")
    .sort((a, b) => {
      const diff = (unreadCounts[b.biz] ?? 0) - (unreadCounts[a.biz] ?? 0);
      return diff !== 0 ? diff : a.id - b.id;
    });

  const visibleAccounts = filteredAccounts.slice(0, RAIL_MAX_ACCOUNTS);
  const overflowCount = Math.max(0, filteredAccounts.length - visibleAccounts.length);
  const totalUnread = unreadCounts["total"] ?? 0;

  const railNavActive = (view: "inbox" | "favorites" | "discarded") =>
    selectedView === view && (view !== "inbox" || selectedBiz === null);

  return (
    <aside
      className="rail"
      onMouseEnter={onMouseEnter}
    >
      {/* Top: view glyphs */}
      <button
        className={`rail-glyph ${railNavActive("inbox") ? "active" : ""}`}
        title="全部卡片"
        onClick={onSelectInbox}
      >
        <Inbox size={18} />
        {totalUnread > 0 && <span className="rail-badge" />}
      </button>
      <button
        className={`rail-glyph ${railNavActive("favorites") ? "active" : ""}`}
        title="收藏"
        onClick={onSelectFavorites}
      >
        <Star size={16} />
      </button>
      <button
        className={`rail-glyph ${railNavActive("discarded") ? "active" : ""}`}
        title="未推送"
        onClick={onSelectDiscarded}
      >
        <Trash2 size={16} />
      </button>

      <div className="rail-rule" />

      {/* Account avatars */}
      {visibleAccounts.map((acc) => (
        <button
          key={acc.id}
          className={`rail-acct ${selectedBiz === acc.biz ? "active" : ""} ${(unreadCounts[acc.biz] ?? 0) > 0 ? "unread" : ""}`}
          title={acc.name}
          onClick={() => onSelectAccount(acc.biz)}
        >
          {acc.avatar_url ? (
            <img src={acc.avatar_url} alt={acc.name} referrerPolicy="no-referrer" />
          ) : (
            <span className="rail-acct-fallback">{acc.name.slice(0, 1)}</span>
          )}
        </button>
      ))}
      {overflowCount > 0 && <span className="rail-overflow">+{overflowCount}</span>}

      {/* Bottom: + and ⚙ */}
      <div className="rail-bottom">
        {currentUserRole === "admin" && !__IS_WEB__ && (
          <button
            className={`rail-glyph ${isAdminMode ? "active" : ""}`}
            title="管理员模式"
            onClick={onToggleAdmin}
          >
            <ShieldCheck size={16} />
          </button>
        )}
        <div style={{ position: "relative" }}>
          <AddMenu
            open={isAddMenuOpen}
            onClose={() => setIsAddMenuOpen(false)}
            onSubscribe={() => { setIsAddMenuOpen(false); setIsSubscribeOpen(true); }}
            onAddArticle={() => { setIsAddMenuOpen(false); setIsAddArticleOpen(true); }}
          />
          <button
            className="rail-glyph rail-glyph-primary"
            title="添加内容"
            onClick={() => setIsAddMenuOpen((v) => !v)}
          >
            <Plus size={18} />
          </button>
        </div>
        <button
          className={`rail-glyph ${isSettingsOpen ? "active" : ""}`}
          title="设置"
          onClick={onToggleSettings}
        >
          <Settings size={16} />
        </button>
      </div>

      <SubscribeModal
        open={isSubscribeOpen}
        onClose={() => setIsSubscribeOpen(false)}
        onSuccess={() => { setIsSubscribeOpen(false); queryClient.invalidateQueries({ queryKey: ["accounts"] }); }}
      />
      <AddArticleModal
        open={isAddArticleOpen}
        onClose={() => setIsAddArticleOpen(false)}
        accounts={accounts}
        onRefresh={() => { queryClient.invalidateQueries({ queryKey: ["accounts"] }); queryClient.invalidateQueries({ queryKey: ["inbox"] }); }}
        onNavigateToCard={onNavigateToCard}
      />
    </aside>
  );
}
