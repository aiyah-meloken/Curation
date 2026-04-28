import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loadFavoriteItems, toggleFavoriteLocal } from "../lib/cache";
import type { FavoriteItem } from "../types";

export function useFavorites() {
  return useQuery<FavoriteItem[]>({
    queryKey: ["favorites", "local"],
    queryFn: () => loadFavoriteItems(),
    staleTime: 0,
  });
}

export function useFavoriteSet() {
  const { data: favorites } = useFavorites();
  return useMemo(() => {
    const set = new Set<string>();
    if (favorites) {
      for (const f of favorites) {
        set.add(`${f.item_type}:${f.item_id}`);
      }
    }
    return set;
  }, [favorites]);
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemType, itemId, isFavorited }: {
      itemType: "card" | "article";
      itemId: string;
      isFavorited: boolean;
    }) => toggleFavoriteLocal(itemType, itemId, isFavorited),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites", "local"] });
    },
  });
}
