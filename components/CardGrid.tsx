'use client';

import { useState } from 'react';
import { Card, UNLIMITED_CARDS, COLOR_HEX } from '@/lib/types';
import ImageModal from './ImageModal';

// 色の明度を判定
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

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

// ブランクカードのプレースホルダー表示（デッキ画像と同じスタイル）
function BlankCardPlaceholder({ card, isCompact }: { card: Card; isCompact: boolean }) {
  const cardColors = card.color.map(c => COLOR_HEX[c] || '#888888');
  if (cardColors.length === 0) cardColors.push('#888888');
  
  const primaryColor = cardColors[0];
  const isLight = isLightColor(primaryColor);
  const textColor = isLight ? 'text-black' : 'text-white';
  const borderColor = isLight ? 'border-gray-600' : 'border-white';
  
  // グラデーション背景
  const bgStyle = cardColors.length === 1
    ? { backgroundColor: primaryColor }
    : { background: `linear-gradient(135deg, ${cardColors.join(', ')})` };
  
  return (
    <div 
      className={`w-full aspect-[400/560] relative overflow-hidden ${borderColor} border-2`}
      style={bgStyle}
    >
      {/* 上部エリア（イラスト風） */}
      <div className="absolute top-[8%] left-0 right-0 h-[32%] bg-white bg-opacity-15" />
      
      {/* 効果テキストエリア */}
      <div className="absolute top-[42%] left-[8%] right-[4%] h-[28%] bg-black bg-opacity-40 rounded-sm" />
      
      {/* 下部バー */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[25%]"
        style={{ backgroundColor: primaryColor }}
      >
        <div className={`absolute inset-0 ${isLight ? 'bg-black bg-opacity-5' : 'bg-white bg-opacity-10'}`} />
      </div>
      
      {/* コスト（左上） */}
      <div 
        className={`absolute top-[4%] left-[6%] w-[20%] aspect-square rounded-full flex items-center justify-center font-bold border-2 ${borderColor} ${textColor}`}
        style={{ backgroundColor: primaryColor, fontSize: isCompact ? '12px' : '16px' }}
      >
        {card.cost >= 0 ? card.cost : '-'}
      </div>
      
      {/* パワー・属性（右上） */}
      <div className={`absolute top-[3%] right-[4%] text-right ${textColor}`}>
        <div className="font-bold" style={{ fontSize: isCompact ? '10px' : '13px' }}>
          {card.power > 0 ? card.power : '-'}
        </div>
        {card.attribute && (
          <div className="font-bold" style={{ fontSize: isCompact ? '8px' : '11px' }}>
            {card.attribute}
          </div>
        )}
      </div>
      
      {/* カウンター（左側縦書き） */}
      {card.counter > 0 && (
        <div 
          className={`absolute left-[2%] top-[50%] -translate-y-1/2 ${textColor} font-bold`}
          style={{ 
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontSize: isCompact ? '8px' : '10px'
          }}
        >
          +{card.counter}
        </div>
      )}
      
      {/* 効果テキスト */}
      {card.text && (
        <div 
          className="absolute top-[44%] left-[10%] right-[6%] text-white overflow-hidden"
          style={{ 
            fontSize: isCompact ? '6px' : '8px',
            lineHeight: isCompact ? '1.2' : '1.3',
            maxHeight: isCompact ? '20%' : '24%'
          }}
        >
          {card.text.split('\n').slice(0, isCompact ? 2 : 3).map((line, i) => (
            <div key={i} className="truncate">{line}</div>
          ))}
        </div>
      )}
      
      {/* トリガー */}
      {card.trigger && (
        <div 
          className="absolute text-white text-opacity-90 truncate left-[10%] right-[6%]"
          style={{ 
            top: isCompact ? '68%' : '70%',
            fontSize: isCompact ? '5px' : '7px'
          }}
        >
          【トリガー】{card.trigger.slice(0, 12)}
        </div>
      )}
      
      {/* 下部バー内容 */}
      <div className={`absolute bottom-0 left-0 right-0 h-[25%] flex flex-col items-center justify-center ${textColor}`}>
        {/* タイプ */}
        <div style={{ fontSize: isCompact ? '5px' : '7px' }}>
          {card.type}
        </div>
        {/* カード名 */}
        <div className="font-bold truncate max-w-[90%]" style={{ fontSize: isCompact ? '8px' : '11px' }}>
          {card.name}
        </div>
        {/* 特徴 */}
        {card.features.length > 0 && (
          <div className="truncate max-w-[95%]" style={{ fontSize: isCompact ? '4px' : '6px' }}>
            {card.features.join(' / ')}
          </div>
        )}
        {/* カードID */}
        <div className="absolute bottom-[2%] left-[3%]" style={{ fontSize: isCompact ? '4px' : '5px' }}>
          {card.card_id}
        </div>
      </div>
    </div>
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
  
  // ブランクカードかどうか
  const isBlankCard = !card.image_url && card.card_id.startsWith('BLANK-');
  
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
        ) : isBlankCard ? (
          <BlankCardPlaceholder card={card} isCompact={isCompact} />
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
            {card.cost >= 0 && <span>コスト:{card.cost}</span>}
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
