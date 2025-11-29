'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Deck, UNLIMITED_CARDS } from '@/lib/types';

interface DeckPreviewProps {
  deck: Deck;
  leaderCard: Card;
  allCards: Card[];  // 親からカードデータを受け取る
  onAddCards: () => void;
  onChangeLeader: () => void;
  onRemoveCard: (cardId: string) => void;
  onAddCard: (card: Card) => void;
}

interface DeckCardInfo {
  card: Card;
  count: number;
}

export default function DeckPreview({
  deck,
  leaderCard,
  allCards,
  onAddCards,
  onChangeLeader,
  onRemoveCard,
  onAddCard,
}: DeckPreviewProps) {
  const [sortedCardIds, setSortedCardIds] = useState<string[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const lastCardIdsRef = useRef<string>('');
  
  // カードIDリストが変わった時だけソート順を取得
  useEffect(() => {
    const cardIds = Object.keys(deck.cards);
    const cardIdsStr = cardIds.sort().join(',');
    
    // カードIDのセットが変わっていない場合はスキップ
    if (cardIdsStr === lastCardIdsRef.current && !initialLoading) {
      return;
    }
    
    if (cardIds.length === 0) {
      setSortedCardIds([]);
      setInitialLoading(false);
      return;
    }
    
    // 初回のみローディング表示、それ以降は表示を維持
    const fetchSort = async () => {
      try {
        const res = await fetch('/api/deck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sort',
            card_ids: cardIds,
          }),
        });
        const data = await res.json();
        
        if (data.card_ids_sorted) {
          setSortedCardIds(data.card_ids_sorted);
          lastCardIdsRef.current = cardIdsStr;
        }
      } catch (error) {
        console.error('Sort error:', error);
        setSortedCardIds(cardIds);
      } finally {
        setInitialLoading(false);
      }
    };
    
    fetchSort();
  }, [Object.keys(deck.cards).sort().join(','), initialLoading]);
  
  // デッキカード情報をメモ化（枚数変更時も再計算されるが、APIコールなし）
  const deckCards = useMemo(() => {
    const result: DeckCardInfo[] = [];
    
    // ソート順が取得できている場合はその順序で
    const idsToUse = sortedCardIds.length > 0 ? sortedCardIds : Object.keys(deck.cards);
    
    idsToUse.forEach(cardId => {
      const count = deck.cards[cardId];
      if (!count || count <= 0) return;
      
      const card = allCards.find(c => c.card_id === cardId);
      if (card) {
        result.push({ card, count });
      }
    });
    
    return result;
  }, [deck.cards, sortedCardIds, allCards]);
  
  const totalCards = Object.values(deck.cards).reduce((sum, count) => sum + count, 0);
  
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">🃏 デッキプレビュー</h2>
      
      {/* リーダー情報 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex gap-4">
          <div className="w-32 flex-shrink-0">
            <img
              src={leaderCard.image_url}
              alt={leaderCard.name}
              className="w-full rounded"
            />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg">{leaderCard.name}</h3>
            <p className="text-gray-600">ID: {leaderCard.card_id}</p>
            <div className="flex gap-1 mt-2">
              {leaderCard.color.map(c => (
                <span key={c} className={`color-badge color-badge-${c}`}>
                  {c}
                </span>
              ))}
            </div>
            <button
              onClick={onChangeLeader}
              className="mt-3 btn btn-secondary btn-sm"
            >
              🔄 リーダーを変更
            </button>
          </div>
        </div>
      </div>
      
      {/* デッキカード一覧 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">デッキ内のカード</h3>
          <span className={`font-medium ${totalCards === 50 ? 'text-green-600' : totalCards > 50 ? 'text-red-600' : 'text-gray-600'}`}>
            {totalCards}/50枚
          </span>
        </div>
        
        {initialLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : deckCards.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            デッキにカードが追加されていません
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
            {deckCards.map(({ card, count }, idx) => {
              const isUnlimited = UNLIMITED_CARDS.includes(card.card_id);
              return (
                <div key={`${card.card_id}-${idx}`} className="relative">
                  <img
                    src={card.image_url}
                    alt={card.name}
                    className="w-full rounded"
                  />
                  {/* 枚数バッジ */}
                  <div className="absolute top-1 right-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                    ×{count}
                  </div>
                  {/* パラレルマーク */}
                  {card.is_parallel && (
                    <div className="absolute top-1 left-1 bg-yellow-400 text-black text-xs px-1 py-0.5 rounded font-bold">
                      ✨P
                    </div>
                  )}
                  {/* 操作ボタン */}
                  <div className="absolute bottom-0 left-0 right-0 flex">
                    <button
                      onClick={() => onAddCard(card)}
                      disabled={!isUnlimited && count >= 4}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs py-1"
                    >
                      ＋
                    </button>
                    <button
                      onClick={() => onRemoveCard(card.card_id)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1"
                    >
                      −
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* アクションボタン */}
      <div className="flex gap-3">
        <button
          onClick={onAddCards}
          className="btn btn-primary flex-1"
        >
          ➕ カードを追加
        </button>
        <button
          onClick={onChangeLeader}
          className="btn btn-secondary"
        >
          🔙 リーダー選択に戻る
        </button>
      </div>
    </div>
  );
}