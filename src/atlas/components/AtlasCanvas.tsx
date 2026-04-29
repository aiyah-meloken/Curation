// Atlas — main SVG cartographic canvas.

import { useState } from "react";
import {
  GRATICULE,
  SEA_LABELS,
  SEA_MONSTERS,
  SEA_MONSTER_PATH,
  SEA_SWIRLS,
} from "../lib/decoration";
import type {
  AtlasCard,
  AtlasDSL,
  AtlasLayout,
  ContinentLayout,
  RouteLayout,
  SettlementLayout,
} from "../types";

type Props = {
  dsl: AtlasDSL;
  cards: AtlasCard[];
  layout: AtlasLayout;
  isCardRead: (card_id: string) => boolean;
  onSettlementHover: (card_id: string | null, x: number, y: number) => void;
  onSettlementClick: (card_id: string) => void;
};

export function AtlasCanvas({
  dsl,
  cards,
  layout,
  isCardRead,
  onSettlementHover,
  onSettlementClick,
}: Props) {
  const [hoveredBigDomain, setHoveredBigDomain] = useState<string | null>(null);
  const [hoveredRoute, setHoveredRoute] = useState<{
    routeKey: string;
    label: string;
    x: number;
    y: number;
  } | null>(null);

  const cardById = new Map<string, AtlasCard>();
  for (const c of cards) if (c.card_id) cardById.set(c.card_id, c);

  return (
    <svg
      viewBox={`0 0 ${layout.canvas.width} ${layout.canvas.height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <defs>
        <pattern
          id="atlas-ocean-waves"
          x={0}
          y={0}
          width={60}
          height={20}
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0,10 q15,-6 30,0 t30,0"
            stroke="#7a8d75"
            strokeWidth={0.4}
            fill="none"
            opacity={0.35}
          />
        </pattern>
      </defs>

      {/* Sea base = wave pattern, then translucent paper overlay so coastlines pop */}
      <rect
        width={layout.canvas.width}
        height={layout.canvas.height}
        fill="url(#atlas-ocean-waves)"
      />
      <rect
        width={layout.canvas.width}
        height={layout.canvas.height}
        fill="var(--atlas-paper)"
        opacity={0.86}
      />

      {/* Graticule */}
      <g stroke="#7a6a44" strokeWidth={0.3} opacity={0.18}>
        {GRATICULE.horizontals.map((y) => (
          <line key={`h-${y}`} x1={0} y1={y} x2={layout.canvas.width} y2={y} />
        ))}
        {GRATICULE.verticals.map((x) => (
          <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={layout.canvas.height} />
        ))}
      </g>

      {/* Sea swirls */}
      <g
        stroke="var(--atlas-ink-2)"
        strokeWidth={0.4}
        fill="none"
        opacity={0.35}
      >
        {SEA_SWIRLS.flatMap((s) =>
          s.radii.map((r, i) => (
            <circle key={`${s.cx}-${s.cy}-${i}`} cx={s.cx} cy={s.cy} r={r} />
          )),
        )}
      </g>

      {/* Sea labels (Terra Incognita / Mare Tenebrarum) */}
      {SEA_LABELS.map((label) => (
        <g key={`sea-${label.x}-${label.y}`}>
          <text
            x={label.x}
            y={label.y}
            textAnchor="middle"
            fontFamily="var(--atlas-display)"
            fontStyle="italic"
            fontSize={label.size ?? 18}
            fill="var(--atlas-ink-2)"
            opacity={0.42}
            letterSpacing="0.18em"
          >
            {label.text}
          </text>
          {label.italic && (
            <text
              x={label.x}
              y={label.y + 20}
              textAnchor="middle"
              fontFamily="var(--atlas-serif)"
              fontStyle="italic"
              fontSize={11}
              fill="var(--atlas-ink-2)"
              opacity={0.65}
            >
              {label.italic}
            </text>
          )}
        </g>
      ))}

      {/* Sea monsters */}
      {SEA_MONSTERS.map((m, i) => (
        <g
          key={`mon-${i}`}
          transform={`translate(${m.x},${m.y}) scale(${m.scale})`}
          fill="var(--atlas-ink-2)"
          opacity={0.35}
        >
          <path d={SEA_MONSTER_PATH} />
          <circle cx={22} cy={-3} r={1.5} />
        </g>
      ))}

      {/* Continents */}
      {layout.continents.map((cont) => (
        <Continent
          key={cont.big_domain_id}
          continent={cont}
          dsl={dsl}
          dimmed={
            hoveredBigDomain != null &&
            hoveredBigDomain !== cont.big_domain_id
          }
          isCardRead={isCardRead}
          onSettlementHover={onSettlementHover}
          onSettlementClick={onSettlementClick}
          onContinentEnter={() => setHoveredBigDomain(cont.big_domain_id)}
          onContinentLeave={() => setHoveredBigDomain(null)}
        />
      ))}

      {/* Trade routes — drawn on top of continents but behind hover popovers */}
      <g>
        {layout.routes.map((r) => (
          <TradeRoute
            key={`${r.from_card_id}-${r.to_card_id}`}
            route={r}
            onEnter={(midX, midY) =>
              setHoveredRoute({
                routeKey: `${r.from_card_id}-${r.to_card_id}`,
                label: `共享：${r.shared_entities.join("、")}`,
                x: midX,
                y: midY,
              })
            }
            onLeave={() => setHoveredRoute(null)}
            highlighted={
              hoveredRoute?.routeKey ===
              `${r.from_card_id}-${r.to_card_id}`
            }
          />
        ))}
      </g>

      {/* Route hover tooltip */}
      {hoveredRoute && (
        <g pointerEvents="none">
          <rect
            x={hoveredRoute.x - 70}
            y={hoveredRoute.y - 24}
            width={140}
            height={20}
            fill="var(--atlas-vellum)"
            stroke="var(--atlas-ink)"
            strokeWidth={1}
          />
          <text
            x={hoveredRoute.x}
            y={hoveredRoute.y - 10}
            textAnchor="middle"
            fontFamily="var(--atlas-serif)"
            fontStyle="italic"
            fontSize={11}
            fill="var(--atlas-ink)"
          >
            {hoveredRoute.label}
          </text>
        </g>
      )}
    </svg>
  );
}

function Continent({
  continent,
  dsl,
  dimmed,
  isCardRead,
  onSettlementHover,
  onSettlementClick,
  onContinentEnter,
  onContinentLeave,
}: {
  continent: ContinentLayout;
  dsl: AtlasDSL;
  dimmed: boolean;
  isCardRead: (card_id: string) => boolean;
  onSettlementHover: (card_id: string | null, x: number, y: number) => void;
  onSettlementClick: (card_id: string) => void;
  onContinentEnter: () => void;
  onContinentLeave: () => void;
}) {
  const bd = dsl.big_domains.find((b) => b.id === continent.big_domain_id);
  const latin = bd?.latin_label ?? bd?.label.toUpperCase() ?? "";

  return (
    <g
      onMouseEnter={onContinentEnter}
      onMouseLeave={onContinentLeave}
      style={{ cursor: "default", opacity: dimmed ? 0.3 : 1, transition: "opacity 180ms" }}
    >
      {/* Coastline shadow (water blur halo) */}
      <path
        d={continent.shadow_path}
        fill="none"
        stroke="rgba(90,66,34,.4)"
        strokeWidth={5}
      />
      {/* Continent fill */}
      <path
        d={continent.coastline_path}
        fill={continent.sparse ? "var(--atlas-paper)" : "var(--atlas-paper-2)"}
        stroke="var(--atlas-ink-2)"
        strokeWidth={continent.sparse ? 0.8 : 1.2}
        strokeDasharray={continent.sparse ? "4 3" : undefined}
        opacity={continent.sparse ? 0.85 : 1}
      />

      {/* Big-domain label */}
      <text
        x={continent.label_x}
        y={continent.label_y}
        textAnchor="middle"
        fontFamily="var(--atlas-display)"
        fontSize={continent.sparse ? 11 : 14}
        letterSpacing="0.4em"
        fill="var(--atlas-ink)"
        opacity={continent.sparse ? 0.55 : 1}
      >
        {latin}
      </text>

      {/* Small-domain labels */}
      {continent.small_domains.map((sd) => {
        const sdInfo = dsl.small_domains.find((x) => x.id === sd.small_domain_id);
        return (
          <text
            key={sd.small_domain_id}
            x={sd.label_x}
            y={sd.label_y}
            textAnchor="middle"
            fontFamily="var(--atlas-serif)"
            fontStyle="italic"
            fontSize={11}
            fill="var(--atlas-ink-2)"
          >
            {sdInfo?.label ?? ""}
          </text>
        );
      })}

      {/* Settlements */}
      {continent.cards.map((s) => (
        <Settlement
          key={s.card_id}
          settlement={s}
          isRead={isCardRead(s.card_id)}
          onHover={onSettlementHover}
          onClick={onSettlementClick}
        />
      ))}
    </g>
  );
}

function Settlement({
  settlement,
  isRead,
  onHover,
  onClick,
}: {
  settlement: SettlementLayout;
  isRead: boolean;
  onHover: (card_id: string | null, x: number, y: number) => void;
  onClick: (card_id: string) => void;
}) {
  const isHot = settlement.hot;
  const fill = isRead
    ? "var(--atlas-paper)"
    : isHot
      ? "var(--atlas-rust)"
      : "var(--atlas-vellum)";
  const stroke = isRead ? "var(--atlas-ink-faint)" : "var(--atlas-ink)";
  const strokeWidth = isRead ? 0.6 : 1.4;
  const opacity = isRead ? 0.5 : 1;

  return (
    <g
      onMouseEnter={() => onHover(settlement.card_id, settlement.x, settlement.y)}
      onMouseLeave={() => onHover(null, 0, 0)}
      onClick={(e) => {
        e.stopPropagation();
        onClick(settlement.card_id);
      }}
      style={{ cursor: "pointer" }}
    >
      <circle
        cx={settlement.x}
        cy={settlement.y}
        r={settlement.radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
        style={{ transition: "all 180ms" }}
      />
    </g>
  );
}

function TradeRoute({
  route,
  onEnter,
  onLeave,
  highlighted,
}: {
  route: RouteLayout;
  onEnter: (midX: number, midY: number) => void;
  onLeave: () => void;
  highlighted: boolean;
}) {
  // Midpoint of the path bounding box (approximate, for tooltip placement).
  // Parse the M and last x,y from the path.
  const m = route.path.match(/M\s*([\d.-]+),([\d.-]+).*?([\d.-]+),([\d.-]+)$/);
  const midX = m ? (parseFloat(m[1]) + parseFloat(m[3])) / 2 : 0;
  const midY = m ? (parseFloat(m[2]) + parseFloat(m[4])) / 2 : 0;
  return (
    <path
      d={route.path}
      fill="none"
      stroke="var(--atlas-crimson)"
      strokeWidth={highlighted ? 1.2 : 0.8}
      strokeDasharray="1 4"
      opacity={highlighted ? 0.85 : 0.55}
      onMouseEnter={() => onEnter(midX, midY)}
      onMouseLeave={onLeave}
      style={{ transition: "stroke-width 150ms, opacity 150ms", cursor: "help" }}
    />
  );
}
