'use client';

import { useState, useEffect } from 'react';
import { Card, Deck, UNLIMITED_CARDS } from '@/lib/types';

interface DeckPreviewProps {
  deck: Deck;
  leaderCard: Card;
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
  onAddCards,
  onChangeLeader,
  onRemoveCard,
  onAddCard,
}: DeckPreviewProps) {
  const [deckCards, setDeckCards] = useState<DeckCardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  
  // デッキのカード情報を取得してソート
  useEffect(() => {
    const fetchDeckCards = async () => {
      setLoading(true);
      try {
        // カードIDリストを作成
        const cardIds = Object.keys(deck.cards);
        if (cardIds.length === 0) {
          setDeckCards([]);
          setLoading(false);
          return;
        }
        
        // カード情報を取得
        const res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            colors: [],
            types: [],
            costs: [],
            counters: [],
            attributes: [],
            blocks: [],
            features: [],
            series_ids: [],
            free_words: '',
            leader_colors: [],
            parallel_mode: 'both',
          }),
        });
        const data = await res.json();
        const allCards: Card[] = data.cards || [];
        
        // デッキ内のカード情報を構築
        const deckCardInfos: DeckCardInfo[] = [];
        cardIds.forEach(cardId => {
          const card = allCards.find(c => c.card_id === cardId);
          if (card) {
            deckCardInfos.push({
              card,
              count: deck.cards[cardId],
            });
          }
        });
        
        // サーバーでソート
        const sortRes = await fetch('/api/deck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sort',
            card_ids: deckCardInfos.map(d => d.card.card_id),
          }),
        });
        const sortData = await sortRes.json();
        
        if (sortData.card_ids_sorted) {
          // ソート順に並べ替え
          const sortedCards: DeckCardInfo[] = [];
          sortData.card_ids_sorted.forEach((id: string) => {
            const info = deckCardInfos.find(d => d.card.card_id === id);
            if (info) {
              sortedCards.push(info);
            }
          });
          setDeckCards(sortedCards);
        } else {
          setDeckCards(deckCardInfos);
        }
      } catch (error) {
        console.error('Fetch deck cards error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDeckCards();
  }, [deck.cards]);
  
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
        
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : deckCards.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            デッキにカードが追加されていません
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {deckCards.map(({ card, count }, idx) => (
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
                    disabled={!UNLIMITED_CARDS.includes(card.card_id) && count >= 4}
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
            ))}
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
