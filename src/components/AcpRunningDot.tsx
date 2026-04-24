import { useIsCardRunning } from "../lib/acp/store";

type Props = {
  cardId: string | null;
  size?: number;
  title?: string;
  className?: string;
};

/**
 * Pulsing dot shown when any ACP session tied to this card is currently
 * Running. Card-aware so it works in list rows and the reader header.
 */
export function AcpRunningDot({ cardId, size = 8, title = "ACP 回复中", className = "" }: Props) {
  const running = useIsCardRunning(cardId);
  if (!running) return null;
  return (
    <span
      className={`inline-block rounded-full bg-emerald-500 animate-pulse ${className}`}
      style={{ width: size, height: size }}
      title={title}
      aria-label={title}
    />
  );
}
