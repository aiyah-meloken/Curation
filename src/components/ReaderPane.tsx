import { useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { BookOpen, Loader2 } from "lucide-react";
import { stripFrontmatter, mdComponents } from "../lib/markdown";
import { useCardContent } from "../hooks/useCards";
import { useArticleContent } from "../hooks/useArticles";
import { useMarkCardReadSingle } from "../hooks/useInbox";
import { FavoriteButton } from "./FavoriteButton";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";
import { CardFrame } from "./CardFrame";
import { useChat, useAgentDetection } from "../hooks/useChat";
import type { InboxItem, DiscardedItem } from "../types";

function routingTag(routing: "ai_curation" | "original_push") {
  if (routing === "ai_curation") {
    return <span className="inbox-tag tag-ai" style={{ fontSize: "0.72rem" }}>AI总结</span>;
  }
  return <span className="inbox-tag tag-original" style={{ fontSize: "0.72rem" }}>原文</span>;
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
  onOpenDrawer: () => void;
  onSelectAccount?: (accountId: number) => void;
}

function SourceBar({
  meta,
  routing,
  isDiscarded,
  routingReason,
  onOpenDrawer,
  cardId,
}: {
  meta: { title: string; account: string; author: string | null; publish_time: string | null; url: string };
  routing?: "ai_curation" | "original_push";
  isDiscarded: boolean;
  routingReason?: string;
  onOpenDrawer?: () => void;
  cardId?: string;
}) {
  return (
    <div className="reader-source-bar">
      {/* Line 1: original title + tag */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
        <span style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: "0.88rem", flex: 1 }}>
          {meta.title}
        </span>
        {routing && routingTag(routing)}
        {isDiscarded && (
          <span className="inbox-tag tag-discard" style={{ fontSize: "0.72rem" }}>丢弃</span>
        )}
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
      {routingReason && (
        <div style={{ fontSize: "0.76rem", color: "var(--accent-gold-hi)", marginTop: 4 }}>
          丢弃原因: {routingReason}
        </div>
      )}
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
  onOpenDrawer,
}: ReaderPaneProps) {
  const markRead = useMarkCardReadSingle();
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load card content for system prompt
  const { data: cardContentData } = useCardContent(selectedItem?.card_id ?? null, "source");

  // Chat hooks (must be called before any early returns)
  const { agents, selectedAgentId, setSelectedAgentId } = useAgentDetection();
  const selectedAgentName = agents.find((a) => a.id === selectedAgentId)?.name ?? "AI";
  const chatCardId = isHomeView ? null : (selectedItem?.card_id ?? null);
  const chat = useChat(chatCardId);
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
    let prompt = `你正在通过 Curation 应用的 ACP 协议与用户连接。

Curation 是个人 AI 资讯助理，自动抓取微信公众号文章并生成卡片摘要。

可用 MCP 工具：
- get_current_context — 当前阅读的卡片内容
- search_cards — 全文搜索卡片库
- get_card_content — 获取指定卡片内容
- get_favorites — 收藏列表
${notesPath ? `\n用户的笔记路径：${notesPath}` : ""}
请简练回复，使用中文和 markdown。`;

    if (selectedItem) {
      prompt += `\n\n用户正在阅读「${selectedItem.article_meta.title}」（${selectedItem.article_meta.account}）：\n\n`;
      prompt += cardContentData?.content ?? `（请使用 get_current_context 获取正文）`;
    } else {
      prompt += `\n\n用户未在阅读卡片，直接对话。`;
    }

    return prompt;
  }, [selectedItem, cardContentData]);

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

  // Home view
  if (isHomeView) {
    return (
      <main className="reader-pane" style={{ position: "relative", overflow: "hidden" }}>
        <div ref={scrollRef} style={{ overflowY: "auto", flex: 1 }}>
          <div className="reader-content" style={{ paddingBottom: 140 }}>
            <ChatMessages
              messages={chat.messages}
              streamingContent={chat.streamingContent}
              isStreaming={chat.isStreaming}
              agentName={selectedAgentName}
              userName="你"
            />
          </div>
        </div>
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
        />
      </main>
    );
  }

  // Empty state
  if (!selectedItem && !selectedDiscardedItem) {
    return (
      <main className="reader-pane" style={{ position: "relative", overflow: "hidden" }}>
        <div className="reader-empty" style={{ flex: 1 }}>
          <div className="reader-empty-icon"><BookOpen size={64} /></div>
          <h3>请选择一篇内容阅读</h3>
        </div>
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
        />
      </main>
    );
  }

  // Discarded view
  if (isDiscardedView && selectedDiscardedItem) {
    return (
      <main className="reader-pane">
        <SourceBar
          meta={selectedDiscardedItem.article_meta}
          isDiscarded={true}
          routingReason={selectedDiscardedItem.routing_reason}
        />
        <div className="reader-content animate-in">
          <ArticleHtmlView articleId={selectedDiscardedItem.article_id} />
        </div>
      </main>
    );
  }

  // Analyzing item — show original article with indicator
  if (selectedItem && selectedItem.queue_status) {
    return (
      <main className="reader-pane">
        <div className="reader-source-bar">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
            <span style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: "0.88rem", flex: 1 }}>
              {selectedItem.article_meta.title}
            </span>
            <span className="inbox-tag" style={{ background: "var(--accent-blue-dim)", color: "var(--accent-blue)", display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.72rem" }}>
              <Loader2 size={10} className="animate-spin" />
              正在分析...
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <span>{selectedItem.article_meta.account}</span>
              {selectedItem.article_meta.author && <><span>·</span><span>{selectedItem.article_meta.author}</span></>}
              {selectedItem.article_meta.publish_time && <><span>·</span><span>{formatTime(selectedItem.article_meta.publish_time)}</span></>}
            </div>
          </div>
        </div>
        <div className="reader-content animate-in">
          <ArticleHtmlView articleId={selectedItem.article_id} />
        </div>
      </main>
    );
  }

  // Inbox item view
  if (selectedItem) {
    return (
      <main className="reader-pane" style={{ position: "relative", overflow: "hidden" }}>
        <SourceBar
          meta={selectedItem.article_meta}
          routing={selectedItem.routing ?? undefined}
          isDiscarded={false}
          onOpenDrawer={selectedItem.routing === "ai_curation" ? onOpenDrawer : undefined}
          cardId={selectedItem.card_id ?? undefined}
        />
        <div ref={scrollRef} style={{ overflowY: "auto", flex: 1 }}>
          <div className="reader-content animate-in" style={{ paddingBottom: 140 }}>
            {/* Card content (markdown) — shown for both ai_curation and original_push */}
            {selectedItem.card_id && (
              <CardFrame chatActive={chatActive} label={undefined}>
                <CardContentView cardId={selectedItem.card_id} />
              </CardFrame>
            )}

            {/* Original push: show original article (rich text HTML) below the guide card */}
            {selectedItem.routing === "original_push" && (
              <CardFrame chatActive={chatActive} label={undefined}>
                <ArticleHtmlView articleId={selectedItem.article_id} />
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
        />
      </main>
    );
  }

  return null;
}
