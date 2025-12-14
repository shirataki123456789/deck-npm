'use client';

import { useState } from 'react';
import { Card, UNLIMITED_CARDS } from '@/lib/types';
import ImageModal from './ImageModal';

interface CardGridProps {
  cards: Card[];
  colsCount?: number;
  onCardClick?: (card: Card) => void;
  onCardRemove?: (card: Card) => void;
  onCardReset?: (card: Card) => void; // 枚数を0にリセット
  showAddButton?: boolean;
  getCardCount?: (cardId: string) => number;
  canAddCard?: (cardId: string) => boolean;
}

export default function CardGrid({
  cards,
  colsCount = 4,
  onCardClick,
  onCardRemove,
  onCardReset,
  showAddButton = false,
  getCardCount,
  canAddCard,
}: CardGridProps) {
  const [zoomedCard, setZoomedCard] = useState<Card | null>(null);
  
  return (
    <>
      <div 
        className="grid gap-1 sm:gap-2"
        style={{ 
          gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))` 
        }}
      >
        {cards.map((card, idx) => (
          <CardItem
            key={`${card.card_id}-${idx}`}
            card={card}
            onAdd={onCardClick}
            onRemove={onCardRemove}
            onReset={onCardReset}
            onZoom={() => setZoomedCard(card)}
            showAddButton={showAddButton}
            count={getCardCount?.(card.card_id)}
            canAdd={canAddCard?.(card.card_id)}
            colsCount={colsCount}
          />
        ))}
      </div>
      
      {/* 画像拡大モーダル */}
      <ImageModal card={zoomedCard} onClose={() => setZoomedCard(null)} />
    </>
  );
}

interface CardItemProps {
  card: Card;
  onAdd?: (card: Card) => void;
  onRemove?: (card: Card) => void;
  onReset?: (card: Card) => void;
  onZoom?: () => void;
  showAddButton?: boolean;
  count?: number;
  canAdd?: boolean;
  colsCount: number;
}

function CardItem({
  card,
  onAdd,
  onRemove,
  onReset,
  onZoom,
  showAddButton = false,
  count,
  canAdd = true,
  colsCount,
}: CardItemProps) {
  const isUnlimited = UNLIMITED_CARDS.includes(card.card_id);
  const maxCount = isUnlimited ? 99 : 4; // 無制限カードは99として扱う
  const maxCountDisplay = isUnlimited ? '∞' : '4';
  
  // 列数が多い場合はコンパクト表示
  const isCompact = colsCount >= 5;
  
  // 画像クリック時の処理
  const handleImageClick = () => {
    if (!showAddButton) return;
    
    const currentCount = count || 0;
    
    // 最大枚数に達している場合は0にリセット
    if (!isUnlimited && currentCount >= maxCount) {
      onReset?.(card);
    } else {
      // それ以外は追加
      onAdd?.(card);
    }
  };
  
  return (
    <div className="bg-white rounded shadow overflow-hidden">
      {/* カード画像 */}
      <div 
        className="relative cursor-pointer active:opacity-80"
        onClick={handleImageClick}
      >
        {/* カード画像またはプレースホルダー */}
        {card.image_url ? (
          <img
            src={card.image_url}
            alt={card.name}
            className="w-full aspect-[400/560] object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full aspect-[400/560] bg-gradient-to-br from-gray-300 to-gray-400 flex flex-col items-center justify-center text-gray-600">
            <span className={isCompact ? 'text-2xl' : 'text-4xl'}>?</span>
            {!isCompact && (
              <>
                <span className="text-xs mt-1 px-2 text-center truncate w-full">{card.name}</span>
                <span className="text-[10px] mt-0.5">{card.card_id}</span>
              </>
            )}
          </div>
        )}
        
        {/* ブランクカードマーク */}
        {!card.image_url && (
          <div className={`absolute bg-purple-600 text-white font-bold rounded ${
            isCompact ? 'top-0.5 left-0.5 text-[8px] px-0.5' : 'top-1 left-1 text-xs px-1 py-0.5'
          }`}>
            {isCompact ? 'B' : '📝仮'}
          </div>
        )}
        
        {/* 拡大ボタン（画像がある場合のみ） */}
        {card.image_url && (
          <button
            onClick={(e) => { e.stopPropagation(); onZoom?.(); }}
            className={`absolute bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-opacity ${
              isCompact 
                ? 'bottom-0.5 left-0.5 w-5 h-5 text-[10px]' 
                : 'bottom-1 left-1 w-7 h-7 text-sm'
            } flex items-center justify-center`}
          >
            🔍
          </button>
        )}
        
        {/* パラレルマーク */}
        {card.is_parallel && card.image_url && (
          <div className={`absolute top-0.5 left-0.5 bg-yellow-400 text-black font-bold rounded ${
            isCompact ? 'text-[8px] px-0.5' : 'text-xs px-1 py-0.5'
          }`}>
            {isCompact ? 'P' : '✨P'}
          </div>
        )}
        
        {/* カード枚数（デッキモード時） */}
        {showAddButton && typeof count === 'number' && (
          <div className={`absolute top-0.5 right-0.5 text-white rounded-full font-bold ${
            count > 0 ? (count >= maxCount && !isUnlimited ? 'bg-orange-500' : 'bg-blue-600') : 'bg-gray-400'
          } ${isCompact ? 'text-[10px] px-1' : 'text-sm px-2 py-0.5'}`}>
            {isCompact ? count : `${count}/${maxCountDisplay}`}
          </div>
        )}
      </div>
      
      {/* カード情報（コンパクト時は非表示） */}
      {!isCompact && (
        <div className="p-1.5 sm:p-2">
          <div className="text-xs sm:text-sm font-medium truncate" title={card.name}>
            {card.name}
          </div>
          <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 sm:gap-2">
            <span>{card.card_id}</span>
            {card.cost > 0 && <span>コスト:{card.cost}</span>}
          </div>
          
          {/* 色バッジ */}
          <div className="flex gap-0.5 sm:gap-1 mt-1">
            {card.color.map(c => (
              <span key={c} className={`color-badge color-badge-${c} text-[10px] sm:text-xs px-1 sm:px-2`}>
                {c}
              </span>
            ))}
          </div>
          
          {/* ±ボタン（デッキモード時） */}
          {showAddButton && (
            <div className="flex gap-1 mt-1.5 sm:mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); onAdd?.(card); }}
                disabled={!canAdd}
                className={`flex-1 py-1 sm:py-1.5 rounded text-xs sm:text-sm font-bold transition-colors ${
                  canAdd
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                ＋
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove?.(card); }}
                disabled={!count || count <= 0}
                className={`flex-1 py-1 sm:py-1.5 rounded text-xs sm:text-sm font-bold transition-colors ${
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
      )}
      
      {/* コンパクト時の±ボタン（画像下に小さく） */}
      {isCompact && showAddButton && (
        <div className="flex">
          <button
            onClick={(e) => { e.stopPropagation(); onAdd?.(card); }}
            disabled={!canAdd}
            className={`flex-1 py-0.5 text-[10px] font-bold ${
              canAdd
                ? 'bg-green-600 text-white'
                : 'bg-gray-300 text-gray-500'
            }`}
          >
            ＋
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove?.(card); }}
            disabled={!count || count <= 0}
            className={`flex-1 py-0.5 text-[10px] font-bold ${
              count && count > 0
                ? 'bg-red-600 text-white'
                : 'bg-gray-300 text-gray-500'
            }`}
          >
            −
          </button>
        </div>
      )}
    </div>
  );
}
