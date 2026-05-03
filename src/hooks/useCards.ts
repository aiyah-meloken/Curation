import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, fetchCardsByDate, fetchCardContent } from "../lib/api";
import { getCardContent } from "../lib/cache";

export interface Card {
  card_id: string;
  title: string;
  content?: string;
  article_title?: string;
  article_meta?: { title: string; url: string; publish_time: string; author: string; account?: string; account_id?: number; article_id?: string };
  read_at?: string;
  source_card_ids?: string | string[];
}

async function loadCardList(date: string | null, tab: "aggregated" | "source"): Promise<Card[]> {
  if (date) {
    const resp = await fetchCardsByDate(date);
    // For the "aggregated" tab, filter to deduped cards only.
    const cards: Card[] = resp.cards || [];
    if (tab === "aggregated") return cards.filter((c: any) => c.kind === "deduped");
    return cards;
  }
  // "全部": aggregated requires date, source returns all
  if (tab === "aggregated") return [];
  const resp = await apiFetch("/cards").then(r => r.json());
  return resp.cards || [];
}

export async function loadCardContentData(cardId: string, tab: "aggregated" | "source") {
  if (tab === "source") {
    const local = await getCardContent(cardId);
    if (local != null && local.length > 0) {
      return { content: local };
    }
  }
  return fetchCardContent(cardId);
}

export function useCardList(date: string | null, tab: "aggregated" | "source", enabled: boolean) {
  return useQuery({
    queryKey: ["cards", date, tab],
    queryFn: () => loadCardList(date, tab),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useCardContent(cardId: string | null, tab: "aggregated" | "source") {
  return useQuery({
    queryKey: ["cardContent", cardId, tab],
    queryFn: () => loadCardContentData(cardId!, tab),
    enabled: !!cardId,
    staleTime: Infinity,
  });
}

export function useCardDates() {
  return useQuery({
    queryKey: ["cardDates"],
    queryFn: () => apiFetch("/cards/dates").then(r => r.json()) as Promise<{ source: string[]; aggregated: string[] }>,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMarkCardRead(date: string | null, tab: "aggregated" | "source") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cardId: string) => {
      await apiFetch(`/cards/${cardId}/read`, { method: "POST" });
    },
    onMutate: async (cardId) => {
      const key = ["cards", date, tab];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Card[]>(key);
      queryClient.setQueryData<Card[]>(key, (old) =>
        old?.map(c => c.card_id === cardId ? { ...c, read_at: new Date().toISOString() } : c)
      );
      return { previous };
    },
    onError: (_err, _cardId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["cards", date, tab], context.previous);
      }
    },
  });
}
