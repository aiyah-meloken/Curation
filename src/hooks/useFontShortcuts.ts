import { useEffect } from "react";

interface Handlers {
  bump: (delta: number) => void;
  clear: () => void;
}

/**
 * Binds VSCode-style font scaling shortcuts on window keydown.
 * Cmd/Ctrl + =  or Cmd/Ctrl + Shift + =  → bump(+1)
 * Cmd/Ctrl + -                           → bump(-1)
 * Cmd/Ctrl + 0                           → clear override (auto)
 */
export function useFontShortcuts({ bump, clear }: Handlers): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      // Ignore while typing in editable elements
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      // Plus: "=" (with or without shift) or "+"
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        bump(+1);
        return;
      }
      if (e.key === "-") {
        e.preventDefault();
        bump(-1);
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        clear();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [bump, clear]);
}
