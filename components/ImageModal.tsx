'use client';

import { useEffect } from 'react';
import { Card } from '@/lib/types';

interface ImageModalProps {
  card: Card | null;
  onClose: () => void;
}

export default function ImageModal({ card, onClose }: ImageModalProps) {
  // ESCキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (card) {
      document.addEventListener('keydown', handleKeyDown);
      // スクロールを無効化
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [card, onClose]);
  
  if (!card) return null;
  
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
          {/* カード画像 */}
          <img
            src={card.image_url}
            alt={card.name}
            className="w-full rounded-lg shadow-2xl"
          />
          
          {/* カード情報 */}
          <div className="bg-white rounded-lg mt-3 p-3 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{card.name}</h3>
                <p className="text-gray-600 text-sm">{card.card_id}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {card.color.map(c => (
                  <span key={c} className={`color-badge color-badge-${c}`}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
              <span>タイプ: {card.type}</span>
              {card.cost >= 0 && <span>コスト: {card.cost}</span>}
              {card.power > 0 && <span>パワー: {card.power}</span>}
              {card.counter >= 0 && <span>カウンター: +{card.counter}</span>}
            </div>
            
            {card.features.length > 0 && (
              <div className="mt-2 text-sm">
                <span className="text-gray-500">特徴: </span>
                {card.features.join(' / ')}
              </div>
            )}
            
            {card.text && (
              <div className="mt-2 text-sm bg-gray-50 p-2 rounded max-h-24 overflow-y-auto">
                {card.text}
              </div>
            )}
            
            {card.trigger && card.trigger !== '-' && (
              <div className="mt-2 text-sm">
                <span className="text-orange-600 font-medium">【トリガー】</span>
                {card.trigger}
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