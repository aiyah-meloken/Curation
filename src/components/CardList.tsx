import { useCardList } from "../hooks/useCards";
import type { Card } from "../hooks/useCards";

interface CardListProps {
  cardViewDate: string | null;
  listWidth: number;
  selectedCardId: string | null;
  onSelectCard: (id: string) => void;
  cardViewTab: "aggregated" | "source";
  onTabChange: (tab: "aggregated" | "source") => void;
}

export function CardList({
  cardViewDate, listWidth, selectedCardId, onSelectCard, cardViewTab, onTabChange,
}: CardListProps) {
  const { data: cardList = [] } = useCardList(cardViewDate, cardViewTab, true);

  return (
    <section className="article-list-pane" style={{ width: listWidth }}>
      <header className="list-header">
        <div style={{ display: 'flex', width: '100%', borderBottom: '1px solid #30363d' }}>
          <button
            style={{
              flex: 1, padding: '8px 0', fontSize: '0.82rem', border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: cardViewTab === "aggregated" ? '#e6edf3' : '#8b949e',
              borderBottom: cardViewTab === "aggregated" ? '2px solid #3b82f6' : '2px solid transparent',
              fontWeight: cardViewTab === "aggregated" ? 600 : 400,
            }}
            onClick={() => onTabChange("aggregated")}
          >
            聚合卡片
          </button>
          <button
            style={{
              flex: 1, padding: '8px 0', fontSize: '0.82rem', border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: cardViewTab === "source" ? '#e6edf3' : '#8b949e',
              borderBottom: cardViewTab === "source" ? '2px solid #3b82f6' : '2px solid transparent',
              fontWeight: cardViewTab === "source" ? 600 : 400,
            }}
            onClick={() => onTabChange("source")}
          >
            原始卡片
          </button>
        </div>
      </header>
      <div className="list-content">
        {cardList.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#8b949e', fontSize: '0.85rem' }}>
            暂无卡片
          </div>
        ) : cardList.map((card: Card) => (
          <div
            key={card.card_id}
            style={{
              padding: '12px 14px', cursor: 'pointer',
              borderBottom: '1px solid #21262d',
              background: selectedCardId === card.card_id ? '#1c2333' : 'transparent',
            }}
            onClick={() => onSelectCard(card.card_id)}
            onMouseEnter={(e) => { if (selectedCardId !== card.card_id) (e.currentTarget as HTMLElement).style.background = '#161b22'; }}
            onMouseLeave={(e) => { if (selectedCardId !== card.card_id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: card.read_at ? 400 : 500, color: card.read_at ? '#6e7681' : '#e6edf3' }}>{card.title}</div>
            {card.article_title && (
              <div style={{ fontSize: '0.75rem', color: '#8b949e', marginTop: 4 }}>{card.article_title}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
