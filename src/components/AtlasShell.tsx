import { useEffect, useMemo, useState } from "react";
import { AtlasPage } from "../atlas/components/AtlasPage";
import { AtlasTabBar, resolveTabDate, type DateTab } from "./AtlasTabBar";
import { AtlasEmptyState } from "./AtlasEmptyState";
import { useAtlasDsl, useAtlasCards } from "../hooks/useAtlas";
import { useArticleContent } from "../hooks/useArticles";
import { useMarkCardReadSingle, useInbox } from "../hooks/useInbox";
import { useAtlasStore } from "../atlas/state/store";
import type { InboxItem } from "../types";
import type { ArticleContent } from "../atlas/types";

const READINESS_THRESHOLD = 0.8;

function isDayReady(cards: InboxItem[]): boolean {
  if (cards.length === 0) return false;
  const tagged = cards.filter(
    (c) => (c.entities?.length ?? 0) > 0 && c.atlas_topic_id != null,
  );
  return tagged.length / cards.length >= READINESS_THRESHOLD;
}

export function AtlasShell() {
  const [tab, setTab] = useState<DateTab>({ kind: "yesterday" });
  const date = useMemo(() => resolveTabDate(tab), [tab]);

  const dsl = useAtlasDsl();
  const cards = useAtlasCards(date);
  const markRead = useMarkCardReadSingle();
  const inbox = useInbox();

  // Index cards by card_id for the article-content adapter below.
  const cardById = useMemo(() => {
    const m = new Map<string, InboxItem>();
    for (const c of cards.data ?? []) {
      if (c.card_id) m.set(c.card_id, c);
    }
    return m;
  }, [cards.data]);

  // Adapter: AtlasPage expects useArticleContent(card_id), but our app hook
  // takes article_id. Translate by looking up the card's article_id and
  // reshape the response into the atlas ArticleContent type.
  const useAtlasArticleContent = (cardId: string | null) => {
    const card = cardId ? cardById.get(cardId) ?? null : null;
    const articleId = card?.article_id ?? null;
    const q = useArticleContent(articleId);
    const data: ArticleContent | null = useMemo(() => {
      if (!q.data || !card) return null;
      const meta = (card as any).article_meta ?? {};
      // useArticleContent returns ArticleContent from useArticles.ts which has
      // rawMarkdown as the primary body field (raw article markdown).
      const body =
        (q.data as any).rawMarkdown ??
        (q.data as any).markdown ??
        (q.data as any).content_md ??
        (q.data as any).content ??
        (q.data as any).body ??
        "";
      return {
        id: card.card_id ?? card.article_id ?? "",
        title: card.title ?? meta.title ?? "",
        account: meta.account ?? "",
        publish_time: meta.publish_time ?? "",
        content_md: typeof body === "string" ? body : "",
      };
    }, [q.data, card]);
    return { data, isLoading: q.isLoading };
  };

  // Earliest selectable date for the picker = oldest article_date in inbox cache.
  const earliest = useMemo(() => {
    if (!inbox.data || inbox.data.length === 0) return undefined;
    return inbox.data
      .map((i) => i.article_date)
      .filter((d): d is string => !!d)
      .sort()[0];
  }, [inbox.data]);

  // Reset atlas internal state when shell unmounts (user switches view).
  useEffect(
    () => () => {
      useAtlasStore.setState({ drawer_card_id: null, hovered_card_id: null });
    },
    [],
  );

  const ready = useMemo(() => isDayReady(cards.data ?? []), [cards.data]);

  return (
    <div className="atlas-shell" data-atlas-theme="dark">
      <AtlasTabBar value={tab} onChange={setTab} earliest={earliest} />
      {dsl.isError ? (
        <div className="atlas-error">Atlas taxonomy 加载失败</div>
      ) : cards.isError ? (
        <div className="atlas-error">该日数据加载失败</div>
      ) : !dsl.data || cards.isLoading ? (
        <div className="atlas-loading">加载中…</div>
      ) : dsl.data.domains.length === 0 ? (
        <AtlasEmptyState date={date} variant="no_taxonomy" />
      ) : !ready ? (
        <AtlasEmptyState
          date={date}
          variant={(cards.data?.length ?? 0) === 0 ? "no_cards" : "not_ready"}
        />
      ) : (
        <AtlasPage
          dsl={dsl.data}
          cards={cards.data ?? []}
          useArticleContent={useAtlasArticleContent}
          onMarkRead={(id: string) => markRead.mutate(id)}
        />
      )}
    </div>
  );
}
