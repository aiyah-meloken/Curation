// Atlas — preview wrapper.
// Wires mock DSL, mock cards, mock article-content, and a no-op mark-read
// (which just routes through the in-memory zustand store) into AtlasPage.

import { useState } from "react";
import { AtlasPage } from "./components/AtlasPage";
import { mockArticleContent } from "./mock/article-content";
import { mockAtlasCards } from "./mock/cards";
import { mockAtlasDSL } from "./mock/dsl";
import type { ArticleContent } from "./types";

export function AtlasPreviewApp() {
  // Cards are state so we can simulate read-state mutations across reloads
  // within a session (the store also tracks session_read_card_ids; we
  // additionally update card.read_at here so re-renders see the change).
  const [cards, setCards] = useState(mockAtlasCards);

  const handleMarkRead = (card_id: string) => {
    setCards((prev) =>
      prev.map((c) =>
        c.card_id === card_id && !c.read_at
          ? { ...c, read_at: new Date().toISOString() }
          : c,
      ),
    );
  };

  const useArticleContent = (article_id: string | null): {
    data: ArticleContent | null;
    isLoading: boolean;
  } => {
    if (!article_id) return { data: null, isLoading: false };
    return { data: mockArticleContent[article_id] ?? null, isLoading: false };
  };

  return (
    <AtlasPage
      dsl={mockAtlasDSL}
      cards={cards}
      onMarkRead={handleMarkRead}
      useArticleContent={useArticleContent}
    />
  );
}
