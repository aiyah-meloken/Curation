// Atlas — Legend (Mapparum Conventiones) bottom-left.

export function AtlasLegend() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 36,
        left: 36,
        background: "var(--atlas-vellum)",
        border: "1px solid var(--atlas-ink)",
        padding: "14px 16px",
        fontFamily: "var(--atlas-serif)",
        fontSize: 12,
        color: "var(--atlas-ink-2)",
        maxWidth: 280,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "var(--atlas-display)",
          fontSize: 11,
          letterSpacing: "0.18em",
          color: "var(--atlas-ink)",
          marginBottom: 8,
          borderBottom: "1px solid var(--atlas-ink-2)",
          paddingBottom: 4,
          textTransform: "uppercase",
        }}
      >
        Mapparum Conventiones
      </div>
      <Row
        glyph={
          <svg width={22} height={14}>
            <circle
              cx={11}
              cy={7}
              r={6}
              fill="var(--atlas-rust)"
              stroke="var(--atlas-ink)"
              strokeWidth={1.4}
            />
          </svg>
        }
        text="主城 / 多源汇聚"
      />
      <Row
        glyph={
          <svg width={22} height={14}>
            <circle
              cx={11}
              cy={7}
              r={3}
              fill="var(--atlas-vellum)"
              stroke="var(--atlas-ink)"
              strokeWidth={1.4}
            />
          </svg>
        }
        text="村落 / 单源新闻"
      />
      <Row
        glyph={
          <svg width={22} height={14}>
            <circle
              cx={11}
              cy={7}
              r={2.5}
              fill="var(--atlas-paper)"
              stroke="var(--atlas-ink-faint)"
              strokeWidth={0.6}
              opacity={0.5}
            />
          </svg>
        }
        text="褪色聚落 / 已读"
      />
      <Row
        glyph={
          <svg width={32} height={6}>
            <line
              x1={0}
              y1={3}
              x2={32}
              y2={3}
              stroke="var(--atlas-crimson)"
              strokeWidth={0.8}
              strokeDasharray="1 4"
            />
          </svg>
        }
        text="商路 / 共享实体"
      />
    </div>
  );
}

function Row({ glyph, text }: { glyph: React.ReactNode; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
      <span style={{ flexShrink: 0 }}>{glyph}</span>
      <span>{text}</span>
    </div>
  );
}
