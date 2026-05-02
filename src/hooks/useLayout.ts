import { useState, useEffect, useCallback } from "react";

const RAIL_WIDTH_PX = 56;
const LIST_READER_RESIZER_PX = 5;
const LAYOUT_RATIO_LIST = 1.8;
const LAYOUT_RATIO_READER = 4;
const LAYOUT_RATIO_SUM = LAYOUT_RATIO_LIST + LAYOUT_RATIO_READER;

function initialListWidthFromViewport(): number {
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const avail = Math.max(0, w - RAIL_WIDTH_PX - LIST_READER_RESIZER_PX);
  const unit = avail / LAYOUT_RATIO_SUM;
  return Math.max(200, Math.min(600, Math.round(unit * LAYOUT_RATIO_LIST)));
}

export function useLayout() {
  const [listWidth, setListWidth] = useState(() => {
    const raw = localStorage.getItem("curation_list_width");
    if (raw != null && raw !== "") {
      const n = Number(raw);
      if (!Number.isNaN(n)) return n;
    }
    return initialListWidthFromViewport();
  });
  const [isResizingList, setIsResizingList] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingList) {
        const newWidth = Math.max(200, Math.min(600, e.clientX - RAIL_WIDTH_PX));
        setListWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      if (isResizingList) localStorage.setItem("curation_list_width", String(listWidth));
      setIsResizingList(false);
      document.body.style.cursor = "default";
    };
    if (isResizingList) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingList, listWidth]);

  const startResizeList = useCallback(() => setIsResizingList(true), []);

  return {
    listWidth,
    isResizingList,
    startResizeList,
  };
}
