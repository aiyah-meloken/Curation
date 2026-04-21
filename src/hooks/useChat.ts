import { useState, useEffect, useCallback, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  detectAgents,
  createChatSession,
  getSessionForCard,
  getHomeSession,
  getChatMessages,
  sendChatMessage,
  cancelChatStream,
  setCurrentCardContext,
  type AgentConfig,
  type ChatSession,
  type ChatMessage,
  type ChatStreamEvent,
  type CardContext,
} from "../lib/chat";

// ─── useAgentDetection ───────────────────────────────────────────────────────

export function useAgentDetection() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    detectAgents().then((detected) => {
      setAgents(detected);
      if (detected.length > 0 && selectedAgentId === null) {
        setSelectedAgentId(detected[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { agents, selectedAgentId, setSelectedAgentId };
}

// ─── useChat ─────────────────────────────────────────────────────────────────

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export function useChat(cardId: string | null) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");

  const unlistenRef = useRef<UnlistenFn | null>(null);
  const currentSessionRef = useRef<ChatSession | null>(null);

  // Keep ref in sync with state so callbacks have fresh value
  useEffect(() => {
    currentSessionRef.current = session;
  }, [session]);

  // Register the Tauri event listener for streaming once
  useEffect(() => {
    let cancelled = false;

    listen<ChatStreamEvent>("chat-stream", (event) => {
      const { event_type, content } = event.payload;

      if (event_type === "text_chunk") {
        setStreamingContent((prev) => prev + content);
        setConnectionStatus("connected");
      } else if (event_type === "done") {
        setStreamingContent("");
        setIsStreaming(false);
        setConnectionStatus("disconnected");
        // Reload messages from DB so the persisted assistant turn appears
        const currentSession = currentSessionRef.current;
        if (currentSession) {
          getChatMessages(currentSession.session_id).then((msgs) => {
            if (!cancelled) setMessages(msgs);
          });
        }
      } else if (event_type === "error") {
        setStreamingContent("");
        setIsStreaming(false);
        setConnectionStatus("error");
      }
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlistenRef.current = unlisten;
      }
    });

    return () => {
      cancelled = true;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  // Load session + messages whenever cardId changes
  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const existing =
          cardId !== null
            ? await getSessionForCard(cardId)
            : await getHomeSession();

        if (cancelled) return;

        setSession(existing);

        if (existing) {
          const msgs = await getChatMessages(existing.session_id);
          if (!cancelled) setMessages(msgs);
        } else {
          setMessages([]);
        }
      } catch {
        if (!cancelled) {
          setSession(null);
          setMessages([]);
        }
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const sendMessage = useCallback(
    async (text: string, agentId: string, systemPrompt: string) => {
      setIsStreaming(true);
      setConnectionStatus("connecting");

      try {
        // Create session on first message if none exists
        let activeSession = currentSessionRef.current;
        if (!activeSession) {
          activeSession = await createChatSession(cardId, agentId);
          setSession(activeSession);
        }

        // Optimistically add user message to UI
        const optimisticMsg: ChatMessage = {
          id: Date.now(),
          session_id: activeSession.session_id,
          role: "user",
          content: text,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMsg]);

        await sendChatMessage(
          activeSession.session_id,
          agentId,
          text,
          systemPrompt,
        );
        // Streaming events handled by the listener above
      } catch {
        setIsStreaming(false);
        setConnectionStatus("error");
      }
    },
    [cardId],
  );

  const cancel = useCallback(async () => {
    try {
      await cancelChatStream();
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      setConnectionStatus("disconnected");
    }
  }, []);

  const clearSession = useCallback(
    async (agentId: string) => {
      // Stop any in-flight stream first
      try {
        await cancelChatStream();
      } catch {
        // ignore
      }

      setIsStreaming(false);
      setStreamingContent("");
      setConnectionStatus("disconnected");

      const newSession = await createChatSession(cardId, agentId);
      setSession(newSession);
      setMessages([]);
    },
    [cardId],
  );

  return {
    session,
    messages,
    streamingContent,
    isStreaming,
    connectionStatus,
    sendMessage,
    clearSession,
    cancel,
  };
}

// ─── useCardContext ───────────────────────────────────────────────────────────

export function useCardContext(
  cardId: string | null,
  cardData: CardContext | null,
) {
  useEffect(() => {
    if (!cardId || !cardData) return;

    setCurrentCardContext(cardData);

    return () => {
      setCurrentCardContext(null);
    };
  }, [cardId, cardData]);
}
