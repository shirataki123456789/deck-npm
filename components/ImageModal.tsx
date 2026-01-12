'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Card } from '@/lib/types';
import { drawBlankCardPlaceholder } from '@/lib/imageGenerator';

interface ImageModalProps {
  card: Card | null;
  onClose: () => void;
  onUpdateWantedCount?: (card: Card, count: number) => void;
  onUpdateOwnedCount?: (card: Card, owned: number) => void;
  wantedCount?: number;
  ownedCount?: number;
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
    // 初回描画（少し遅延）
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
}: ImageModalProps) {
  // ESCキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (card) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [card, onClose]);
  
  if (!card) return null;
  
  // 画像URLがない場合はブランクカード風に表示
  const isBlankCard = !card.image_url;
  const missing = Math.max(0, wantedCount - ownedCount);
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 z-[100] flex flex-col"
      onClick={onClose}
    >
      {/* 上部の閉じるバー（モバイル用） */}
      <div className="flex-shrink-0 p-3 flex justify-between items-center">
        <span className="text-white text-sm">タップで閉じる</span>
        <button
          onClick={onClose}
          className="bg-white text-black rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold shadow-lg"
        >
          ✕
        </button>
      </div>
      
      {/* メインコンテンツ */}
      <div 
        className="flex-1 flex items-center justify-center p-4 overflow-auto"
        onClick={onClose}
      >
        <div 
          className="relative max-w-lg w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* カード画像またはブランクカード */}
          {isBlankCard ? (
            <BlankCardCanvasLarge card={card} />
          ) : (
            <img
              src={card.image_url}
              alt={card.name}
              className="w-full rounded-lg shadow-2xl"
            />
          )}
          
          {/* カード情報 */}
          <div className="bg-white rounded-lg mt-3 p-3 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{card.name}</h3>
                <p className="text-gray-600 text-sm">{card.card_id}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                {card.color.map(c => (
                  <span key={c} className={`color-badge color-badge-${c}`}>
                    {c}
                  </span>
                ))}
                {card.attribute && (
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">
                    {card.attribute}
                  </span>
                )}
              </div>
            </div>
            
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
              <span>タイプ: {card.type}</span>
              {card.cost >= 0 && <span>コスト: {card.cost}</span>}
              {card.power > 0 && <span>パワー: {card.power}</span>}
              {card.counter > 0 && <span>カウンター: +{card.counter}</span>}
            </div>
            
            {card.features.length > 0 && (
              <div className="mt-2 text-sm">
                <span className="text-gray-500">特徴: </span>
                {card.features.join(' / ')}
              </div>
            )}
            
            {card.text && (
              <div className="mt-2 text-sm bg-gray-50 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                {card.text}
              </div>
            )}
            
            {card.trigger && card.trigger !== '-' && (
              <div className="mt-2 text-sm">
                <span className="text-orange-600 font-medium">【トリガー】</span>
                {card.trigger}
              </div>
            )}
            
            {/* 必要リスト（即時反映） */}
            {onUpdateWantedCount && (
              <div className={`mt-3 p-3 rounded-lg border-2 ${
                wantedCount > 0 && missing > 0 
                  ? 'bg-red-50 border-red-300' 
                  : wantedCount > 0 && missing === 0
                    ? 'bg-green-50 border-green-300'
                    : 'bg-orange-50 border-orange-200'
              }`}>
                <div className="text-sm font-medium text-gray-700 mb-2">📋 必要カードリスト</div>
                
                {/* 必要数 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500 w-12">必要:</span>
                  <button
                    onClick={() => onUpdateWantedCount(card, Math.max(0, wantedCount - 1))}
                    disabled={wantedCount <= 0}
                    className={`w-8 h-8 rounded text-lg font-bold ${
                      wantedCount > 0 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    -
                  </button>
                  <span className={`w-10 text-center text-lg font-bold ${
                    wantedCount > 0 ? 'text-orange-600' : 'text-gray-400'
                  }`}>
                    {wantedCount}
                  </span>
                  <button
                    onClick={() => onUpdateWantedCount(card, wantedCount + 1)}
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
                      onClick={() => onUpdateOwnedCount(card, Math.max(0, ownedCount - 1))}
                      disabled={ownedCount <= 0}
                      className={`w-8 h-8 rounded text-lg font-bold ${
                        ownedCount > 0 
                          ? 'bg-orange-500 text-white hover:bg-orange-600' 
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      -
                    </button>
                    <span className={`w-10 text-center text-lg font-bold ${
                      ownedCount > 0 ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                      {ownedCount}
                    </span>
                    <button
                      onClick={() => onUpdateOwnedCount(card, ownedCount + 1)}
                      className="w-8 h-8 bg-blue-500 text-white rounded text-lg font-bold hover:bg-blue-600"
                    >
                      +
                    </button>
                  </div>
                )}
                
                {/* ステータス表示 */}
                {wantedCount > 0 && (
                  <div className={`mt-2 text-sm text-center font-medium ${
                    missing > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {missing > 0 ? `❗ 不足: ${missing}枚` : '✓ 揃っています'}
                  </div>
                )}
              </div>
            )}
            
            {/* 閉じるボタン（下部） */}
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
