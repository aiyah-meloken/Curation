// Atlas — title cartouche (top-left decorative title block).

type Props = { date: string };

export function MapCartouche({ date }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        top: 28,
        left: 28,
        border: "2px double var(--map-ink)",
        padding: "var(--map-cartouche-pad)",
        background: "var(--map-vellum)",
        boxShadow: "var(--map-shadow-vellum)",
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "var(--map-mono)",
          fontSize: 10,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: "var(--map-ink-2)",
        }}
      >
        Curation · Daily Cartographer
      </div>
      <h1
        style={{
          fontFamily: "var(--map-display)",
          fontWeight: 400,
          fontSize: 28,
          letterSpacing: "0.04em",
          margin: "4px 0 0",
        }}
      >
        Mappa Mundi{" "}
        <span style={{ fontStyle: "italic", color: "var(--map-rust)" }}>·</span>{" "}
        <span
          style={{
            fontStyle: "italic",
            fontFamily: "var(--map-serif)",
            color: "var(--map-rust)",
          }}
        >
          {date}
        </span>
      </h1>
      <div
        style={{
          fontFamily: "var(--map-serif)",
          fontStyle: "italic",
          fontSize: 13,
          color: "var(--map-ink-2)",
          marginTop: 4,
        }}
      >
        Tracing the islands a curious mind has visited today.
      </div>
    </div>
  );
}
