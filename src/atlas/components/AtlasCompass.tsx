// Atlas — Compass Rose (8-point star).

export function AtlasCompass() {
  return (
    <svg
      viewBox="-70 -70 140 140"
      style={{
        position: "absolute",
        bottom: 36,
        right: 36,
        width: 140,
        height: 140,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      {/* Outer dashed ring */}
      <circle
        r={55}
        fill="none"
        stroke="var(--atlas-ink-2)"
        strokeWidth={0.5}
        strokeDasharray="2 4"
      />
      {/* Inner ring */}
      <circle r={42} fill="none" stroke="var(--atlas-ink-2)" strokeWidth={0.5} />
      {/* Cross hair */}
      <g stroke="var(--atlas-ink-2)" strokeWidth={0.4}>
        <line x1={-55} y1={0} x2={55} y2={0} />
        <line x1={0} y1={-55} x2={0} y2={55} />
        <line x1={-39} y1={-39} x2={39} y2={39} opacity={0.5} />
        <line x1={-39} y1={39} x2={39} y2={-39} opacity={0.5} />
      </g>
      {/* 8-point star */}
      <polygon
        points="0,-50 6,-6 50,0 6,6 0,50 -6,6 -50,0 -6,-6"
        fill="var(--atlas-rust)"
        stroke="var(--atlas-ink)"
        strokeWidth={0.5}
      />
      <polygon points="0,-50 4,-8 0,0 -4,-8" fill="var(--atlas-ink)" />
      <polygon points="0,50 -4,8 0,0 4,8" fill="var(--atlas-ink)" />
      <polygon points="-50,0 -8,-4 0,0 -8,4" fill="var(--atlas-ink)" opacity={0.7} />
      <polygon points="50,0 8,-4 0,0 8,4" fill="var(--atlas-ink)" opacity={0.7} />
      {/* Cardinal labels */}
      <text
        x={0}
        y={-60}
        textAnchor="middle"
        fontFamily="var(--atlas-display)"
        fontSize={9}
        fill="var(--atlas-ink)"
      >
        N
      </text>
      <text
        x={62}
        y={3}
        textAnchor="middle"
        fontFamily="var(--atlas-display)"
        fontSize={9}
        fill="var(--atlas-ink)"
      >
        E
      </text>
      <text
        x={0}
        y={68}
        textAnchor="middle"
        fontFamily="var(--atlas-display)"
        fontSize={9}
        fill="var(--atlas-ink)"
      >
        S
      </text>
      <text
        x={-62}
        y={3}
        textAnchor="middle"
        fontFamily="var(--atlas-display)"
        fontSize={9}
        fill="var(--atlas-ink)"
      >
        W
      </text>
    </svg>
  );
}
