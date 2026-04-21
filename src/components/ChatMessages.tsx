import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { mdComponents } from "../lib/markdown";
import type { ChatMessage } from "../lib/chat";

interface ChatMessagesProps {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  agentName: string;
  userName: string;
}

const WAITING_MESSAGES = [
  "正在叫 {agent} 起床",
  "{agent} 正在热身中，马上就来",
  "去找 {agent} 聊聊，稍等",
  "正在敲 {agent} 的门",
  "{agent} 正在赶来的路上",
  "正在给 {agent} 泡咖啡",
  "{agent} 正在翻阅资料",
  "正在和 {agent} 建立连接",
  "{agent} 正在思考中",
  "正在唤醒 {agent}，请稍候",
];

function WaitingIndicator({ agentName }: { agentName: string }) {
  const message = useMemo(
    () => WAITING_MESSAGES[Math.floor(Math.random() * WAITING_MESSAGES.length)].replace("{agent}", agentName),
    [agentName],
  );
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setDots((d) => (d + 1) % 4);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="chat-waiting-text">
      {message}{".".repeat(dots)}
    </span>
  );
}

export function ChatMessages({
  messages,
  streamingContent,
  isStreaming,
  agentName,
  userName,
}: ChatMessagesProps) {
  if (messages.length === 0 && !isStreaming) return null;

  return (
    <div className="chat-messages">
      {messages.map((msg) => (
        <div key={msg.id} className="chat-bubble" data-role={msg.role}>
          <div className="chat-bubble-sender">
            {msg.role === "assistant" ? agentName : userName}
          </div>
          <div className="chat-bubble-content">
            {msg.role === "assistant" ? (
              <div className="markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={mdComponents}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="chat-bubble-text">{msg.content}</div>
            )}
          </div>
        </div>
      ))}

      {isStreaming && streamingContent && (
        <div className="chat-bubble" data-role="assistant">
          <div className="chat-bubble-sender">{agentName}</div>
          <div className="chat-bubble-content">
            <div className="markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={mdComponents}
              >
                {streamingContent}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {isStreaming && !streamingContent && (
        <div className="chat-bubble" data-role="assistant">
          <div className="chat-bubble-sender">{agentName}</div>
          <div className="chat-bubble-content">
            <WaitingIndicator agentName={agentName} />
          </div>
        </div>
      )}
    </div>
  );
}
