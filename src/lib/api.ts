function computeApiBase(): string {
  const v = import.meta.env.VITE_API_BASE;
  if (v && typeof v === "string" && v.length > 0) {
    return v.replace(/\/$/, "");
  }
  // Production default. Local dev should override via .env's VITE_API_BASE
  // (e.g. VITE_API_BASE=http://127.0.0.1:8889). HTTPS is required for macOS
  // App Transport Security in packaged Tauri builds.
  if (import.meta.env.DEV) return "http://127.0.0.1:8889";
  return "https://curationcurationcuration.cc";
}

function computeWsBase(): string {
  const w = import.meta.env.VITE_WS_BASE;
  if (w && typeof w === "string" && w.length > 0) {
    return w.replace(/\/$/, "");
  }
  const api = computeApiBase();
  if (api.startsWith("https://")) {
    return "wss://" + api.slice("https://".length);
  }
  if (api.startsWith("http://")) {
    return "ws://" + api.slice("http://".length);
  }
  return "ws://127.0.0.1:8889";
}

import { refreshAccessToken } from "./refreshAuth";
import type { DedupQueueRow, DedupTaskRow, DedupTaskRun, CardSource } from "../types";

export const API_BASE = computeApiBase();
export const WS_BASE = computeWsBase();

export function getApiBase(): string {
  return API_BASE;
}

export function getWsBase(): string {
  return WS_BASE;
}

let _token: string | null = null;
let _refreshToken: string | null = null;

export function setAuthToken(token: string | null) {
  _token = token;
}

export function getAuthToken(): string | null {
  return _token;
}

export function setRefreshToken(token: string | null) {
  _refreshToken = token;
}

export function getRefreshToken(): string | null {
  return _refreshToken;
}

async function sendWithToken(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (_token) {
    headers.set("Authorization", `Bearer ${_token}`);
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let resp = await sendWithToken(path, init);
  if (resp.status !== 401) return resp;

  // Try refresh once.
  const fresh = await refreshAccessToken();
  if (!fresh) {
    // refreshAccessToken already dispatched auth:expired and cleared storage.
    return resp;
  }
  _token = fresh;
  return sendWithToken(path, init);
}

export async function fetchCacheSecret(): Promise<string> {
  const r = await apiFetch("/auth/cache-secret");
  if (!r.ok) throw new Error(`cache-secret failed: ${r.status}`);
  const j = await r.json();
  return j.secret;
}

/** Absolute URL for GET /static/... with HMAC (for img src without Bearer). */
export async function fetchSignedStaticUrl(relpath: string): Promise<string> {
  const r = await apiFetch(`/auth/static-link?relpath=${encodeURIComponent(relpath)}`);
  if (!r.ok) {
    throw new Error(`static-link failed: ${r.status}`);
  }
  const j = (await r.json()) as { url: string };
  return `${API_BASE}${j.url}`;
}

export async function fetchArticleCards(articleId: string) {
  const resp = await apiFetch(`/articles/${articleId}/cards`);
  return resp.json();
}

export async function fetchCardContent(cardId: string) {
  const resp = await apiFetch(`/cards/${cardId}/content`);
  return resp.json();
}

export async function fetchCardsByDate(date: string) {
  const resp = await apiFetch(`/cards?date=${date}`);
  return resp.json();
}


export async function triggerAggregation(date: string) {
  const resp = await apiFetch(`/aggregate?date=${date}`, { method: "POST" });
  return resp.json();
}

export async function fetchDiscarded() {
  const resp = await apiFetch("/discarded");
  return resp.json();
}

export async function fetchQueue(opts: { all?: boolean } = {}) {
  // Default: user-scoped queue (only entries for articles the user can
  // see via subscription windows). all=true requires admin and returns
  // the global queue — used by ArticleQueuePanel.
  const path = opts.all ? "/queue?all=true" : "/queue";
  const res = await apiFetch(path);
  const json = await res.json();
  return json.data;
}

export async function fetchStrategy() {
  const res = await apiFetch("/strategy");
  const json = await res.json();
  return json.data;
}

export async function patchStrategy(body: Record<string, unknown>) {
  const res = await apiFetch("/strategy", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function fetchBackends() {
  const res = await apiFetch("/agent/backends");
  const json = await res.json();
  return json.data;
}

export async function triggerQueueRun(articleId: string) {
  const res = await apiFetch(`/queue/${articleId}/run`, { method: "POST" });
  return res.json();
}

export async function retryQueueEntry(articleId: string) {
  const res = await apiFetch(`/queue/${articleId}/retry`, { method: "POST" });
  return res.json();
}

export async function dismissQueueEntry(articleId: string) {
  const res = await apiFetch(`/queue/${articleId}`, { method: "DELETE" });
  return res.json();
}


export async function fetchArticleRuns(articleId: string) {
  const res = await apiFetch(`/articles/${articleId}/runs`);
  const json = await res.json();
  return json.data;
}

export async function fetchRun(runId: number) {
  const res = await apiFetch(`/runs/${runId}`);
  const json = await res.json();
  return json.data;
}

export async function deleteRun(runId: number) {
  const res = await apiFetch(`/runs/${runId}`, { method: "DELETE" });
  return res.json();
}

export async function setServingRun(articleId: string, runId: number) {
  const res = await apiFetch(`/articles/${articleId}/serving-run`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_id: runId }),
  });
  return res.json();
}

export async function fetchRunCards(runId: number) {
  const res = await apiFetch(`/runs/${runId}/cards`);
  const json = await res.json();
  return json.cards as Array<{
    card_id: string;
    title: string | null;
    description: string | null;
    entities: string[];
    template: string | null;
    template_reason: string | null;
  }>;
}

export async function fetchRunStream(runId: number, offset = 0, limit = 500) {
  const res = await apiFetch(`/runs/${runId}/stream?offset=${offset}&limit=${limit}`);
  const json = await res.json();
  return json;
}

export async function fetchRunFiles(runId: number) {
  const res = await apiFetch(`/runs/${runId}/files`);
  const json = await res.json();
  return json.data;
}

export async function fetchRunFile(runId: number, filepath: string) {
  const res = await apiFetch(`/runs/${runId}/files/${filepath}`);
  const json = await res.json();
  return json.content;
}

// ==================== Feedback ====================

export interface FeedbackTarget {
  cardId?: string | null;
  articleId?: string | null;
}

export interface AnnotationRow {
  id: number;
  card_id: string | null;
  article_id: string;
  run_id: string | null;
  label: string;
  note: string | null;
  admin_username: string;
  created_at: string | null;
}

export interface AdminItemRow {
  item_type: "card" | "article";
  card_id: string | null;
  article_id: string;
  title: string;
  routing: string | null;
  card_date: string | null;
  annotation_count: number;
  upvote_count: number;
  downvote_count: number;
}
// Back-compat alias (callers migrating can use either name).
export type AdminCardRow = AdminItemRow;

export async function fetchVotes(
  cardIds: string[],
  articleIds: string[] = [],
): Promise<{ cards: Record<string, 1 | -1>; articles: Record<string, 1 | -1> }> {
  if (cardIds.length === 0 && articleIds.length === 0) {
    return { cards: {}, articles: {} };
  }
  const usp = new URLSearchParams();
  if (cardIds.length) usp.set("card_ids", cardIds.join(","));
  if (articleIds.length) usp.set("article_ids", articleIds.join(","));
  const resp = await apiFetch(`/feedback/vote?${usp.toString()}`);
  if (!resp.ok) throw new Error(`fetchVotes ${resp.status}`);
  const body = await resp.json();
  return { cards: body.votes ?? {}, articles: body.article_votes ?? {} };
}

function _targetBody(target: FeedbackTarget) {
  const out: Record<string, string> = {};
  if (target.cardId) out.card_id = target.cardId;
  if (target.articleId) out.article_id = target.articleId;
  return out;
}

export async function putVote(
  target: FeedbackTarget,
  vote: 1 | -1,
): Promise<{ card_id: string | null; article_id: string | null; vote: 1 | -1 | null }> {
  const resp = await apiFetch(`/feedback/vote`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ..._targetBody(target), vote }),
  });
  if (!resp.ok) throw new Error(`putVote ${resp.status}`);
  return resp.json();
}

export async function deleteVote(target: FeedbackTarget): Promise<void> {
  if (target.cardId) {
    const resp = await apiFetch(`/feedback/vote/${encodeURIComponent(target.cardId)}`, { method: "DELETE" });
    if (!resp.ok) throw new Error(`deleteVote ${resp.status}`);
    return;
  }
  if (target.articleId) {
    const resp = await apiFetch(`/feedback/vote?article_id=${encodeURIComponent(target.articleId)}`, { method: "DELETE" });
    if (!resp.ok) throw new Error(`deleteVote ${resp.status}`);
  }
}

export async function fetchAnnotationsSingle(target: FeedbackTarget): Promise<AnnotationRow[]> {
  const usp = new URLSearchParams();
  if (target.cardId) usp.set("card_id", target.cardId);
  else if (target.articleId) usp.set("article_id", target.articleId);
  else return [];
  const resp = await apiFetch(`/feedback/annotations?${usp.toString()}`);
  if (!resp.ok) throw new Error(`fetchAnnotationsSingle ${resp.status}`);
  const body = await resp.json();
  return body.annotations ?? [];
}

export async function fetchAnnotationsBatch(
  cardIds: string[],
  articleIds: string[] = [],
): Promise<{ cards: Record<string, AnnotationRow[]>; articles: Record<string, AnnotationRow[]> }> {
  if (cardIds.length === 0 && articleIds.length === 0) {
    return { cards: {}, articles: {} };
  }
  const usp = new URLSearchParams();
  if (cardIds.length) usp.set("card_ids", cardIds.join(","));
  if (articleIds.length) usp.set("article_ids", articleIds.join(","));
  const resp = await apiFetch(`/feedback/annotations?${usp.toString()}`);
  if (!resp.ok) throw new Error(`fetchAnnotationsBatch ${resp.status}`);
  const body = await resp.json();
  return { cards: body.annotations ?? {}, articles: body.article_annotations ?? {} };
}

export async function addAnnotation(
  target: FeedbackTarget,
  label: string,
  note?: string,
): Promise<AnnotationRow> {
  const resp = await apiFetch(`/feedback/annotations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ..._targetBody(target), label, note }),
  });
  if (!resp.ok) throw new Error(`addAnnotation ${resp.status}`);
  return resp.json();
}

export async function deleteAnnotation(annotationId: number): Promise<void> {
  const resp = await apiFetch(`/feedback/annotations/${annotationId}`, { method: "DELETE" });
  if (!resp.ok) throw new Error(`deleteAnnotation ${resp.status}`);
}

export async function fetchAdminCards(params: {
  has_annotation?: boolean;
  has_downvote?: boolean;
  routing?: string;
  order?: "recent" | "downvotes" | "annotations";
  limit?: number;
  offset?: number;
}): Promise<AdminItemRow[]> {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) usp.set(k, String(v));
  }
  const resp = await apiFetch(`/feedback/admin/cards?${usp.toString()}`);
  if (!resp.ok) throw new Error(`fetchAdminCards ${resp.status}`);
  const body = await resp.json();
  return body.cards ?? [];
}

// ── Dedup admin endpoints ───────────────────────────────────────────────

export async function fetchDedupQueue(params: {
  user_id?: number;
  date?: string;
  status?: string;
} = {}): Promise<DedupQueueRow[]> {
  const qs = new URLSearchParams();
  if (params.user_id !== undefined) qs.set("user_id", String(params.user_id));
  if (params.date) qs.set("date", params.date);
  if (params.status) qs.set("status", params.status);
  const path = qs.toString() ? `/dedup/queue?${qs}` : "/dedup/queue";
  const res = await apiFetch(path);
  return res.json();
}

export async function deleteDedupQueueRow(id: number): Promise<void> {
  await apiFetch(`/dedup/queue/${id}`, { method: "DELETE" });
}

export async function previewDedup(user_ids: number[], dates: string[]): Promise<{ summary: unknown[] }> {
  const res = await apiFetch("/dedup/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_ids, dates }),
  });
  return res.json();
}

export async function dispatchDedup(queue_ids: number[]): Promise<{ results: unknown[] }> {
  const res = await apiFetch("/dedup/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queue_ids }),
  });
  return res.json();
}

export async function retryDedupQueueRow(id: number): Promise<unknown> {
  const res = await apiFetch(`/dedup/queue/${id}/retry`, { method: "POST" });
  return res.json();
}

export async function fetchDedupTasks(params: {
  user_id?: number;
  date?: string;
  status?: string;
} = {}): Promise<DedupTaskRow[]> {
  const qs = new URLSearchParams();
  if (params.user_id !== undefined) qs.set("user_id", String(params.user_id));
  if (params.date) qs.set("date", params.date);
  if (params.status) qs.set("status", params.status);
  const path = qs.toString() ? `/dedup/tasks?${qs}` : "/dedup/tasks";
  const res = await apiFetch(path);
  return res.json();
}

export async function fetchDedupTaskRuns(taskId: number): Promise<DedupTaskRun[]> {
  const res = await apiFetch(`/dedup/tasks/${taskId}/runs`);
  return res.json();
}

export async function forceDedupTaskRun(taskId: number): Promise<{ run_id: number }> {
  const res = await apiFetch(`/dedup/tasks/${taskId}/run`, { method: "POST" });
  return res.json();
}

export async function fetchDedupTaskServing(taskId: number): Promise<DedupQueueRow[]> {
  const res = await apiFetch(`/dedup/tasks/${taskId}/serving`);
  return res.json();
}

export async function fetchCardSources(cardId: string): Promise<CardSource[]> {
  const res = await apiFetch(`/cards/${cardId}/sources`);
  return res.json();
}


// ── Auto-dedup admin config ─────────────────────────────────────────────

export interface DedupAutoConfig {
  enabled: boolean;
  last_run_date: string | null;
  schedule: string;
}

export async function fetchDedupAutoConfig(): Promise<DedupAutoConfig> {
  const res = await apiFetch("/dedup/auto-config");
  return res.json();
}

export async function setDedupAutoConfig(enabled: boolean): Promise<{ enabled: boolean }> {
  const res = await apiFetch("/dedup/auto-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  return res.json();
}

export async function runDedupAutoNow(target_date?: string): Promise<unknown> {
  const res = await apiFetch("/dedup/auto-run-now", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target_date ? { target_date } : {}),
  });
  return res.json();
}
