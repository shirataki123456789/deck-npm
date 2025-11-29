'use client';

import { Card, UNLIMITED_CARDS } from '@/lib/types';

interface CardGridProps {
  cards: Card[];
  colsCount?: number;
  onCardClick?: (card: Card) => void;
  onCardRemove?: (card: Card) => void;
  showAddButton?: boolean;
  getCardCount?: (cardId: string) => number;
  canAddCard?: (cardId: string) => boolean;
}

export default function CardGrid({
  cards,
  colsCount = 3,
  onCardClick,
  onCardRemove,
  showAddButton = false,
  getCardCount,
  canAddCard,
}: CardGridProps) {
  // レスポンシブ対応の列数クラス
  // モバイルは2列、その後は指定列数まで段階的に増加
  const gridClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    7: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7',
    8: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8',
  }[colsCount] || 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
  
  return (
    <div className={`grid ${gridClass} gap-2 sm:gap-3`}>
      {cards.map((card, idx) => (
        <CardItem
          key={`${card.card_id}-${idx}`}
          card={card}
          onAdd={onCardClick}
          onRemove={onCardRemove}
          showAddButton={showAddButton}
          count={getCardCount?.(card.card_id)}
          canAdd={canAddCard?.(card.card_id)}
        />
      ))}
    </div>
  );
}

interface CardItemProps {
  card: Card;
  onAdd?: (card: Card) => void;
  onRemove?: (card: Card) => void;
  showAddButton?: boolean;
  count?: number;
  canAdd?: boolean;
}

function CardItem({
  card,
  onAdd,
  onRemove,
  showAddButton = false,
  count,
  canAdd = true,
}: CardItemProps) {
  const isUnlimited = UNLIMITED_CARDS.includes(card.card_id);
  const maxCount = isUnlimited ? '∞' : '4';
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* カード画像 */}
      <div className="relative">
        <img
          src={card.image_url}
          alt={card.name}
          className="w-full aspect-[400/560] object-cover"
          loading="lazy"
        />
        
        {/* パラレルマーク */}
        {card.is_parallel && (
          <div className="absolute top-1 left-1 bg-yellow-400 text-black text-xs px-1.5 py-0.5 rounded font-bold">
            ✨P
          </div>
        )}
        
        {/* カード枚数（デッキモード時） */}
        {showAddButton && typeof count === 'number' && (
          <div className={`absolute top-1 right-1 text-white text-sm px-2 py-0.5 rounded-full font-bold ${
            count > 0 ? 'bg-blue-600' : 'bg-gray-400'
          }`}>
            {count}/{maxCount}
          </div>
        )}
      </div>
      
      {/* カード情報 */}
      <div className="p-2">
        <div className="text-sm font-medium truncate" title={card.name}>
          {card.name}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>{card.card_id}</span>
          {card.cost > 0 && <span>コスト:{card.cost}</span>}
        </div>
        
        {/* 色バッジ */}
        <div className="flex gap-1 mt-1">
          {card.color.map(c => (
            <span key={c} className={`color-badge color-badge-${c}`}>
              {c}
            </span>
          ))}
        </div>
        
        {/* ±ボタン（デッキモード時） */}
        {showAddButton && (
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => onAdd?.(card)}
              disabled={!canAdd}
              className={`flex-1 py-1.5 rounded text-sm font-bold transition-colors ${
                canAdd
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              ＋
            </button>
            <button
              onClick={() => onRemove?.(card)}
              disabled={!count || count <= 0}
              className={`flex-1 py-1.5 rounded text-sm font-bold transition-colors ${
                count && count > 0
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              −
            </button>
          </div>
        )}
      </div>
    </div>
  );
}