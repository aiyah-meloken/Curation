// curation-app/src/components/SidebarDrawer.tsx
import { useEffect, useRef } from "react";

interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function SidebarDrawer({
  open,
  onClose,
  children,
}: SidebarDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);

  // Esc closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Click outside drawer (and outside rail) closes.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (drawerRef.current && drawerRef.current.contains(target)) return;
      // Clicks on the rail are NOT outside-clicks — rail is the trigger origin.
      const rail = document.querySelector(".rail");
      if (rail && rail.contains(target)) return;
      onClose();
    };
    // Defer so the click that opened the drawer doesn't immediately close it.
    const id = window.setTimeout(() => {
      window.addEventListener("click", onClick, true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("click", onClick, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside ref={drawerRef} className="drawer">
      {children}
    </aside>
  );
}
