import { useEffect, useRef, useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { BookOpen } from "lucide-react";
import { stripFrontmatter, mdComponents } from "../lib/markdown";
import { useCardContent } from "../hooks/useCards";
import { useArticleContent } from "../hooks/useArticles";
import { useMarkCardReadSingle } from "../hooks/useInbox";
import { useAuth } from "../lib/authStore";
import { FavoriteButton } from "./FavoriteButton";
import { CardVoteBar } from "./CardVoteBar";
import { AdminAnnotationFlag } from "./AdminAnnotationFlag";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";
import { CardFrame } from "./CardFrame";
import { AcpRunningDot } from "./AcpRunningDot";
import { TauriOnly } from "./platform/TauriOnly";
import { useChat, useAgentDetection } from "../hooks/useChat";
import { useCardStatusStore } from "../lib/acp/cardStatusStore";
import type { InboxItem, DiscardedItem } from "../types";

function sourceBarTag(routing: "ai_curation" | "original_push" | null, isDiscarded: boolean) {
  if (isDiscarded) {
    return <span className="inbox-tag" style={{ fontSize: "0.72rem", color: "var(--accent-red)" }}>丢弃</span>;
  }
  if (routing === "ai_curation") {
    return <span className="inbox-tag" style={{ fontSize: "0.72rem", color: "var(--accent-blue)" }}>AI总结</span>;
  }
  if (routing === "original_push") {
    return <span className="inbox-tag" style={{ fontSize: "0.72rem", color: "var(--accent-green)" }}>原文</span>;
  }
  return null;
}

function formatTime(t: string | null) {
  if (!t) return "";
  return t.replace("T", " ").slice(0, 16);
}

interface ReaderPaneProps {
  selectedItem: InboxItem | null;
  selectedDiscardedItem: DiscardedItem | null;
  isDiscardedView: boolean;
  isHomeView?: boolean;
  cacheReady?: boolean;
  onOpenDrawer: () => void;
}

function SourceBar({
  meta,
  routing,
  isDiscarded,
  onOpenDrawer,
  cardId,
}: {
  meta: { title: string; account: string; author: string | null; publish_time: string | null; url: string };
  routing: "ai_curation" | "original_push" | null;
  isDiscarded: boolean;
  onOpenDrawer?: () => void;
  cardId?: string;
}) {
  return (
    <div className="reader-source-bar">
      {/* Line 1: original title + tag */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
        <span style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: "0.88rem", flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
          <AcpRunningDot cardId={cardId ?? null} />
          <span style={{ color: "var(--text-muted)" }}>原文标题：</span>
          {meta.title}
        </span>
        {sourceBarTag(routing, isDiscarded)}
      </div>
      {/* Line 2: meta left, buttons right */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
          <span>{meta.account}</span>
          {meta.author && <><span>·</span><span>{meta.author}</span></>}
          {meta.publish_time && <><span>·</span><span>{formatTime(meta.publish_time)}</span></>}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {cardId && (
            <FavoriteButton itemType="card" itemId={cardId} />
          )}
          {routing === "ai_curation" && onOpenDrawer && (
            <button
              onClick={onOpenDrawer}
              style={{
                background: "none", border: "1px solid var(--border)", borderRadius: 6,
                color: "var(--text-muted)", padding: "3px 10px", cursor: "pointer", fontSize: "0.76rem",
              }}
            >
              查看原文
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CardContentView({ cardId }: { cardId: string }) {
  const { data: cardData, isLoading } = useCardContent(cardId, "source");

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        加载中...
      </div>
    );
  }

  if (!cardData?.content) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        暂无内容
      </div>
    );
  }

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={mdComponents}
      >
        {stripFrontmatter(cardData.content)}
      </ReactMarkdown>
    </div>
  );
}

function ArticleHtmlView({ articleId }: { articleId: string }) {
  const { data: articleData, isLoading } = useArticleContent(articleId);

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        加载中...
      </div>
    );
  }

  const html = articleData?.rawHtml;
  if (!html) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        暂无原文内容
      </div>
    );
  }

  return (
    <div
      className="rich-text-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function ReaderPane({
  selectedItem,
  selectedDiscardedItem,
  isDiscardedView,
  isHomeView,
  cacheReady,
  onOpenDrawer,
}: ReaderPaneProps) {
  const { state: authState } = useAuth();
  const isAdmin = authState.status === "authenticated" && authState.user.role === "admin";
  const markRead = useMarkCardReadSingle();
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks ChatInput container height so floating UI (vote pill, admin
  // annotation flag) can sit just above it as the textarea grows.
  const [chatInputHeight, setChatInputHeight] = useState(80);

  // Load card content + original article for system prompt.
  // ArticleId can come from either the inbox-selected card or a discarded item
  // (discarded items have no card; the prompt then includes only the article).
  const promptArticleId =
    selectedItem?.article_id ?? selectedDiscardedItem?.article_id ?? null;
  const { data: cardContentData } = useCardContent(selectedItem?.card_id ?? null, "source");
  const { data: promptArticleData } = useArticleContent(promptArticleId);

  // Chat hooks (must be called before any early returns)
  const { agents, selectedAgentId, setSelectedAgentId } = useAgentDetection();
  const selectedAgentName = agents.find((a) => a.id === selectedAgentId)?.name ?? "AI";
  const chatCardId = isHomeView ? null : (selectedItem?.card_id ?? null);
  const chat = useChat(chatCardId, cacheReady);
  const chatActive = chat.messages.length > 0 || chat.isStreaming;

  // Auto-scroll when new messages arrive (after AI finishes or user sends)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat.messages.length, chat.isStreaming]);

  // Smooth scroll during streaming — throttled via rAF
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!chat.isStreaming || !chat.streamingContent) return;
    if (rafRef.current) return; // already scheduled
    rafRef.current = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      rafRef.current = null;
    });
  }, [chat.streamingContent, chat.isStreaming]);

  const buildSystemPrompt = useCallback(() => {
    const notesPath = localStorage.getItem("notesPath") ?? "";

    // Routing: cards come from selectedItem; discarded items have no card.
    const isDiscardedItem = !selectedItem && !!selectedDiscardedItem;
    const routing: "ai_curation" | "original_push" | "discard" | null =
      isDiscardedItem ? "discard" : (selectedItem?.routing ?? null);
    const subtype = selectedItem?.subtype ?? null;

    const routingLabel =
      routing === "ai_curation" ? "AI梳理"
        : routing === "original_push" ? "原文推送"
        : routing === "discard" ? "丢弃"
        : "未知";

    // 阅读焦点：AI梳理 → 卡片；原文推送 → 原文；丢弃 → 原文（读者只能看到原文）
    const focus = routing === "ai_curation" ? "卡片" : "原文";

    // Card kind label, derived from routing + subtype.
    // For original_push: "普通" → reading_guide / 阅前；"D5" → post_read / 阅后.
    // For ai_curation: subtype is the template name (event / paper / tool / ...).
    let cardKindLabel = "—";
    if (routing === "ai_curation") {
      cardKindLabel = subtype ? `AI梳理 主卡（${subtype}）` : "AI梳理 主卡";
    } else if (routing === "original_push") {
      if (subtype === "普通" || subtype === "reading_guide") cardKindLabel = "阅前卡片（reading_guide）";
      else if (subtype === "D5" || subtype === "post_read") cardKindLabel = "阅后卡片（post_read)";
      else cardKindLabel = "原文推送辅助卡";
    }

    // Article markdown — soft cap at 12k chars to keep prompt size sane.
    const ARTICLE_CHAR_LIMIT = 12000;
    const articleRaw = promptArticleData?.rawMarkdown ?? "";
    const articleTruncated = articleRaw.length > ARTICLE_CHAR_LIMIT;
    const articleBody = articleTruncated
      ? articleRaw.slice(0, ARTICLE_CHAR_LIMIT) +
        `\n\n…（原文已截断，剩余约 ${articleRaw.length - ARTICLE_CHAR_LIMIT} 字。需要完整内容请用 curation 工具查询。）`
      : articleRaw || "（暂无原文）";

    const articleTitle =
      selectedItem?.article_meta.title ??
      selectedDiscardedItem?.article_meta?.title ??
      "";
    const accountName =
      selectedItem?.article_meta.account ??
      selectedDiscardedItem?.article_meta?.account ??
      "";

    const cardSection =
      routing === "discard" || !selectedItem
        ? "" // 丢弃：读者看不到卡片，prompt 也不放卡片段
        : `\n### 当前卡片\n\n\`\`\`markdown\n${cardContentData?.content ?? "（卡片正文加载中）"}\n\`\`\`\n`;

    const notesSection = notesPath
      ? `用户的本地笔记路径：${notesPath}\n仅在用户明确要求"保存到笔记 / 写入笔记"时才往这个路径写文件；日常对话不要主动写盘。`
      : `（用户未配置笔记路径，本节忽略）`;

    return `你正在通过 Curation 桌面/网页应用与用户对话。Curation 是个人 AI 资讯助理，自动抓取微信公众号文章并生成卡片摘要。

## 路由分流背景

每篇抓取到的原文都会被 AI 分析并路由到三条路径之一，读者在不同路由下的注意力分配不一样：

- **AI梳理**：原文信息密度高但读起来累，AI 提炼出一张主卡片代替原文阅读。
  → 读者主要读卡片，原文是补充资料，遇到细节存疑时回查。
- **原文推送**：原文本身值得逐字读（叙事/思想/一手材料），AI 在原文外围加辅助卡片：
    - 阅前卡片（reading_guide）：进入原文前的导读，给问题、给框架。
    - 阅后卡片（post_read）：读完原文的回顾/延伸/串联。
  → 读者主要读原文，卡片用来准备和收尾。
- **丢弃**：AI 判断信息密度低或与读者主题无关，不生成卡片；只有当读者主动展开"已丢弃"列表时才会看到这里的原文。

## 当前阅读上下文

- 路由：${routingLabel}
- 阅读焦点：${focus}
- 卡片类型：${cardKindLabel}
- 标题：「${articleTitle}」
- 公众号：${accountName}
${cardSection}
### 原文

\`\`\`markdown
${articleBody}
\`\`\`

> 提示：上面 \`原文\` 是这张卡片对应的源文章，已附在此供你随时检索引用。
> ${routing === "ai_curation"
        ? "读者此刻视线在 `卡片` 上；原文用于查证和扩展。"
        : routing === "original_push"
          ? "读者此刻视线在 `原文` 上，卡片只是辅助导读/回顾。"
          : "读者只看到原文（这篇被路由到丢弃，没有卡片）。"}

## 可用工具（curation CLI）

你可以通过终端执行 \`curation\` 命令查询和操作用户的卡片库，所有命令默认输出 JSON。
使用前先运行 \`curation help\`、\`curation card list --help\` 了解完整参数，不要猜测用法。
常用示例：
- \`curation card list --range today\`  — 今天的卡片
- \`curation card show <card_id>\`      — 查看卡片详情

## 可选参考（非强制）

${notesSection}

## 回复规范

请简练回复，使用中文和 markdown。`;
  }, [selectedItem, selectedDiscardedItem, cardContentData, promptArticleData]);

  const handleSend = useCallback(
    (text: string) => {
      if (!selectedAgentId) return;
      chat.sendMessage(text, selectedAgentId, buildSystemPrompt());
    },
    [selectedAgentId, chat.sendMessage, buildSystemPrompt],
  );

  const handleSaveToNotes = useCallback(() => {
    if (!selectedAgentId) return;
    const notePrompt = selectedItem
      ? `请将当前卡片内容保存到我的笔记中。卡片内容已在上下文中，直接使用即可。`
      : `请将我们刚才的对话要点保存到我的笔记中。`;
    chat.sendMessage(notePrompt, selectedAgentId, buildSystemPrompt());
  }, [selectedAgentId, selectedItem, chat.sendMessage, buildSystemPrompt]);

  const handleClear = useCallback(() => {
    if (!selectedAgentId) return;
    chat.clearSession(selectedAgentId);
  }, [selectedAgentId, chat.clearSession]);

  // While viewing a card, downgrade ACP "unread" → "read" immediately,
  // and keep doing so if a new reply arrives during this visit.
  useEffect(() => {
    const cid = selectedItem?.card_id;
    if (!cid) return;
    const downgrade = () => {
      const cur = useCardStatusStore.getState().byCard[cid];
      if (cur === "unread") {
        useCardStatusStore.getState().setStatus(cid, "read");
      }
    };
    downgrade();
    const unsub = useCardStatusStore.subscribe(downgrade);
    return unsub;
  }, [selectedItem?.card_id]);

  // Auto mark-read after 2 seconds
  useEffect(() => {
    if (markReadTimerRef.current) {
      clearTimeout(markReadTimerRef.current);
      markReadTimerRef.current = null;
    }

    if (selectedItem && !selectedItem.read_at && selectedItem.card_id) {
      markReadTimerRef.current = setTimeout(() => {
        markRead.mutate(selectedItem.card_id!);
      }, 2000);
    }

    return () => {
      if (markReadTimerRef.current) {
        clearTimeout(markReadTimerRef.current);
      }
    };
  }, [selectedItem?.card_id]);

  // Resolve the active item — inbox, favorites, or discarded all go through here
  const item = isDiscardedView
    ? (selectedDiscardedItem ? {
        card_id: null,
        article_id: selectedDiscardedItem.article_id,
        title: selectedDiscardedItem.title,
        description: null,
        routing: null as "ai_curation" | "original_push" | null,
        article_date: selectedDiscardedItem.article_date,
        read_at: null,
        queue_status: null as "pending" | "running" | null,
        article_meta: selectedDiscardedItem.article_meta,
      } : null)
    : selectedItem;

  // Empty state
  if (!item) {
    return (
      <main className="reader-pane">
        <div className="reader-empty">
          <div className="reader-empty-icon"><BookOpen size={64} /></div>
          <h3>请选择一篇内容阅读</h3>
        </div>
      </main>
    );
  }

  // Unified view — one design for all items
  return (
    <main className="reader-pane" style={{ position: "relative", overflow: "hidden" }}>
      <SourceBar
        meta={item.article_meta}
        routing={item.routing}
        isDiscarded={isDiscardedView}
        onOpenDrawer={item.routing === "ai_curation" ? onOpenDrawer : undefined}
        cardId={item.card_id ?? undefined}
      />
      <div ref={scrollRef} style={{ overflowY: "auto", flex: 1 }}>
        <div className="reader-content animate-in" style={{ paddingBottom: 140 }}>
          {/* Card content (markdown) */}
          {item.card_id && (
            <CardFrame
              chatActive={chatActive}
              label={item.routing === "original_push" ? "AI 卡片" : undefined}
              force={item.routing === "original_push"}
            >
              <CardContentView cardId={item.card_id} />
            </CardFrame>
          )}

          {/* Original article HTML — for original_push or discarded or analyzing (no card) */}
          {(item.routing === "original_push" || !item.card_id) && (
            <CardFrame
              chatActive={chatActive}
              label={item.routing === "original_push" ? "原文" : undefined}
              force={item.routing === "original_push"}
            >
              <ArticleHtmlView articleId={item.article_id} />
            </CardFrame>
          )}

          <ChatMessages
            messages={chat.messages}
            streamingContent={chat.streamingContent}
            isStreaming={chat.isStreaming}
            agentName={selectedAgentName}
            userName="你"
          />
        </div>
      </div>
      <TauriOnly>
        <ChatInput
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          connectionStatus={chat.connectionStatus}
          isStreaming={chat.isStreaming}
          onSend={handleSend}
          onCancel={chat.cancel}
          onClear={handleClear}
          onSaveToNotes={handleSaveToNotes}
          hasMessages={chat.messages.length > 0}
          onHeightChange={setChatInputHeight}
        />
      </TauriOnly>
      {(item.card_id || item.article_id) && (
        <div
          style={{
            position: "absolute",
            right: 16,
            // Sit just above the ChatInput container, regardless of how
            // tall it grows when the textarea expands.
            bottom: chatInputHeight + 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          {isAdmin && (
            <div style={{ pointerEvents: "auto" }}>
              <AdminAnnotationFlag cardId={item.card_id} articleId={item.article_id} />
            </div>
          )}
          <div style={{ pointerEvents: "auto" }}>
            <CardVoteBar cardId={item.card_id} articleId={item.article_id} />
          </div>
        </div>
      )}
    </main>
  );
}
