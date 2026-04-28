import { create } from "zustand";
import { useAcpStore } from "./store";

// Per-card ACP lifecycle status driven by user action and stream events.
// - pending: user sent a message, awaiting agent response (spinner)
// - unread:  agent replied successfully, user has not viewed it yet
// - read:    agent replied and user is/was viewing the card
// - error:   communication failed
// - closed:  no live session for this card anymore (session evicted/ended)
export type CardStatus = "pending" | "unread" | "read" | "error" | "closed";

type CardStatusState = {
  byCard: Record<string, CardStatus>;
  setStatus: (cardId: string, status: CardStatus) => void;
  clear: (cardId: string) => void;
};

export const useCardStatusStore = create<CardStatusState>((set) => ({
  byCard: {},
  setStatus: (cardId, status) =>
    set((s) => {
      if (s.byCard[cardId] === status) return s;
      return { byCard: { ...s.byCard, [cardId]: status } };
    }),
  clear: (cardId) =>
    set((s) => {
      if (!(cardId in s.byCard)) return s;
      const next = { ...s.byCard };
      delete next[cardId];
      return { byCard: next };
    }),
}));

export function useCardStatus(cardId: string | null): CardStatus | null {
  return useCardStatusStore((s) => (cardId ? s.byCard[cardId] ?? null : null));
}

// Inbox-level "unread" predicate.
//
// A card surfaces in the 未读 list / counts when EITHER:
//   1) it has never been opened (`read_at` is null), OR
//   2) the card was opened but a chat reply arrived afterwards that the user
//      hasn't viewed yet (ACP card status === "unread").
//
// The second case keeps the user from missing async agent replies on cards
// they've already marked-as-read.
export function isInboxUnread(
  item: { read_at: string | null; card_id: string | null },
  acpByCard: Record<string, CardStatus>,
): boolean {
  if (!item.read_at) return true;
  if (item.card_id && acpByCard[item.card_id] === "unread") return true;
  return false;
}

// When a card's last live runtime entry disappears (session evicted or ended),
// transition its status to "closed" — unless it's currently "error", which
// persists so the user keeps seeing the red dot.
let prevCardIds = new Set<string>();
useAcpStore.subscribe((state) => {
  const currCardIds = new Set<string>();
  for (const e of Object.values(state.bySession)) {
    if (e.cardId) currCardIds.add(e.cardId);
  }
  for (const cardId of prevCardIds) {
    if (currCardIds.has(cardId)) continue;
    const cur = useCardStatusStore.getState().byCard[cardId];
    if (!cur) continue;
    if (cur === "error" || cur === "closed") continue;
    useCardStatusStore.getState().setStatus(cardId, "closed");
  }
  prevCardIds = currCardIds;
});
