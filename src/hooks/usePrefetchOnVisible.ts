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
 * Prefetch adjacent items (N+1, N+2) when an item is opened.
 */
export function usePrefetchAdjacent<T>(
  items: { id: string }[],
  currentId: string | null,
  buildQuery: (id: string) => { queryKey: QueryKey; queryFn: () => Promise<T> },
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!currentId || items.length === 0) return;
    const idx = items.findIndex(item => item.id === currentId);
    if (idx === -1) return;

    for (let i = 1; i <= 2; i++) {
      const next = items[idx + i];
      if (next) {
        const { queryKey, queryFn } = buildQuery(next.id);
        queryClient.prefetchQuery({ queryKey, queryFn, staleTime: Infinity });
      }
    }
  }, [currentId]);
}
