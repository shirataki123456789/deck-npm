'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, UNLIMITED_CARDS } from '@/lib/types';
import ImageModal from './ImageModal';
import { drawBlankCardPlaceholder } from '@/lib/imageGenerator';

interface CardGridProps {
  cards: Card[];
  colsCount?: number;
  onCardClick?: (card: Card) => void;
  onCardRemove?: (card: Card) => void;
  onCardReset?: (card: Card) => void;
  showAddButton?: boolean;
  getCardCount?: (cardId: string) => number;
  canAddCard?: (cardId: string) => boolean;
  // 必要リスト機能
  onUpdateWantedCount?: (card: Card, count: number) => void;
  onUpdateOwnedCount?: (card: Card, owned: number) => void;
  getWantedCount?: (cardId: string) => number;
  getOwnedCount?: (cardId: string) => number;
  // 必要リストフィルターモード
  showWantedBadge?: boolean;
  // カードクリックで直接虫眼鏡を開く
  clickToZoom?: boolean;
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
  onUpdateWantedCount,
  onUpdateOwnedCount,
  getWantedCount,
  getOwnedCount,
  showWantedBadge = false,
  clickToZoom = false,
}: CardGridProps) {
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  
  const handleNavigate = (index: number) => {
    setZoomedIndex(index);
  };
  
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
            onZoom={() => setZoomedIndex(idx)}
            showAddButton={showAddButton}
            count={getCardCount?.(card.card_id)}
            canAdd={canAddCard?.(card.card_id)}
            colsCount={colsCount}
            wantedCount={showWantedBadge && getWantedCount ? getWantedCount(card.card_id) : undefined}
            clickToZoom={clickToZoom}
          />
        ))}
      </div>
      
      {/* 画像拡大モーダル（フリック対応） */}
      <ImageModal
        card={zoomedIndex !== null ? cards[zoomedIndex] : null}
        onClose={() => setZoomedIndex(null)}
        onUpdateWantedCount={onUpdateWantedCount}
        onUpdateOwnedCount={onUpdateOwnedCount}
        wantedCount={zoomedIndex !== null && getWantedCount ? getWantedCount(cards[zoomedIndex].card_id) : 0}
        ownedCount={zoomedIndex !== null && getOwnedCount ? getOwnedCount(cards[zoomedIndex].card_id) : 0}
        cards={cards}
        currentIndex={zoomedIndex ?? undefined}
        onNavigate={handleNavigate}
        getWantedCount={getWantedCount}
        getOwnedCount={getOwnedCount}
      />
    </>
  );
}

// ブランクカードをCanvasで描画するコンポーネント（リサイズ・列数変更対応）
function BlankCardCanvas({ card, colsCount }: { card: Card; colsCount?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastWidthRef = useRef<number>(0);
  
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) return; // まだマウントされていない
    
    // サイズが変わっていない場合はスキップ（パフォーマンス最適化）
    if (containerWidth === lastWidthRef.current) return;
    lastWidthRef.current = containerWidth;
    
    const containerHeight = Math.round(containerWidth * (560 / 400));
    
    const scale = window.devicePixelRatio || 1;
    canvas.width = containerWidth * scale;
    canvas.height = containerHeight * scale;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    
    ctx.scale(scale, scale);
    drawBlankCardPlaceholder(ctx, card, 0, 0, containerWidth, containerHeight);
  }, [card]);
  
  useEffect(() => {
    // 列数が変わった時に強制再描画
    lastWidthRef.current = 0;
    
    // 初回描画（少し遅延させてコンテナサイズが確定してから）
    const timer = setTimeout(drawCanvas, 20);
    
    // ResizeObserverでコンテナサイズの変化を検知
    const container = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        drawCanvas();
      });
      resizeObserver.observe(container);
    }
    
    // フォールバック: windowリサイズ時も再描画
    const handleResize = () => {
      lastWidthRef.current = 0;
      drawCanvas();
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [drawCanvas, colsCount]);
  
  return (
    <div ref={containerRef} className="w-full aspect-[400/560]">
      <canvas ref={canvasRef} className="w-full h-full" />
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
  wantedCount?: number;
  clickToZoom?: boolean;
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
  wantedCount,
  clickToZoom = false,
}: CardItemProps) {
  const isUnlimited = UNLIMITED_CARDS.includes(card.card_id);
  const maxCount = isUnlimited ? 99 : 4;
  const maxCountDisplay = isUnlimited ? '∞' : '4';
  
  const isCompact = colsCount >= 5;
  // 画像URLがない場合はブランクカード風に表示（custom_cards.csvのカードも含む）
  const isBlankCard = !card.image_url;
  
  const handleImageClick = () => {
    // clickToZoomの場合は虫眼鏡を開く
    if (clickToZoom) {
      onZoom?.();
      return;
    }
    
    if (!showAddButton) return;
    
    const currentCount = count || 0;
    
    if (!isUnlimited && currentCount >= maxCount) {
      onReset?.(card);
    } else {
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
        {card.image_url ? (
          <img
            src={card.image_url}
            alt={card.name}
            className="w-full aspect-[400/560] object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <BlankCardCanvas card={card} colsCount={colsCount} />
        )}
        
        {/* 拡大ボタン */}
        {(card.image_url || isBlankCard) && (
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
        
        {/* カード枚数 */}
        {showAddButton && typeof count === 'number' && (
          <div className={`absolute top-0.5 right-0.5 text-white rounded-full font-bold ${
            count > 0 ? (count >= maxCount && !isUnlimited ? 'bg-orange-500' : 'bg-blue-600') : 'bg-gray-400'
          } ${isCompact ? 'text-[10px] px-1' : 'text-sm px-2 py-0.5'}`}>
            {isCompact ? count : `${count}/${maxCountDisplay}`}
          </div>
        )}
      </div>
      
      {/* カード情報（ブランクカードは非表示） */}
      {!isCompact && !isBlankCard && (
        <div className="p-1.5 sm:p-2">
          <div className="text-xs sm:text-sm font-medium truncate flex items-center gap-1" title={card.name}>
            {card.name}
            {wantedCount !== undefined && wantedCount > 0 && (
              <span className="bg-orange-500 text-white text-[10px] px-1 rounded-full">
                必要{wantedCount}
              </span>
            )}
          </div>
          <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 sm:gap-2">
            <span>{card.card_id}</span>
            {card.cost >= 0 && <span>コスト:{card.cost}</span>}
          </div>
          
          <div className="flex gap-0.5 sm:gap-1 mt-1">
            {card.color.map(c => (
              <span key={c} className={`color-badge color-badge-${c} text-[10px] sm:text-xs px-1 sm:px-2`}>
                {c}
              </span>
            ))}
          </div>
          
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
      
      {/* ブランクカード用の±ボタン */}
      {!isCompact && isBlankCard && showAddButton && (
        <div className="p-1.5 sm:p-2">
          <div className="flex gap-1">
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
        </div>
      )}
      
      {/* コンパクト時の±ボタン */}
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
