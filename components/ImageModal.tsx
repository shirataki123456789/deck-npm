'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Card } from '@/lib/types';
import { drawBlankCardPlaceholder } from '@/lib/imageGenerator';

interface ImageModalProps {
  card: Card | null;
  onClose: () => void;
  onUpdateWantedCount?: (card: Card, count: number) => void;
  onUpdateOwnedCount?: (card: Card, owned: number) => void;
  wantedCount?: number;
  ownedCount?: number;
  // フリック用
  cards?: Card[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
  getWantedCount?: (cardId: string) => number;
  getOwnedCount?: (cardId: string) => number;
  // ブックマーク用
  isBookmarked?: (cardId: string) => boolean;
  onToggleBookmark?: (cardId: string) => void;
}

// ブランクカードをCanvasで描画（モーダル用大きめサイズ）
function BlankCardCanvasLarge({ card }: { card: Card }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) return;
    
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
    const timer = setTimeout(drawCanvas, 20);
    const container = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        drawCanvas();
      });
      resizeObserver.observe(container);
    }
    
    const handleResize = () => drawCanvas();
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [drawCanvas]);
  
  return (
    <div ref={containerRef} className="w-full aspect-[400/560]">
      <canvas ref={canvasRef} className="w-full h-full rounded-lg shadow-2xl" />
    </div>
  );
}

export default function ImageModal({ 
  card, 
  onClose, 
  onUpdateWantedCount, 
  onUpdateOwnedCount,
  wantedCount = 0,
  ownedCount = 0,
  cards,
  currentIndex,
  onNavigate,
  getWantedCount,
  getOwnedCount,
  isBookmarked,
  onToggleBookmark,
}: ImageModalProps) {
  // スワイプ用
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  
  // 表示するカード（フリック対応時は配列から取得）
  const displayCard = cards && currentIndex !== undefined ? cards[currentIndex] : card;
  const displayWantedCount = displayCard && getWantedCount ? getWantedCount(displayCard.card_id) : wantedCount;
  const displayOwnedCount = displayCard && getOwnedCount ? getOwnedCount(displayCard.card_id) : ownedCount;
  const displayIsBookmarked = displayCard && isBookmarked ? isBookmarked(displayCard.card_id) : false;
  
  const canGoPrev = cards && currentIndex !== undefined && currentIndex > 0;
  const canGoNext = cards && currentIndex !== undefined && currentIndex < cards.length - 1;
  
  // 前後移動
  const goToPrev = useCallback(() => {
    if (canGoPrev && onNavigate && currentIndex !== undefined) {
      setSwipeDirection('right');
      setTimeout(() => {
        onNavigate(currentIndex - 1);
        setSwipeDirection(null);
      }, 150);
    }
  }, [canGoPrev, onNavigate, currentIndex]);
  
  const goToNext = useCallback(() => {
    if (canGoNext && onNavigate && currentIndex !== undefined) {
      setSwipeDirection('left');
      setTimeout(() => {
        onNavigate(currentIndex + 1);
        setSwipeDirection(null);
      }, 150);
    }
  }, [canGoNext, onNavigate, currentIndex]);
  
  // タッチイベント
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
    const minSwipeDistance = 50;
    
    if (isHorizontalSwipe && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        // 左にスワイプ → 次へ
        goToNext();
      } else {
        // 右にスワイプ → 前へ
        goToPrev();
      }
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };
  
  // キーボード操作
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };
    
    if (displayCard) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [displayCard, onClose, goToPrev, goToNext]);
  
  if (!displayCard) return null;
  
  const isBlankCard = !displayCard.image_url;
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 z-[100] flex flex-col"
      onClick={onClose}
    >
      {/* 上部バー */}
      <div className="flex-shrink-0 p-3 flex justify-between items-center">
        <span className="text-white text-sm">
          {cards && currentIndex !== undefined 
            ? `${currentIndex + 1} / ${cards.length}（左右スワイプで移動）` 
            : 'タップで閉じる'}
        </span>
        <button
          onClick={onClose}
          className="bg-white text-black rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold shadow-lg"
        >
          ✕
        </button>
      </div>
      
      {/* メインコンテンツ */}
      <div 
        className="flex-1 flex items-start justify-center p-4 overflow-y-auto relative"
        onClick={onClose}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 左矢印 */}
        {canGoPrev && (
          <button
            onClick={(e) => { e.stopPropagation(); goToPrev(); }}
            className="fixed left-2 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full w-12 h-12 flex items-center justify-center text-2xl shadow-lg"
          >
            ◀
          </button>
        )}
        
        {/* 右矢印 */}
        {canGoNext && (
          <button
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            className="fixed right-2 top-1/2 -translate-y-1/2 z-10 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full w-12 h-12 flex items-center justify-center text-2xl shadow-lg"
          >
            ▶
          </button>
        )}
        
        <div 
          className={`relative max-w-lg w-full transition-transform duration-150 ${
            swipeDirection === 'left' ? '-translate-x-full opacity-0' :
            swipeDirection === 'right' ? 'translate-x-full opacity-0' : ''
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* カード画像 */}
          {isBlankCard ? (
            <BlankCardCanvasLarge card={displayCard} />
          ) : (
            <img
              src={displayCard.image_url}
              alt={displayCard.name}
              className="w-full rounded-lg shadow-2xl"
            />
          )}
          
          {/* カード情報 */}
          <div className="bg-white rounded-lg mt-3 p-3 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{displayCard.name}</h3>
                <p className="text-gray-600 text-sm">{displayCard.card_id}</p>
              </div>
              {/* ブックマークボタン */}
              {onToggleBookmark && displayCard?.card_id && (
                <button
                  onClick={() => onToggleBookmark(displayCard.card_id)}
                  className={`p-2 rounded-lg text-xl transition-colors flex-shrink-0 ${
                    displayIsBookmarked
                      ? 'bg-yellow-100 text-yellow-500'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                  title={displayIsBookmarked ? 'ブックマーク解除' : 'ブックマーク'}
                >
                  {displayIsBookmarked ? '★' : '☆'}
                </button>
              )}
              <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                {(displayCard.color || []).map(c => (
                  <span key={c} className={`color-badge color-badge-${c}`}>
                    {c}
                  </span>
                ))}
                {displayCard.attribute && (
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">
                    {displayCard.attribute}
                  </span>
                )}
              </div>
            </div>
            
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
              <span>タイプ: {displayCard.type}</span>
              {displayCard.cost >= 0 && <span>コスト: {displayCard.cost}</span>}
              {displayCard.power > 0 && <span>パワー: {displayCard.power}</span>}
              {displayCard.counter > 0 && <span>カウンター: +{displayCard.counter}</span>}
            </div>
            
            {(displayCard.features || []).length > 0 && (
              <div className="mt-2 text-sm">
                <span className="text-gray-500">特徴: </span>
                {displayCard.features.join(' / ')}
              </div>
            )}
            
            {displayCard.text && (
              <div className="mt-2 text-sm bg-gray-50 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                {displayCard.text}
              </div>
            )}
            
            {displayCard.trigger && displayCard.trigger !== '-' && (
              <div className="mt-2 text-sm">
                <span className="text-orange-600 font-medium">【トリガー】</span>
                {displayCard.trigger}
              </div>
            )}
            
            {/* 必要リスト */}
            {onUpdateWantedCount && (
              <div className="mt-3 p-3 rounded-lg border-2 bg-orange-50 border-orange-200">
                <div className="text-sm font-medium text-gray-700 mb-2">📋 必要カードリスト</div>
                
                {/* 必要数 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500 w-12">必要:</span>
                  <button
                    onClick={() => onUpdateWantedCount(displayCard, Math.max(0, displayWantedCount - 1))}
                    disabled={displayWantedCount <= 0}
                    className={`w-8 h-8 rounded text-lg font-bold ${
                      displayWantedCount > 0 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    -
                  </button>
                  <span className={`w-10 text-center text-lg font-bold ${
                    displayWantedCount > 0 ? 'text-orange-600' : 'text-gray-400'
                  }`}>
                    {displayWantedCount}
                  </span>
                  <button
                    onClick={() => onUpdateWantedCount(displayCard, displayWantedCount + 1)}
                    className="w-8 h-8 bg-green-500 text-white rounded text-lg font-bold hover:bg-green-600"
                  >
                    +
                  </button>
                </div>
                
                {/* 所持数 */}
                {onUpdateOwnedCount && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-12">所持:</span>
                    <button
                      onClick={() => onUpdateOwnedCount(displayCard, Math.max(0, displayOwnedCount - 1))}
                      disabled={displayOwnedCount <= 0}
                      className={`w-8 h-8 rounded text-lg font-bold ${
                        displayOwnedCount > 0 
                          ? 'bg-orange-500 text-white hover:bg-orange-600' 
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      -
                    </button>
                    <span className={`w-10 text-center text-lg font-bold ${
                      displayOwnedCount > 0 ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                      {displayOwnedCount}
                    </span>
                    <button
                      onClick={() => onUpdateOwnedCount(displayCard, displayOwnedCount + 1)}
                      className="w-8 h-8 bg-blue-500 text-white rounded text-lg font-bold hover:bg-blue-600"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* 閉じるボタン */}
            <button
              onClick={onClose}
              className="w-full mt-3 py-2 bg-gray-800 text-white rounded-lg font-medium"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
