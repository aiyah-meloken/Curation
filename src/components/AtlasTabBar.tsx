import { useMemo, useRef } from "react";

export type DateTab =
  | { kind: "yesterday" }
  | { kind: "day_before" }
  | { kind: "earlier"; date: string };

interface Props {
  value: DateTab;
  onChange: (next: DateTab) => void;
  /** Earliest selectable date (ISO) for the "更早" picker. */
  earliest?: string;
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function AtlasTabBar({ value, onChange, earliest }: Props) {
  const yesterday = useMemo(() => isoDaysAgo(1), []);
  const dayBefore = useMemo(() => isoDaysAgo(2), []);
  // Picker max = 3 days ago (never collide with fixed tabs)
  const pickerMax = useMemo(() => isoDaysAgo(3), []);
  const pickerRef = useRef<HTMLInputElement>(null);

  const tabs = [
    { kind: "yesterday" as const, label: `昨天 · ${yesterday.slice(5)}` },
    { kind: "day_before" as const, label: `前天 · ${dayBefore.slice(5)}` },
  ];

  const earlierLabel =
    value.kind === "earlier" ? `更早 · ${value.date.slice(5)}` : "更早";

  return (
    <div className="atlas-tabbar" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.kind}
          role="tab"
          aria-selected={value.kind === t.kind}
          className={`atlas-tab ${value.kind === t.kind ? "active" : ""}`}
          onClick={() => onChange({ kind: t.kind })}
        >
          {t.label}
        </button>
      ))}
      <span className="atlas-tab-earlier-wrap">
        <button
          role="tab"
          aria-selected={value.kind === "earlier"}
          className={`atlas-tab ${value.kind === "earlier" ? "active" : ""}`}
          onClick={() => {
            const el = pickerRef.current;
            if (!el) return;
            if (typeof (el as any).showPicker === "function") {
              (el as any).showPicker();
            } else {
              el.click();
            }
          }}
        >
          {earlierLabel}
        </button>
        {/* Native date input sits invisibly OVER the button so the calendar
            popup anchors to the button position (not the top-left of tabbar). */}
        <input
          ref={pickerRef}
          type="date"
          max={pickerMax}
          min={earliest}
          value={value.kind === "earlier" ? value.date : ""}
          onChange={(e) => {
            if (e.target.value) onChange({ kind: "earlier", date: e.target.value });
          }}
          className="atlas-tab-date-input"
          aria-hidden
          tabIndex={-1}
        />
      </span>
    </div>
  );
}

export function resolveTabDate(tab: DateTab): string {
  if (tab.kind === "yesterday") return isoDaysAgo(1);
  if (tab.kind === "day_before") return isoDaysAgo(2);
  return tab.date;
}
