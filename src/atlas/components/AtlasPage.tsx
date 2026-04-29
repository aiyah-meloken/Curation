// Atlas — top-level page composition.
//
// Migration contract: AtlasPage takes only its data + callbacks via props.
// The preview wrapper supplies mock data + a fake article-content lookup;
// the production wrapper would supply the real ones.

import { useEffect, useMemo, useRef, useState } from "react";
import { computeLayout, ATLAS_CANVAS } from "../lib/layout";
import { placeFloatingCard } from "../lib/geometry";
import { validateAtlasInput } from "../lib/validate";
import { isCardRead as deriveRead, useAtlasStore } from "../state/store";
import type { ArticleContent, AtlasCard, AtlasDSL } from "../types";
import { AtlasCanvas } from "./AtlasCanvas";
import { AtlasCartouche } from "./AtlasCartouche";
import { AtlasCompass } from "./AtlasCompass";
import { AtlasFloatingCard } from "./AtlasFloatingCard";
import { AtlasLegend } from "./AtlasLegend";
import { AtlasPreviewDrawer } from "./AtlasPreviewDrawer";

export type AtlasPageProps = {
  dsl: AtlasDSL;
  cards: AtlasCard[];
  /** Called when a settlement should be marked read (popover button or drawer close). */
  onMarkRead: (card_id: string) => void;
  /** Article content fetcher (preview: mock map; production: useArticleContent hook). */
  useArticleContent: (article_id: string | null) => {
    data: ArticleContent | null;
    isLoading: boolean;
  };
};

export function AtlasPage({
  dsl,
  cards,
  onMarkRead,
  useArticleContent,
}: AtlasPageProps) {
  // Validate (throws on structural errors so failures are loud).
  validateAtlasInput(dsl, cards);

  const layout = useMemo(
    () => computeLayout(dsl, cards, ATLAS_CANVAS),
    [dsl, cards],
  );

  const hovered = useAtlasStore((s) => s.hovered_card_id);
  const setHovered = useAtlasStore((s) => s.setHoveredCard);
  const drawerCardId = useAtlasStore((s) => s.drawer_card_id);
  const openDrawer = useAtlasStore((s) => s.openDrawer);
  const closeDrawer = useAtlasStore((s) => s.closeDrawer);
  const markCardRead = useAtlasStore((s) => s.markCardRead);
  const sessionRead = useAtlasStore((s) => s.session_read_card_ids);

  // Track stage element to compute popover absolute positions (the SVG canvas
  // uses a viewBox so we need the rendered scale to map back to screen pixels).
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!stageRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setStageSize({ width: r.width, height: r.height });
    });
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  // Compute the popover anchor position in stage pixel coords, given a card.
  // SVG viewBox preserveAspectRatio="xMidYMid meet" means we project from
  // stage size + canvas size, finding the on-screen point of (cardX, cardY).
  const popoverPosition = useMemo(() => {
    if (!hovered || !stageSize.width || !stageSize.height) return null;
    let foundX = 0;
    let foundY = 0;
    let foundR = 0;
    let found = false;
    for (const c of layout.continents) {
      for (const s of c.cards) {
        if (s.card_id === hovered) {
          foundX = s.x;
          foundY = s.y;
          foundR = s.radius;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) return null;

    // Project (cardX, cardY) from canvas viewBox into stage pixel coords.
    const cw = ATLAS_CANVAS.width;
    const ch = ATLAS_CANVAS.height;
    const scale = Math.min(stageSize.width / cw, stageSize.height / ch);
    const renderedW = cw * scale;
    const renderedH = ch * scale;
    const offsetX = (stageSize.width - renderedW) / 2;
    const offsetY = (stageSize.height - renderedH) / 2;
    const screenX = offsetX + foundX * scale + foundR * scale; // anchor right edge of dot
    const screenY = offsetY + foundY * scale;

    // 280px wide popover, ~180px tall typical; placeFloatingCard handles edges.
    return placeFloatingCard(screenX, screenY, 280, 200, stageSize, 14);
  }, [hovered, layout, stageSize]);

  const hoveredCard = hovered ? cards.find((c) => c.card_id === hovered) : null;
  const drawerCard = drawerCardId
    ? cards.find((c) => c.card_id === drawerCardId)
    : null;
  const drawerArticle = useArticleContent(drawerCard?.article_id ?? null);

  // Wrap close-drawer to also propagate mark-read to caller.
  const handleCloseDrawer = () => {
    if (drawerCardId) onMarkRead(drawerCardId);
    closeDrawer();
  };
  const handleMarkRead = (card_id: string) => {
    markCardRead(card_id);
    onMarkRead(card_id);
    setHovered(null);
  };

  const isCardReadFn = (card_id: string): boolean => {
    const c = cards.find((x) => x.card_id === card_id);
    if (!c) return false;
    return deriveRead(c, sessionRead);
  };

  return (
    <div ref={stageRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <AtlasCanvas
        dsl={dsl}
        cards={cards}
        layout={layout}
        isCardRead={isCardReadFn}
        onSettlementHover={(id) => setHovered(id)}
        onSettlementClick={(id) => openDrawer(id)}
      />

      <AtlasCartouche date={formatDate(cards[0]?.article_date ?? null)} />
      <AtlasLegend />
      <AtlasCompass />

      {hoveredCard && popoverPosition && (
        <AtlasFloatingCard
          card={hoveredCard}
          dsl={dsl}
          position={popoverPosition}
          onMarkRead={() => handleMarkRead(hoveredCard.card_id!)}
          onMouseEnter={() => setHovered(hoveredCard.card_id!)}
          onMouseLeave={() => setHovered(null)}
        />
      )}

      <AtlasPreviewDrawer
        open={drawerCardId != null}
        card={drawerCard ?? null}
        articleContent={drawerArticle.data}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  // "2026-04-26" -> "2026 · IV · 26"
  const months = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
  const [y, m, dd] = d.split("-");
  const mi = parseInt(m, 10) - 1;
  return `${y} · ${months[mi] ?? m} · ${dd}`;
}
