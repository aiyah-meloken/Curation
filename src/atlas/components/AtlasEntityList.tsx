// Atlas — left-side panel listing shared entities (the ones that produce
// trade-route connections). Clicking an entity pins the focus on that
// entity's constellation, the same as clicking one of its lines on the map.

import { useAtlasStore } from "../state/store";

type EntityRow = {
  name: string;
  cardCount: number;
};

type Props = {
  entities: EntityRow[];
  selectedEntity: string | null;
  onSelect: (entity: string) => void;
};

export function AtlasEntityList({
  entities,
  selectedEntity,
  onSelect,
}: Props) {
  const routesVisible = useAtlasStore((s) => s.routes_visible);
  const hiddenEntities = useAtlasStore((s) => s.hidden_entities);
  const toggleHidden = useAtlasStore((s) => s.toggleEntityHidden);

  if (entities.length === 0 || !routesVisible) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 28,
        width: 196,
        maxHeight: "calc(100vh - 240px)",
        overflowY: "auto",
        background: "var(--atlas-vellum)",
        border: "1px solid var(--atlas-ink)",
        boxShadow: "var(--atlas-shadow-vellum)",
        fontFamily: "var(--atlas-serif)",
        fontSize: 12,
        color: "var(--atlas-ink-2)",
        zIndex: 5,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          fontFamily: "var(--atlas-display)",
          fontSize: 11,
          letterSpacing: "0.18em",
          color: "var(--atlas-ink)",
          padding: "10px 12px 6px",
          borderBottom: "1px solid var(--atlas-ink-2)",
          textTransform: "uppercase",
          background: "var(--atlas-vellum)",
          position: "sticky",
          top: 0,
        }}
      >
        共享实体 · {entities.length}
      </div>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: "4px 0",
        }}
      >
        {entities.map((e) => {
          const isSelected = selectedEntity === e.name;
          const isHidden = hiddenEntities.has(e.name);
          return (
            <li
              key={e.name}
              onClick={() => {
                if (isHidden) return; // hidden rows are inert until shown
                onSelect(e.name);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 6px 4px 10px",
                cursor: isHidden ? "default" : "pointer",
                background: isSelected
                  ? "var(--atlas-crimson)"
                  : "transparent",
                color: isSelected
                  ? "var(--atlas-vellum)"
                  : isHidden
                    ? "var(--atlas-ink-faint)"
                    : "var(--atlas-ink-2)",
                fontWeight: isSelected ? 500 : 400,
                opacity: isHidden ? 0.55 : 1,
                textDecoration: isHidden ? "line-through" : "none",
                transition: "background 120ms, opacity 120ms",
                userSelect: "none",
              }}
              onMouseEnter={(ev) => {
                if (isSelected) return;
                (ev.currentTarget as HTMLElement).style.background =
                  "var(--atlas-paper)";
              }}
              onMouseLeave={(ev) => {
                if (isSelected) return;
                (ev.currentTarget as HTMLElement).style.background =
                  "transparent";
              }}
            >
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {e.name}
              </span>
              <span
                style={{
                  fontFamily: "var(--atlas-mono)",
                  fontSize: 10,
                  color: isSelected
                    ? "var(--atlas-vellum)"
                    : "var(--atlas-ink-faint)",
                  flexShrink: 0,
                }}
              >
                {e.cardCount}
              </span>
              {/* Visibility toggle. Hides this entity's lines on the map
                  without removing it from the list (so user can re-show). */}
              <button
                type="button"
                title={isHidden ? "显示这条线" : "隐藏这条线"}
                onClick={(ev) => {
                  ev.stopPropagation();
                  toggleHidden(e.name);
                }}
                style={{
                  width: 18,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  color: isSelected
                    ? "var(--atlas-vellum)"
                    : "var(--atlas-ink-faint)",
                  opacity: 0.7,
                  flexShrink: 0,
                }}
                onMouseEnter={(ev) => {
                  (ev.currentTarget as HTMLElement).style.opacity = "1";
                }}
                onMouseLeave={(ev) => {
                  (ev.currentTarget as HTMLElement).style.opacity = "0.7";
                }}
              >
                {isHidden ? "○" : "●"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
