import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

export interface DajialaBalance {
  current_remain: number | null;
  latest_snapshot_at: string | null;
  today_consumed: number | null;
  yesterday_consumed: number | null;
  day_delta: number | null;
}

export function useDajialaBalance() {
  return useQuery({
    queryKey: ["admin-dajiala-balance"],
    queryFn: async (): Promise<DajialaBalance | null> => {
      const resp = await apiFetch("/api/admin/dajiala-balance").then(r => r.json());
      if (resp.status !== "ok") return null;
      return {
        current_remain: resp.current_remain,
        latest_snapshot_at: resp.latest_snapshot_at,
        today_consumed: resp.today_consumed,
        yesterday_consumed: resp.yesterday_consumed,
        day_delta: resp.day_delta,
      };
    },
    staleTime: 60 * 1000,
  });
}
