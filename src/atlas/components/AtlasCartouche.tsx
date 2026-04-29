// Atlas — title cartouche (top-left decorative title block).

type Props = { date: string };

export function AtlasCartouche({ date }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        top: 28,
        left: 28,
        border: "2px double var(--atlas-ink)",
        padding: "var(--atlas-cartouche-pad)",
        background: "var(--atlas-vellum)",
        boxShadow: "var(--atlas-shadow-vellum)",
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "var(--atlas-mono)",
          fontSize: 10,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: "var(--atlas-ink-2)",
        }}
      >
        Curation · Daily Cartographer
      </div>
      <h1
        style={{
          fontFamily: "var(--atlas-display)",
          fontWeight: 400,
          fontSize: 28,
          letterSpacing: "0.04em",
          margin: "4px 0 0",
        }}
      >
        Mappa Mundi{" "}
        <span style={{ fontStyle: "italic", color: "var(--atlas-rust)" }}>·</span>{" "}
        <span
          style={{
            fontStyle: "italic",
            fontFamily: "var(--atlas-serif)",
            color: "var(--atlas-rust)",
          }}
        >
          {date}
        </span>
      </h1>
      <div
        style={{
          fontFamily: "var(--atlas-serif)",
          fontStyle: "italic",
          fontSize: 13,
          color: "var(--atlas-ink-2)",
          marginTop: 4,
        }}
      >
        Tracing the islands a curious mind has visited today.
      </div>
    </div>
  );
}
