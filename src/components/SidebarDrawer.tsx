// curation-app/src/components/SidebarDrawer.tsx
import { useEffect, useRef } from "react";

interface SidebarDrawerProps {
  open: boolean;
  /** When true, drawer ignores its own mouseleave for hover-mode close.
   *  Settings drawer is `sticky=true` (closed via toggle/Esc/click-outside).
   *  Nav drawer is `sticky=false` (closed when mouse leaves rail+drawer area). */
  sticky: boolean;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  children: React.ReactNode;
}

export function SidebarDrawer({
  open,
  sticky,
  onClose,
  onMouseEnter,
  onMouseLeave,
  children,
}: SidebarDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);

  // Esc closes (only matters when sticky; non-sticky closes via mouseleave).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Sticky drawer: click outside drawer (and outside rail) closes.
  useEffect(() => {
    if (!open || !sticky) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (drawerRef.current && drawerRef.current.contains(target)) return;
      // Clicks on the rail are NOT outside-clicks — rail is the trigger origin.
      const rail = document.querySelector(".rail");
      if (rail && rail.contains(target)) return;
      onClose();
    };
    // Defer to next tick so the click that opened settings doesn't close it.
    const id = window.setTimeout(() => {
      window.addEventListener("click", onClick, true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("click", onClick, true);
    };
  }, [open, sticky, onClose]);

  if (!open) return null;

  return (
    <aside
      ref={drawerRef}
      className="drawer"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </aside>
  );
}
