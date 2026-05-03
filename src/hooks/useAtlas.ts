import { useMemo } from "react";
import { useInbox } from "./useInbox";
import type { InboxItem } from "../types";

/**
 * Atlas cards for a given day, derived from the local inbox cache.
 * The inbox row already carries `atlas_topic` (inline taxonomy) and
 * `reading_minutes`. No HTTP — pure local filter.
 */
export function useAtlasCards(date: string | null): {
  data: InboxItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const inbox = useInbox();
  const data = useMemo(() => {
    if (!inbox.data || date == null) return undefined;
    return inbox.data.filter((c) => c.article_date === date);
  }, [inbox.data, date]);
  return { data, isLoading: inbox.isLoading, isError: inbox.isError };
}
