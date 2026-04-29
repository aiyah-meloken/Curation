// Atlas — hovering settlement label.
// Sized for typical card metadata; tries to avoid going off-canvas via
// `placeFloatingCard` from lib/geometry.ts.

import type { AtlasCard, AtlasDSL } from "../types";

type Props = {
  card: AtlasCard;
  dsl: AtlasDSL;
  position: { x: number; y: number; anchor: "left" | "right" };
  onMarkRead: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export function AtlasFloatingCard({
  card,
  dsl,
  position,
  onMarkRead,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const sd = dsl.small_domains.find((s) => s.id === card.small_domain_id);
  const bd = dsl.big_domains.find((b) =>
    b.small_domain_ids.includes(card.small_domain_id),
  );
  const sourceCount = card.source_count ?? 1;
  const isHot = sourceCount >= 2;
  const account = card.article_meta?.account ?? "";

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: "var(--atlas-popover-width)",
        background: "var(--atlas-vellum)",
        border: "1.5px solid var(--atlas-ink)",
        padding: "14px 16px 12px",
        boxShadow: "var(--atlas-shadow-pinned)",
        fontFamily: "var(--atlas-serif)",
        zIndex: 30,
        pointerEvents: "auto",
        animation: "atlas-fade-in 180ms cubic-bezier(.16,1,.3,1) both",
      }}
    >
      {/* Arrow tail pointing back at the settlement */}
      <ArrowTail anchor={position.anchor} />

      <div
        style={{
          fontFamily: "var(--atlas-mono)",
          fontSize: 9,
          letterSpacing: "0.22em",
          color: "var(--atlas-rust)",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {bd?.label ?? "—"} · {sd?.label ?? "—"}
      </div>
      <h3
        style={{
          fontFamily: "var(--atlas-display)",
          fontSize: 16,
          fontWeight: 400,
          margin: "0 0 6px",
          lineHeight: 1.25,
          color: "var(--atlas-ink)",
        }}
      >
        {card.title}
      </h3>
      <p
        style={{
          fontFamily: "var(--atlas-serif)",
          fontSize: 12.5,
          color: "var(--atlas-ink-2)",
          lineHeight: 1.55,
          margin: "0 0 10px",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {card.description ?? ""}
      </p>
      <div
        style={{
          fontFamily: "var(--atlas-serif)",
          fontStyle: "italic",
          fontSize: 11,
          color: "var(--atlas-ink-2)",
          borderTop: "1px dotted var(--atlas-ink-2)",
          paddingTop: 8,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>— {account || "—"}</span>
        <span>{isHot ? `⚜ ${sourceCount} 源汇` : "· 单源"}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMarkRead();
        }}
        style={{
          marginTop: 10,
          width: "100%",
          fontFamily: "var(--atlas-mono)",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          background: "var(--atlas-ink)",
          color: "var(--atlas-vellum)",
          border: "none",
          padding: "8px 10px",
          cursor: "pointer",
          transition: "background .15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "var(--atlas-rust)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "var(--atlas-ink)";
        }}
      >
        ✦ Marked As Read
      </button>
    </div>
  );
}

function ArrowTail({ anchor }: { anchor: "left" | "right" }) {
  const common: React.CSSProperties = {
    position: "absolute",
    width: 14,
    height: 14,
    background: "var(--atlas-vellum)",
    top: 22,
  };
  if (anchor === "left") {
    return (
      <span
        style={{
          ...common,
          left: -8,
          borderLeft: "1.5px solid var(--atlas-ink)",
          borderBottom: "1.5px solid var(--atlas-ink)",
          transform: "rotate(45deg)",
        }}
      />
    );
  }
  return (
    <span
      style={{
        ...common,
        right: -8,
        borderTop: "1.5px solid var(--atlas-ink)",
        borderRight: "1.5px solid var(--atlas-ink)",
        transform: "rotate(45deg)",
      }}
    />
  );
}
