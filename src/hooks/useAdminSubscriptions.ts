import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

export interface BizSummary {
  biz: string;
  name: string | null;
  avatar_url?: string | null;
  subscriber_count: number;
  active_count: number;
  article_count: number;
  avg_daily_freq: number;
  estimated_daily_cost: number;
  last_monitored_at: string | null;
  subscribers: Array<{
    user_id: number;
    user_name: string;
    started_at: string;
    ended_at: string | null;
    window_id: number;
  }>;
}

export interface UserSummary {
  user_id: number;
  user_name: string;
  email: string;
  window_count: number;
  active_count: number;
  windows: Array<{
    biz: string;
    name: string | null;
    started_at: string;
    ended_at: string | null;
    window_id: number;
  }>;
}

export function useAdminByAccount(includeEnded: boolean) {
  return useQuery({
    queryKey: ["admin-subscriptions", "by-account", includeEnded],
    queryFn: async (): Promise<BizSummary[]> => {
      const resp = await apiFetch(
        `/api/admin/subscriptions/by-account?include_ended=${includeEnded}`
      ).then(r => r.json());
      return resp.status === "ok" ? resp.data : [];
    },
  });
}

export function useAdminByUser(includeEnded: boolean) {
  return useQuery({
    queryKey: ["admin-subscriptions", "by-user", includeEnded],
    queryFn: async (): Promise<UserSummary[]> => {
      const resp = await apiFetch(
        `/api/admin/subscriptions/by-user?include_ended=${includeEnded}`
      ).then(r => r.json());
      return resp.status === "ok" ? resp.data : [];
    },
  });
}
