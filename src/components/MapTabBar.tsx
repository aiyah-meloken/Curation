import { useMemo, useState } from "react";
import { MapDatePicker } from "./MapDatePicker";

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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function MapTabBar({ value, onChange, earliest }: Props) {
  const yesterday = useMemo(() => isoDaysAgo(1), []);
  const dayBefore = useMemo(() => isoDaysAgo(2), []);
  // Picker max = 3 days ago (never collide with the fixed tabs).
  const pickerMax = useMemo(() => isoDaysAgo(3), []);
  const [pickerOpen, setPickerOpen] = useState(false);

  const tabs = [
    { kind: "yesterday" as const, label: `昨天 · ${yesterday.slice(5)}` },
    { kind: "day_before" as const, label: `前天 · ${dayBefore.slice(5)}` },
  ];

  const earlierLabel =
    value.kind === "earlier" ? `更早 · ${value.date.slice(5)}` : "更早";

  return (
    <div className="map-tabbar" role="tablist">
      {tabs.map((t) => (
        <button
          type="button"
          key={t.kind}
          role="tab"
          aria-selected={value.kind === t.kind}
          className={`map-tab ${value.kind === t.kind ? "active" : ""}`}
          onClick={() => onChange({ kind: t.kind })}
        >
          {t.label}
        </button>
      ))}
      <span className="map-tab-earlier-wrap">
        <button
          type="button"
          role="tab"
          aria-selected={value.kind === "earlier"}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          className={`map-tab ${value.kind === "earlier" ? "active" : ""}`}
          onClick={() => setPickerOpen((o) => !o)}
        >
          {earlierLabel}
        </button>
        {pickerOpen && (
          <MapDatePicker
            value={value.kind === "earlier" ? value.date : null}
            onChange={(iso) => onChange({ kind: "earlier", date: iso })}
            min={earliest}
            max={pickerMax}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </span>
    </div>
  );
}

export function resolveTabDate(tab: DateTab): string {
  if (tab.kind === "yesterday") return isoDaysAgo(1);
  if (tab.kind === "day_before") return isoDaysAgo(2);
  return tab.date;
}
