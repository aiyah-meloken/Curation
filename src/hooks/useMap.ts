import { useMemo } from "react";
import { useInbox } from "./useInbox";
import type { InboxItem } from "../types";

/**
 * Map cards for a given day, derived from the local inbox cache.
 * The inbox row already carries `topic` (inline taxonomy) and
 * `reading_minutes`. No HTTP — pure local filter.
 */
export function useMapCards(date: string | null): {
  data: InboxItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const inbox = useInbox();
  const data = useMemo(() => {
    if (!inbox.data || date == null) return undefined;
    return inbox.data.filter((c) => c.card_date === date);
  }, [inbox.data, date]);
  return { data, isLoading: inbox.isLoading, isError: inbox.isError };
}
