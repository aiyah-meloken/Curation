import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AnnotationRow,
  AdminItemRow,
  FeedbackTarget,
  addAnnotation,
  deleteAnnotation,
  deleteVote,
  fetchAdminCards,
  fetchAnnotationsSingle,
  fetchVotes,
  putVote,
} from "../lib/api";

function targetKey(target: FeedbackTarget): string {
  return target.cardId ? `c:${target.cardId}` : target.articleId ? `a:${target.articleId}` : "none";
}

/** Fetch current user's vote for a single target (card OR article). */
export function useTargetVote(target: FeedbackTarget) {
  return useQuery<1 | -1 | null>({
    queryKey: ["votes", targetKey(target)],
    queryFn: async () => {
      if (target.cardId) {
        const { cards } = await fetchVotes([target.cardId]);
        return cards[target.cardId] ?? null;
      }
      if (target.articleId) {
        const { articles } = await fetchVotes([], [target.articleId]);
        return articles[target.articleId] ?? null;
      }
      return null;
    },
    enabled: !!target.cardId || !!target.articleId,
    staleTime: 30_000,
  });
}

export function useSetVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      target,
      vote,
      current,
    }: {
      target: FeedbackTarget;
      vote: 1 | -1;
      current: 1 | -1 | null;
    }) => {
      if (current === vote) {
        await deleteVote(target);
        return null;
      }
      const r = await putVote(target, vote);
      return r.vote;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["votes"] });
    },
  });
}

export function useAnnotationsSingle(target: FeedbackTarget, enabled: boolean) {
  return useQuery<AnnotationRow[]>({
    queryKey: ["annotations", "single", targetKey(target)],
    queryFn: () => fetchAnnotationsSingle(target),
    enabled: enabled && (!!target.cardId || !!target.articleId),
    staleTime: 5_000,
  });
}

export function useAddAnnotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ target, label, note }: { target: FeedbackTarget; label: string; note?: string }) =>
      addAnnotation(target, label, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["annotations"] });
      qc.invalidateQueries({ queryKey: ["admin-cards"] });
    },
  });
}

export function useDeleteAnnotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAnnotation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["annotations"] });
      qc.invalidateQueries({ queryKey: ["admin-cards"] });
    },
  });
}

export function useAdminCards(
  params: {
    has_annotation?: boolean;
    has_downvote?: boolean;
    routing?: string;
    order?: "recent" | "downvotes" | "annotations";
    limit?: number;
    offset?: number;
  },
  enabled: boolean,
) {
  return useQuery<AdminItemRow[]>({
    queryKey: ["admin-cards", params],
    queryFn: () => fetchAdminCards(params),
    enabled,
    staleTime: 10_000,
  });
}
