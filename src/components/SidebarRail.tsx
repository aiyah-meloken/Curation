// curation-app/src/components/SidebarRail.tsx
import { useState } from "react";
import { Inbox, Star, Plus, Trash2, ShieldCheck, Settings } from "lucide-react";
import { AddMenu } from "./AddMenu";
import { SubscribeModal } from "./SubscribeModal";
import { AddArticleModal } from "./AddArticleModal";
import { useQueryClient } from "@tanstack/react-query";
import type { Account } from "../types";

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
  onToggleAdmin,
  onToggleSettings,
  onMouseEnter,
  onNavigateToCard,
}: SidebarRailProps) {
  const queryClient = useQueryClient();
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
  const [isAddArticleOpen, setIsAddArticleOpen] = useState(false);

  const totalUnread = unreadCounts["total"] ?? 0;

  const railNavActive = (view: "inbox" | "favorites" | "discarded") =>
    selectedView === view && (view !== "inbox" || selectedBiz === null);

  return (
    <aside
      className="rail"
      onMouseEnter={onMouseEnter}
      onFocus={onMouseEnter}
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
