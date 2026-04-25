import { useState, useRef, useCallback, useLayoutEffect, useEffect } from "react";
import { Send, Square, Trash2, BookMarked } from "lucide-react";
import type { AgentConfig } from "../lib/chat";

const TEXTAREA_MAX_HEIGHT = 200;

interface ChatInputProps {
  agents: AgentConfig[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  isStreaming: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
  onClear: () => void;
  onSaveToNotes: () => void;
  hasMessages: boolean;
  onHeightChange?: (height: number) => void;
}

const STATUS_CONFIG = {
  connected: { color: "var(--accent-green)", label: "已连接" },
  connecting: { color: "var(--accent-gold)", label: "连接中..." },
  disconnected: { color: "var(--text-muted)", label: "待连接" },
  error: { color: "var(--accent-red)", label: "断开" },
} as const;

const NOT_INSTALLED = { color: "var(--accent-red)", label: "未安装" } as const;

export function ChatInput({
  agents,
  selectedAgentId,
  onSelectAgent,
  connectionStatus,
  isStreaming,
  onSend,
  onCancel,
  onClear,
  onSaveToNotes,
  hasMessages,
  onHeightChange,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);

  // Auto-grow the textarea: shrink to one line, then expand to fit content
  // up to TEXTAREA_MAX_HEIGHT (after which the textarea scrolls internally).
  useLayoutEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
  }, [text]);

  // Report container height upward so floating UI (vote pill, admin flag)
  // can sit just above the input as it grows.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onHeightChange) return;
    onHeightChange(el.offsetHeight);
    const ro = new ResizeObserver(() => {
      onHeightChange(el.offsetHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setText("");
  }, [text, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !composingRef.current) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const status = selectedAgent && !selectedAgent.detected
    ? NOT_INSTALLED
    : STATUS_CONFIG[connectionStatus];

  return (
    <div className="chat-input-container" ref={containerRef}>
      <div className="chat-input-inner">
      <div className="chat-control-bar">
        <div className="chat-control-left">
          <select
            className="chat-agent-selector"
            value={selectedAgentId ?? ""}
            onChange={(e) => onSelectAgent(e.target.value)}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.detected}>
                {a.name}{!a.detected ? " (未安装)" : ""}
              </option>
            ))}
          </select>
          <div className="chat-status">
            <div className="chat-status-dot" style={{ backgroundColor: status.color }} />
            <span style={{ color: status.color }}>{status.label}</span>
          </div>
        </div>
        <div className="chat-control-right">
          {hasMessages && (
            <button className="chat-control-btn" onClick={onClear}>
              <Trash2 size={13} />
              <span>清空会话</span>
            </button>
          )}
          <button className="chat-control-btn" onClick={onSaveToNotes}>
            <BookMarked size={13} />
            <span>保存到笔记</span>
          </button>
        </div>
      </div>
      <div className="chat-input-bar">
        <textarea
          ref={inputRef}
          className="chat-input-textarea"
          placeholder="问点什么..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          rows={1}
        />
        {isStreaming ? (
          <button className="chat-send-btn" onClick={onCancel}>
            <Square size={14} />
          </button>
        ) : (
          <button className="chat-send-btn" onClick={handleSubmit} disabled={!text.trim()}>
            <Send size={14} />
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
