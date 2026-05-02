import { Hourglass } from "lucide-react";

interface Props {
  date: string;
  variant?: "not_ready" | "no_taxonomy" | "no_cards";
}

const COPY: Record<NonNullable<Props["variant"]>, string> = {
  not_ready: "这一天的舆图正在生成…",
  no_taxonomy: "Atlas 分类（taxonomy）尚未配置。",
  no_cards: "这一天没有卡片。",
};

export function AtlasEmptyState({ date, variant = "not_ready" }: Props) {
  return (
    <div className="atlas-empty">
      <Hourglass size={28} className="atlas-empty-icon" aria-hidden />
      <div className="atlas-empty-title">{COPY[variant]}</div>
      <div className="atlas-empty-date">{date}</div>
    </div>
  );
}
