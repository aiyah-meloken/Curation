// curation-app/src/components/SidebarRail.tsx
import { useState } from "react";
import { Inbox, Star, Plus, Trash2, ShieldCheck, Settings, Library, Map as MapIcon, Hourglass } from "lucide-react";
import { AddMenu } from "./AddMenu";
import { SubscribeModal } from "./SubscribeModal";
import { AddArticleModal } from "./AddArticleModal";
import { useQueryClient } from "@tanstack/react-query";
import type { Account, InboxItem } from "../types";
import { useInbox } from "../hooks/useInbox";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function computeAtlasGlyphReadiness(
  cards: InboxItem[] | undefined,
): "ready" | "not_ready" {
  if (!cards) return "not_ready";
  const yesterday = isoDaysAgo(1);
  const dayCards = cards.filter(
    (c) => c.article_date === yesterday && c.routing != null,
  );
  if (dayCards.length === 0) return "not_ready";
  const tagged = dayCards.filter(
    (c) => (c.entities?.length ?? 0) > 0 && c.atlas_topic != null,
  );
  return tagged.length / dayCards.length >= 0.8 ? "ready" : "not_ready";
}

interface SidebarRailProps {
  accounts: Account[];
  selectedView: "inbox" | "discarded" | "favorites" | "search" | "home" | "atlas";
  selectedBiz: string | null;
  unreadCounts: Record<string, number>;
  isAdminMode: boolean;
  currentUserRole: string;
  isSubsOpen: boolean;
  isSettingsOpen: boolean;
  onSelectInbox: () => void;
  onSelectFavorites: () => void;
  onSelectDiscarded: () => void;
  onToggleAdmin: () => void;
  onToggleSubs: () => void;
  onToggleSettings: () => void;
  onNavigateToCard?: (cardId: string) => void;
  onSelectAtlas?: () => void;
}

export function SidebarRail({
  accounts,
  selectedView,
  selectedBiz,
  unreadCounts,
  isAdminMode,
  currentUserRole,
  isSubsOpen,
  isSettingsOpen,
  onSelectInbox,
  onSelectFavorites,
  onSelectDiscarded,
  onToggleAdmin,
  onToggleSubs,
  onToggleSettings,
  onNavigateToCard,
  onSelectAtlas,
}: SidebarRailProps) {
  const queryClient = useQueryClient();
  const { data: inboxCards } = useInbox();
  const atlasReadiness = computeAtlasGlyphReadiness(inboxCards);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
  const [isAddArticleOpen, setIsAddArticleOpen] = useState(false);

  const totalUnread = unreadCounts["total"] ?? 0;

  const railNavActive = (view: "inbox" | "favorites" | "discarded" | "atlas") =>
    selectedView === view && (view !== "inbox" || selectedBiz === null);

  return (
    <aside className="rail">
      {/* Top: view glyphs */}
      {/* Atlas — always topmost */}
      <button
        className={`rail-glyph ${railNavActive("atlas") ? "active" : ""}`}
        data-tooltip={atlasReadiness === "ready" ? "今日舆图" : "今日舆图待生成"}
        aria-label={atlasReadiness === "ready" ? "今日舆图" : "今日舆图待生成"}
        onClick={() => onSelectAtlas?.()}
      >
        <MapIcon size={18} />
        {atlasReadiness === "not_ready" && (
          <span className="rail-badge rail-badge-pending" aria-hidden>
            <Hourglass size={8} />
          </span>
        )}
      </button>

      <button
        className={`rail-glyph ${railNavActive("inbox") ? "active" : ""}`}
        data-tooltip="全部卡片"
        aria-label="全部卡片"
        onClick={onSelectInbox}
      >
        <Inbox size={18} />
        {totalUnread > 0 && <span className="rail-badge" />}
      </button>
      <button
        className={`rail-glyph ${railNavActive("favorites") ? "active" : ""}`}
        data-tooltip="收藏"
        aria-label="收藏"
        onClick={onSelectFavorites}
      >
        <Star size={16} />
      </button>
      <button
        className={`rail-glyph ${railNavActive("discarded") ? "active" : ""}`}
        data-tooltip="未推送"
        aria-label="未推送"
        onClick={onSelectDiscarded}
      >
        <Trash2 size={16} />
      </button>

      <div className="rail-rule" />

      {/* Subscriptions toggle */}
      <button
        className={`rail-glyph ${isSubsOpen ? "active" : ""}`}
        data-tooltip="订阅列表"
        aria-label="订阅列表"
        onClick={onToggleSubs}
      >
        <Library size={16} />
      </button>

      {/* Bottom: + and ⚙ */}
      <div className="rail-bottom">
        {currentUserRole === "admin" && !__IS_WEB__ && (
          <button
            className={`rail-glyph ${isAdminMode ? "active" : ""}`}
            data-tooltip="管理员模式"
            aria-label="管理员模式"
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
            data-tooltip="添加内容"
            aria-label="添加内容"
            onClick={() => setIsAddMenuOpen((v) => !v)}
          >
            <Plus size={18} />
          </button>
        </div>
        <button
          className={`rail-glyph ${isSettingsOpen ? "active" : ""}`}
          data-tooltip="设置"
          aria-label="设置"
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
