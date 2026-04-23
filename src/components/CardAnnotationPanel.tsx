import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  useAddAnnotation,
  useCardAnnotationsSingle,
  useDeleteAnnotation,
} from "../hooks/useFeedback";

function formatTs(iso: string | null) {
  if (!iso) return "";
  return iso.replace("T", " ").slice(0, 16);
}

export function CardAnnotationPanel({ cardId }: { cardId: string }) {
  const { data = [] } = useCardAnnotationsSingle(cardId, true);
  const add = useAddAnnotation();
  const del = useDeleteAnnotation();
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");

  const canSubmit = label.trim().length > 0 && !add.isPending;

  const submit = () => {
    if (!canSubmit) return;
    add.mutate(
      { cardId, label: label.trim(), note: note.trim() || undefined },
      {
        onSuccess: () => {
          setLabel("");
          setNote("");
        },
      },
    );
  };

  return (
    <div style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input
          placeholder="标签 (必填)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          maxLength={500}
          style={{ flex: 1 }}
        />
        <input
          placeholder="备注 (可选)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          maxLength={2000}
          style={{ flex: 2 }}
        />
        <button disabled={!canSubmit} onClick={submit}>+ 添加</button>
      </div>
      {data.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>暂无标注</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {data.map((a) => (
            <li
              key={a.id}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}
            >
              <span style={{ fontWeight: 600 }}>{a.label}</span>
              {a.note && <span style={{ color: "var(--text-muted)" }}>{a.note}</span>}
              <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>
                {a.admin_username} · {formatTs(a.created_at)}
              </span>
              <button
                onClick={() => del.mutate(a.id)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                aria-label="删除"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
