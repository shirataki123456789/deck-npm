'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, Deck, UNLIMITED_CARDS } from '@/lib/types';
import { drawBlankCardPlaceholder } from '@/lib/imageGenerator';

// ブランクカードをCanvasで描画するコンポーネント
function BlankCardCanvas({ card, onClick }: { card: Card; onClick?: () => void }) {
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
    if (containerWidth === 0) return;
    
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
    lastWidthRef.current = 0;
    const timer = setTimeout(drawCanvas, 20);
    
    const container = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => drawCanvas());
      resizeObserver.observe(container);
    }
    
    window.addEventListener('resize', () => { lastWidthRef.current = 0; drawCanvas(); });
    
    return () => {
      clearTimeout(timer);
      resizeObserver?.disconnect();
    };
  }, [drawCanvas]);
  
  return (
    <div 
      ref={containerRef} 
      className="w-full aspect-[400/560] cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onClick}
    >
      <canvas ref={canvasRef} className="w-full h-full rounded" />
    </div>
  );
}

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

// 統計情報の型
interface DeckStats {
  byType: Record<string, number>;
  byCounter: Record<string, number>;
  byFeature: Record<string, number>;
  byCost: Record<number, number>;
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
  const [colsCount, setColsCount] = useState(5);
  const [showStats, setShowStats] = useState(true);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
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
  
  // 統計情報を計算
  const stats = useMemo((): DeckStats => {
    const byType: Record<string, number> = {};
    const byCounter: Record<string, number> = {};
    const byFeature: Record<string, number> = {};
    const byCost: Record<number, number> = {};
    
    deckCards.forEach(({ card, count }) => {
      // 種類別
      const type = card.type || '不明';
      byType[type] = (byType[type] || 0) + count;
      
      // カウンター別
      const counter = card.counter >= 0 ? `${card.counter}` : 'なし';
      byCounter[counter] = (byCounter[counter] || 0) + count;
      
      // コスト別
      if (card.cost >= 0) {
        byCost[card.cost] = (byCost[card.cost] || 0) + count;
      }
      
      // 特徴別（複数の特徴を持つカードは各特徴にカウント）
      if (card.features && card.features.length > 0) {
        card.features.forEach(f => {
          byFeature[f] = (byFeature[f] || 0) + count;
        });
      }
    });
    
    return { byType, byCounter, byFeature, byCost };
  }, [deckCards]);
  
  const totalCards = Object.values(deck.cards).reduce((sum, count) => sum + count, 0);
  
  // 統計をソートして表示用に変換
  const sortedStats = useMemo(() => {
    const sortByCount = (obj: Record<string, number>) => 
      Object.entries(obj).sort((a, b) => b[1] - a[1]);
    
    const sortByCost = (obj: Record<number, number>) =>
      Object.entries(obj).sort((a, b) => Number(a[0]) - Number(b[0]));
    
    return {
      byType: sortByCount(stats.byType),
      byCounter: Object.entries(stats.byCounter).sort((a, b) => {
        // 「なし」を最後に
        if (a[0] === 'なし') return 1;
        if (b[0] === 'なし') return -1;
        return Number(b[0]) - Number(a[0]);
      }),
      byFeature: sortByCount(stats.byFeature).slice(0, 10), // 上位10件
      byCost: sortByCost(stats.byCost),
    };
  }, [stats]);
  
  return (
    <div className="pb-20 lg:pb-4">
      {/* 固定ヘッダー（モバイル用） */}
      <div className="sticky top-0 bg-gray-100 z-10 -mx-4 px-4 py-3 mb-4 shadow-sm lg:hidden">
        <div className="flex items-center justify-between">
          <button
            onClick={onAddCards}
            className="btn btn-primary btn-sm"
          >
            ← カード追加に戻る
          </button>
          <span className={`font-bold ${totalCards === 50 ? 'text-green-600' : totalCards > 50 ? 'text-red-600' : 'text-gray-600'}`}>
            {totalCards}/50枚
          </span>
        </div>
      </div>
      
      <h2 className="text-xl font-bold mb-4">🃏 デッキプレビュー</h2>
      
      {/* リーダー情報 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex gap-4">
          <div className="w-24 sm:w-32 flex-shrink-0">
            <img
              src={leaderCard.image_url}
              alt={leaderCard.name}
              className="w-full rounded"
            />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg">{leaderCard.name}</h3>
            <p className="text-gray-600 text-sm">ID: {leaderCard.card_id}</p>
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
      
      {/* 統計情報 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">📊 デッキ統計</h3>
          <button
            onClick={() => setShowStats(!showStats)}
            className="text-sm text-blue-600"
          >
            {showStats ? '閉じる' : '開く'}
          </button>
        </div>
        
        {showStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 種類別 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">種類別</h4>
              <div className="space-y-1">
                {sortedStats.byType.map(([type, count]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span>{type}</span>
                    <span className="font-medium">{count}枚</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* カウンター別 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">カウンター別</h4>
              <div className="space-y-1">
                {sortedStats.byCounter.map(([counter, count]) => (
                  <div key={counter} className="flex justify-between text-sm">
                    <span>{counter === 'なし' ? 'なし' : `+${counter}`}</span>
                    <span className="font-medium">{count}枚</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* コスト別 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">コスト別</h4>
              <div className="space-y-1">
                {sortedStats.byCost.map(([cost, count]) => (
                  <div key={cost} className="flex justify-between text-sm">
                    <span>コスト{cost}</span>
                    <span className="font-medium">{count}枚</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 特徴別（上位10件） */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">特徴別（上位10）</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {sortedStats.byFeature.map(([feature, count]) => (
                  <div key={feature} className="flex justify-between text-sm">
                    <span className="truncate mr-2">{feature}</span>
                    <span className="font-medium flex-shrink-0">{count}枚</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* デッキカード一覧 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-bold">デッキ内のカード</h3>
          <div className="flex items-center gap-3">
            <span className={`font-medium ${totalCards === 50 ? 'text-green-600' : totalCards > 50 ? 'text-red-600' : 'text-gray-600'}`}>
              {totalCards}/50枚
            </span>
            <select
              value={colsCount}
              onChange={(e) => setColsCount(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value={3}>3列</option>
              <option value={4}>4列</option>
              <option value={5}>5列</option>
              <option value={6}>6列</option>
              <option value={7}>7列</option>
              <option value={8}>8列</option>
              <option value={10}>10列</option>
            </select>
          </div>
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
          <div 
            className="grid gap-1 sm:gap-2"
            style={{ gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))` }}
          >
            {deckCards.map(({ card, count }, idx) => {
              const isUnlimited = UNLIMITED_CARDS.includes(card.card_id);
              const isCompact = colsCount >= 5;
              const isBlankCard = !card.image_url;
              return (
                <div key={`${card.card_id}-${idx}`} className="relative">
                  {/* カード画像またはプレースホルダー（クリックで詳細表示） */}
                  {card.image_url ? (
                    <img
                      src={card.image_url}
                      alt={card.name}
                      className="w-full rounded cursor-pointer hover:opacity-80 transition-opacity"
                      loading="lazy"
                      onClick={() => setSelectedCard(card)}
                    />
                  ) : (
                    <BlankCardCanvas
                      card={card}
                      onClick={() => setSelectedCard(card)}
                    />
                  )}
                  {/* 枚数バッジ */}
                  <div className={`absolute top-0.5 right-0.5 bg-blue-600 text-white rounded-full font-bold ${
                    isCompact ? 'text-[10px] px-1' : 'text-xs px-1.5 py-0.5'
                  }`}>
                    ×{count}
                  </div>
                  {/* ブランクカードマーク */}
                  {isBlankCard && (
                    <div className={`absolute bg-purple-600 text-white font-bold rounded ${
                      isCompact ? 'top-0.5 left-0.5 text-[8px] px-0.5' : 'top-1 left-1 text-xs px-1 py-0.5'
                    }`}>
                      {isCompact ? 'B' : '📝仮'}
                    </div>
                  )}
                  {/* パラレルマーク */}
                  {card.is_parallel && !isBlankCard && (
                    <div className={`absolute top-0.5 left-0.5 bg-yellow-400 text-black font-bold rounded ${
                      isCompact ? 'text-[8px] px-0.5' : 'text-xs px-1 py-0.5'
                    }`}>
                      {isCompact ? 'P' : '✨P'}
                    </div>
                  )}
                  {/* 操作ボタン */}
                  <div className="absolute bottom-0 left-0 right-0 flex">
                    <button
                      onClick={() => onAddCard(card)}
                      disabled={!isUnlimited && count >= 4}
                      className={`flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold ${
                        isCompact ? 'text-[10px] py-0.5' : 'text-xs py-1'
                      }`}
                    >
                      ＋
                    </button>
                    <button
                      onClick={() => onRemoveCard(card.card_id)}
                      className={`flex-1 bg-red-600 hover:bg-red-700 text-white font-bold ${
                        isCompact ? 'text-[10px] py-0.5' : 'text-xs py-1'
                      }`}
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
      
      {/* アクションボタン（PC用） */}
      <div className="hidden lg:flex gap-3">
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
      
      {/* 固定フッター（モバイル用） */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 bg-white border-t shadow-lg p-3 z-10">
        <div className="flex gap-2">
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
            🔙
          </button>
        </div>
      </div>
      
      {/* カード詳細モーダル */}
      {selectedCard && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedCard(null)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              {/* ヘッダー */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg">{selectedCard.name}</h3>
                  <p className="text-sm text-gray-500">{selectedCard.card_id}</p>
                </div>
                <button
                  onClick={() => setSelectedCard(null)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-500"
                >
                  ✕
                </button>
              </div>
              
              {/* カード画像（通常カードのみ） */}
              {selectedCard.image_url && (
                <div className="mb-4">
                  <img
                    src={selectedCard.image_url}
                    alt={selectedCard.name}
                    className="w-full max-w-xs mx-auto rounded"
                  />
                </div>
              )}
              
              {/* ブランクカード画像（Canvasで描画） */}
              {!selectedCard.image_url && (
                <div className="mb-4">
                  <BlankCardCanvas card={selectedCard} />
                </div>
              )}
              
              {/* 基本情報 */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-xs text-gray-500">タイプ</span>
                  <p className="font-medium">{selectedCard.type || '-'}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-xs text-gray-500">コスト</span>
                  <p className="font-medium">{selectedCard.cost >= 0 ? selectedCard.cost : '-'}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-xs text-gray-500">パワー</span>
                  <p className="font-medium">{selectedCard.power > 0 ? selectedCard.power : '-'}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-xs text-gray-500">カウンター</span>
                  <p className="font-medium">{selectedCard.counter > 0 ? `+${selectedCard.counter}` : '-'}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-xs text-gray-500">属性</span>
                  <p className="font-medium">{selectedCard.attribute || '-'}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-xs text-gray-500">色</span>
                  <div className="flex gap-1 mt-0.5">
                    {selectedCard.color.length > 0 ? selectedCard.color.map(c => (
                      <span key={c} className={`color-badge color-badge-${c} text-xs`}>{c}</span>
                    )) : <span className="text-gray-400">-</span>}
                  </div>
                </div>
              </div>
              
              {/* 特徴 */}
              {selectedCard.features && selectedCard.features.length > 0 && (
                <div className="mb-4">
                  <span className="text-xs text-gray-500">特徴</span>
                  <p className="text-sm">{selectedCard.features.join(' / ')}</p>
                </div>
              )}
              
              {/* 効果テキスト */}
              {selectedCard.text && (
                <div className="mb-4">
                  <span className="text-xs text-gray-500">効果</span>
                  <div className="mt-1 p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">
                    {selectedCard.text}
                  </div>
                </div>
              )}
              
              {/* トリガー */}
              {selectedCard.trigger && (
                <div className="mb-4">
                  <span className="text-xs text-gray-500">トリガー</span>
                  <div className="mt-1 p-3 bg-yellow-50 rounded text-sm whitespace-pre-wrap">
                    {selectedCard.trigger}
                  </div>
                </div>
              )}
              
              {/* 閉じるボタン */}
              <button
                onClick={() => setSelectedCard(null)}
                className="w-full btn btn-secondary mt-2"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ブランクカードをCanvasで描画するコンポーネント
function BlankCardCanvas({ card }: { card: Card }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // カードサイズ（モーダル内での表示用）
    const width = 280;
    const height = 392; // 280 * (560/400)
    
    canvas.width = width;
    canvas.height = height;
    
    // 背景をクリア
    ctx.clearRect(0, 0, width, height);
    
    // ブランクカードを描画
    drawBlankCardPlaceholder(ctx, card, 0, 0, width, height);
  }, [card]);
  
  return (
    <div className="flex flex-col items-center">
      <canvas 
        ref={canvasRef} 
        className="rounded shadow-lg max-w-full"
        style={{ maxWidth: '280px' }}
      />
      <p className="text-xs text-purple-600 mt-2">📝 ブランクカード（仮登録）</p>
    </div>
  );
}
