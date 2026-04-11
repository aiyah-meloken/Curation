import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Prefetch data when the element becomes visible in the viewport.
 * Attaches an IntersectionObserver to the returned ref.
 */
export function usePrefetchOnVisible<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options?: { staleTime?: number },
) {
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            queryClient.prefetchQuery({
              queryKey,
              queryFn,
              staleTime: options?.staleTime ?? Infinity,
            });
            observer.unobserve(el);
          }
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [JSON.stringify(queryKey)]); // queryFn must be referentially stable

  return ref;
}

/**
 * Prefetch adjacent items (N-1, N+1, N+2) when an item is opened.
 *
 * Uses a ref for `items` so the effect doesn't need `items` in its dep array —
 * avoids re-running on every render while still reading the latest list when
 * `currentId` changes (e.g. after a filter change).
 */
export function usePrefetchAdjacent<T>(
  items: { id: string }[],
  currentId: string | null,
  buildQuery: (id: string) => { queryKey: QueryKey; queryFn: () => Promise<T> },
) {
  const queryClient = useQueryClient();
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!currentId || itemsRef.current.length === 0) return;
    const idx = itemsRef.current.findIndex(item => item.id === currentId);
    if (idx === -1) return;

    // Prefetch 1 behind and 2 ahead
    for (const offset of [-1, 1, 2]) {
      const neighbor = itemsRef.current[idx + offset];
      if (neighbor) {
        const { queryKey, queryFn } = buildQuery(neighbor.id);
        queryClient.prefetchQuery({ queryKey, queryFn, staleTime: Infinity });
      }
    }
  }, [currentId]);
}
