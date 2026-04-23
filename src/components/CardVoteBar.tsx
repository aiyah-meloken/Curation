import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useCardVotes, useSetVote } from "../hooks/useFeedback";

const DEFAULT_PROMPT = "觉得这张卡片怎么样？";
const THANK_YOU = "感谢你的反馈";

export function CardVoteBar({ cardId }: { cardId: string }) {
  const { data: votes } = useCardVotes([cardId]);
  const setVote = useSetVote();
  const current = votes?.[cardId] ?? null;
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);

  useEffect(() => {
    if (prompt === THANK_YOU) {
      const t = setTimeout(() => setPrompt(DEFAULT_PROMPT), 2000);
      return () => clearTimeout(t);
    }
  }, [prompt]);

  const click = (vote: 1 | -1) => {
    setVote.mutate({ cardId, vote, current });
    setPrompt(THANK_YOU);
  };

  const btn = (_vote: 1 | -1, selected: boolean) => ({
    background: selected ? "var(--accent-gold-dim)" : "transparent",
    color: selected ? "var(--accent-gold)" : "var(--text-muted)",
    border: "none",
    borderRadius: 6,
    padding: "4px 8px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
  });

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 12px",
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 999,
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      }}
    >
      <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{prompt}</span>
      <button
        onClick={() => click(1)}
        style={btn(1, current === 1)}
        aria-label="点赞"
      >
        <ThumbsUp size={16} />
      </button>
      <button
        onClick={() => click(-1)}
        style={btn(-1, current === -1)}
        aria-label="点踩"
      >
        <ThumbsDown size={16} />
      </button>
    </div>
  );
}
