import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { Article } from "../types";

const ARTICLES_KEY = ["articles"] as const;

async function fetchAllArticles(): Promise<Article[]> {
  const resp = await apiFetch("/articles").then(r => r.json());
  return resp.status === "ok" ? resp.data : [];
}

export interface ArticleContent {
  markdown?: string;
  cards?: Article["cards"];
  article_meta?: Article["article_meta"];
  rawMarkdown?: string;
  rawHtml?: string;
  contentFormat?: "html" | "markdown";
  serving_run_id?: number | null;
  content_source: Article["content_source"];
  summaryWordCount: number;
  rawWordCount: number;
  analysisStatus: "none" | "pending" | "running" | "done" | "failed";
}

export async function fetchArticleContent(articleId: string): Promise<ArticleContent> {
  const [resp, rawResp, statusResp] = await Promise.all([
    apiFetch(`/articles/${articleId}/content`).then(r => r.json()),
    apiFetch(`/articles/${articleId}/raw`).then(r => r.json()),
    apiFetch(`/articles/${articleId}/analysis-status`).then(r => r.json()),
  ]);

  if (resp.source === "enqueued") {
    return {
      rawMarkdown: rawResp.content,
      rawHtml: rawResp.format === "html" ? rawResp.content : undefined,
      contentFormat: rawResp.format,
      content_source: "enqueued",
      summaryWordCount: 0,
      rawWordCount: 0,
      analysisStatus: "pending",
    };
  }

  if (resp.source === "error") {
    return {
      rawMarkdown: rawResp.content,
      rawHtml: rawResp.format === "html" ? rawResp.content : undefined,
      contentFormat: rawResp.format,
      serving_run_id: resp.serving_run_id,
      content_source: "error",
      summaryWordCount: 0,
      rawWordCount: 0,
      analysisStatus: statusResp.analysis_status ?? "none",
    };
  }

  return {
    markdown: resp.content,
    cards: resp.source === "analysis" && resp.cards ? resp.cards : undefined,
    article_meta: resp.article_meta,
    rawMarkdown: rawResp.content,
    rawHtml: rawResp.format === "html" ? rawResp.content : undefined,
    contentFormat: rawResp.format,
    serving_run_id: resp.serving_run_id,
    content_source: resp.source,
    summaryWordCount: resp.word_count ?? 0,
    rawWordCount: resp.raw_word_count ?? 0,
    analysisStatus: statusResp.analysis_status ?? "none",
  };
}

/**
 * Single source of truth: fetches all articles once, derives filtered view via `select`.
 * Switching accounts is instant — no refetch, just a re-run of the selector.
 */
export function useArticles(biz: string | null) {
  const filterByAccount = useCallback(
    (data: Article[]) =>
      biz != null && biz !== ""
        ? data.filter(a => a.biz === biz)
        : data,
    [biz],
  );

  return useQuery({
    queryKey: ARTICLES_KEY,
    queryFn: fetchAllArticles,
    select: filterByAccount,
  });
}

export function useArticleContent(articleId: string | null) {
  return useQuery({
    queryKey: ["articleContent", articleId],
    queryFn: () => fetchArticleContent(articleId!),
    enabled: !!articleId,
    staleTime: Infinity,
  });
}

export function useAnalysisStatus(articleId: string | null, currentStatus: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["analysisStatus", articleId],
    queryFn: async () => {
      const resp = await apiFetch(`/articles/${articleId}/analysis-status`).then(r => r.json());
      const newStatus = resp.analysis_status;
      if (newStatus === "done") {
        queryClient.invalidateQueries({ queryKey: ["articleContent", articleId] });
        queryClient.setQueryData<Article[]>(ARTICLES_KEY, (old) =>
          old?.map(a => a.short_id === articleId ? { ...a, queue_status: "done" } : a)
        );
      }
      return newStatus as string;
    },
    enabled: !!articleId && (currentStatus === "pending" || currentStatus === "running"),
    refetchInterval: 5000,
  });
}

