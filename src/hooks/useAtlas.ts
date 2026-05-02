import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { AtlasDSL } from "../atlas/types";
import type { InboxItem } from "../types";

export function useAtlasDsl() {
  return useQuery<AtlasDSL>({
    queryKey: ["atlas", "dsl"],
    queryFn: async () => {
      const r = await apiFetch("/atlas/dsl");
      if (!r.ok) throw new Error(`atlas/dsl failed: ${r.status}`);
      return (await r.json()) as AtlasDSL;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAtlasCards(date: string | null) {
  return useQuery<InboxItem[]>({
    queryKey: ["atlas", "cards", date],
    enabled: date != null,
    queryFn: async () => {
      const r = await apiFetch(`/atlas/cards?date=${date}`);
      if (!r.ok) throw new Error(`atlas/cards failed: ${r.status}`);
      return (await r.json()) as InboxItem[];
    },
    staleTime: 60 * 1000,
  });
}
