import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

export interface DiscoverableAccount {
  biz: string;
  name: string;
  avatar_url?: string;
  description?: string;
  account_type?: string;
  already_subscribed: boolean;
}

export function useDiscoverableAccounts(targetUserId?: number, enabled = true) {
  return useQuery({
    queryKey: ["accounts", "discoverable", targetUserId ?? "self"],
    queryFn: async (): Promise<DiscoverableAccount[]> => {
      const qs = targetUserId ? `?target_user_id=${targetUserId}` : "";
      const resp = await apiFetch(`/accounts/discoverable${qs}`).then(r => r.json());
      return resp.status === "ok" ? resp.data : [];
    },
    staleTime: 30 * 1000,
    enabled,
  });
}
