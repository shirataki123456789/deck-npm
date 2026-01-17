'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, Deck, UNLIMITED_CARDS } from '@/lib/types';
import { drawBlankCardPlaceholder } from '@/lib/imageGenerator';
import ImageModal from './ImageModal';
import { BlankLeaderModal } from './LeaderSelect';

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
  donCard?: Card | null;  // ドンカード
  allCards: Card[];  // 親からカードデータを受け取る
  onAddCards: () => void;
  onChangeLeader: () => void;
  onRemoveCard: (cardId: string) => void;
  onAddCard: (card: Card) => void;
  onSelectDon?: () => void;    // ドン選択画面へ
  onRemoveDon?: () => void;    // ドン削除
  onEditBlankLeader?: (card: Card) => void; // ブランクリーダー編集
  // マルチデッキ用ナビゲーション
  onPrevDeck?: () => void;
  onNextDeck?: () => void;
  hasPrevDeck?: boolean;
  hasNextDeck?: boolean;
  currentDeckIndex?: number;
  totalDecks?: number;
  // 必要リスト機能
  onUpdateWantedCount?: (card: Card, count: number) => void;
  onUpdateOwnedCount?: (card: Card, owned: number) => void;
  getWantedCount?: (cardId: string) => number;
  getOwnedCount?: (cardId: string) => number;
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
  donCard,
  allCards,
  onAddCards,
  onChangeLeader,
  onRemoveCard,
  onAddCard,
  onSelectDon,
  onRemoveDon,
  onEditBlankLeader,
  onPrevDeck,
  onNextDeck,
  hasPrevDeck,
  hasNextDeck,
  currentDeckIndex,
  totalDecks,
  onUpdateWantedCount,
  onUpdateOwnedCount,
  getWantedCount,
  getOwnedCount,
}: DeckPreviewProps) {
  const [sortedCardIds, setSortedCardIds] = useState<string[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [colsCount, setColsCount] = useState(5);
  const [showStats, setShowStats] = useState(true);
  const [zoomedCard, setZoomedCard] = useState<Card | null>(null);
  const [showBlankLeaderModal, setShowBlankLeaderModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [filterCost, setFilterCost] = useState<string>('');
  const [filterColor, setFilterColor] = useState<string>('');
  const [filterText, setFilterText] = useState('');
  const [filterCounter, setFilterCounter] = useState<string>('');
  const [filterPower, setFilterPower] = useState<string>('');
  const [filterAttribute, setFilterAttribute] = useState<string>('');
  const [filterFeature, setFilterFeature] = useState<string>('');
  const [filterTrigger, setFilterTrigger] = useState<string>('');
  const [filterBlock, setFilterBlock] = useState<string>('');
  const lastCardIdsRef = useRef<string>('');
  
  // ブランクリーダーかどうか
  const isBlankLeader = !leaderCard.image_url;
  
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
  
  // フィルター適用後のカードリスト
  const filteredDeckCards = useMemo(() => {
    return deckCards.filter(({ card }) => {
      // タイプフィルター
      if (filterType && card.type !== filterType) return false;
      
      // コストフィルター
      if (filterCost !== '') {
        const costNum = parseInt(filterCost, 10);
        if (!isNaN(costNum) && card.cost !== costNum) return false;
      }
      
      // 色フィルター
      if (filterColor && !card.color.includes(filterColor)) return false;
      
      // カウンターフィルター
      if (filterCounter !== '') {
        const counterNum = parseInt(filterCounter, 10);
        if (!isNaN(counterNum) && card.counter !== counterNum) return false;
      }
      
      // パワーフィルター
      if (filterPower !== '') {
        const powerNum = parseInt(filterPower, 10);
        if (!isNaN(powerNum) && card.power !== powerNum) return false;
      }
      
      // 属性フィルター
      if (filterAttribute && card.attribute !== filterAttribute) return false;
      
      // 特徴フィルター
      if (filterFeature && !card.features.includes(filterFeature)) return false;
      
      // トリガーフィルター
      if (filterTrigger === 'あり' && (!card.trigger || card.trigger === '-' || card.trigger.trim() === '')) return false;
      if (filterTrigger === 'なし' && card.trigger && card.trigger !== '-' && card.trigger.trim() !== '') return false;
      
      // ブロックアイコンフィルター
      if (filterBlock && card.block_icon !== filterBlock) return false;
      
      // フリーワードフィルター
      if (filterText.trim()) {
        const searchText = `${card.name} ${card.card_id} ${card.features.join(' ')} ${card.text || ''}`.toLowerCase();
        const words = filterText.toLowerCase().split(/\s+/);
        if (!words.every(w => searchText.includes(w))) return false;
      }
      
      return true;
    });
  }, [deckCards, filterType, filterCost, filterColor, filterCounter, filterPower, filterAttribute, filterFeature, filterTrigger, filterBlock, filterText]);
  
  // フィルターがアクティブかどうか
  const isFilterActive = filterType || filterCost !== '' || filterColor || filterCounter !== '' || filterPower !== '' || filterAttribute || filterFeature || filterTrigger || filterBlock || filterText.trim();
  
  // フィルターで絞り込まれたカード枚数
  const filteredTotalCards = filteredDeckCards.reduce((sum, { count }) => sum + count, 0);
  
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
  
  // デッキ内のカードから選択肢を抽出
  const filterOptions = useMemo(() => {
    const types = new Set<string>();
    const costs = new Set<number>();
    const colors = new Set<string>();
    const counters = new Set<number>();
    const powers = new Set<number>();
    const attributes = new Set<string>();
    const features = new Set<string>();
    const blocks = new Set<string>();
    
    deckCards.forEach(({ card }) => {
      if (card.type) types.add(card.type);
      if (card.cost >= 0) costs.add(card.cost);
      card.color.forEach(c => colors.add(c));
      if (card.counter >= 0) counters.add(card.counter);
      if (card.power >= 0) powers.add(card.power);
      if (card.attribute && card.attribute !== '-') attributes.add(card.attribute);
      card.features.forEach(f => features.add(f));
      if (card.block_icon && card.block_icon !== '-') blocks.add(card.block_icon);
    });
    
    return {
      types: Array.from(types).sort(),
      costs: Array.from(costs).sort((a, b) => a - b),
      colors: ['赤', '緑', '青', '紫', '黒', '黄'].filter(c => colors.has(c)),
      counters: Array.from(counters).sort((a, b) => a - b),
      powers: Array.from(powers).sort((a, b) => a - b),
      attributes: Array.from(attributes).sort(),
      features: Array.from(features).sort(),
      blocks: Array.from(blocks).sort(),
    };
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
      byFeature: sortByCount(stats.byFeature), // 全件表示
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
      
      {/* ヘッダー: タイトルとナビゲーション */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">🃏 デッキプレビュー</h2>
        
        {/* マルチデッキ用ナビゲーション */}
        {(onPrevDeck || onNextDeck) && (
          <div className="flex items-center gap-2">
            <button
              onClick={onPrevDeck}
              disabled={!hasPrevDeck}
              className={`px-3 py-1 rounded text-sm ${
                hasPrevDeck
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              ◀ 前
            </button>
            {currentDeckIndex !== undefined && totalDecks !== undefined && (
              <span className="text-sm text-gray-600">
                {currentDeckIndex + 1}/{totalDecks}
              </span>
            )}
            <button
              onClick={onNextDeck}
              disabled={!hasNextDeck}
              className={`px-3 py-1 rounded text-sm ${
                hasNextDeck
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              次 ▶
            </button>
          </div>
        )}
      </div>
      
      {/* リーダー情報 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex gap-4">
          {/* リーダー画像 */}
          <div className="w-24 sm:w-32 flex-shrink-0">
            {isBlankLeader ? (
              <BlankCardCanvas card={leaderCard} />
            ) : (
              <img
                src={leaderCard.image_url}
                alt={leaderCard.name}
                className="w-full rounded"
              />
            )}
          </div>
          
          {/* ドン画像 */}
          <div className="w-16 sm:w-20 flex-shrink-0">
            {donCard ? (
              <div>
                <img
                  src={donCard.image_url}
                  alt={donCard.name}
                  className="w-full rounded"
                />
                {onRemoveDon && (
                  <button
                    onClick={onRemoveDon}
                    className="mt-1 w-full px-1 py-0.5 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
                  >
                    削除
                  </button>
                )}
              </div>
            ) : onSelectDon ? (
              <button
                onClick={onSelectDon}
                className="w-full aspect-[5/7] border-2 border-dashed border-yellow-400 rounded flex flex-col items-center justify-center text-yellow-600 hover:bg-yellow-50 transition-colors"
              >
                <span className="text-xl">🃏</span>
                <span className="text-xs">ドン</span>
              </button>
            ) : null}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{leaderCard.name}</h3>
              {isBlankLeader && (
                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">📝 BLANK</span>
              )}
            </div>
            <p className="text-gray-600 text-sm">ID: {leaderCard.card_id}</p>
            {isBlankLeader && leaderCard.block_icon && (
              <p className="text-gray-600 text-sm">ライフ: {leaderCard.block_icon} / パワー: {leaderCard.power}</p>
            )}
            <div className="flex gap-1 mt-2">
              {leaderCard.color.map(c => (
                <span key={c} className={`color-badge color-badge-${c}`}>
                  {c}
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={onChangeLeader}
                className="btn btn-secondary btn-sm"
              >
                🔄 リーダーを変更
              </button>
              {isBlankLeader && onEditBlankLeader && (
                <button
                  onClick={() => setShowBlankLeaderModal(true)}
                  className="btn bg-purple-600 hover:bg-purple-700 text-white btn-sm"
                >
                  ✏️ 編集
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* ブランクリーダー編集モーダル */}
      {showBlankLeaderModal && isBlankLeader && onEditBlankLeader && (
        <BlankLeaderModal
          isOpen={showBlankLeaderModal}
          onClose={() => setShowBlankLeaderModal(false)}
          onSubmit={(card) => {
            onEditBlankLeader(card);
            setShowBlankLeaderModal(false);
          }}
          editCard={leaderCard}
          existingIds={[]}
        />
      )}
      
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
            
            {/* 特徴別 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">特徴別（全{sortedStats.byFeature.length}件）</h4>
              <div className="space-y-1 max-h-96 overflow-y-auto">
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
          <div className="flex items-center gap-2">
            <h3 className="font-bold">デッキ内のカード</h3>
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`text-sm px-2 py-1 rounded ${showFilter || isFilterActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              🔍 絞り込み{isFilterActive && ` (${filteredTotalCards}/${totalCards})`}
            </button>
            {isFilterActive && (
              <button
                onClick={() => {
                  setFilterType('');
                  setFilterCost('');
                  setFilterColor('');
                  setFilterCounter('');
                  setFilterPower('');
                  setFilterAttribute('');
                  setFilterFeature('');
                  setFilterTrigger('');
                  setFilterBlock('');
                  setFilterText('');
                }}
                className="text-xs text-red-600 hover:text-red-800"
              >
                ✕ クリア
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-medium ${totalCards === 50 ? 'text-green-600' : totalCards > 50 ? 'text-red-600' : 'text-gray-600'}`}>
              {totalCards}/50枚
            </span>
            <select
              value={colsCount}
              onChange={(e) => setColsCount(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              {Array.from({ length: 15 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}列</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* フィルターパネル */}
        {showFilter && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3">
            {/* 1行目：タイプ、コスト、色、カウンター */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* タイプフィルター */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">タイプ</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">すべて</option>
                  {filterOptions.types.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              
              {/* コストフィルター */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">コスト</label>
                <select
                  value={filterCost}
                  onChange={(e) => setFilterCost(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">すべて</option>
                  {filterOptions.costs.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              
              {/* 色フィルター */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">色</label>
                <select
                  value={filterColor}
                  onChange={(e) => setFilterColor(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">すべて</option>
                  {filterOptions.colors.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              
              {/* カウンターフィルター */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">カウンター</label>
                <select
                  value={filterCounter}
                  onChange={(e) => setFilterCounter(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">すべて</option>
                  {filterOptions.counters.map(c => (
                    <option key={c} value={c}>{c === 0 ? '0' : `+${c}`}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* 2行目：パワー、属性、トリガー、特徴 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* パワーフィルター */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">パワー</label>
                <select
                  value={filterPower}
                  onChange={(e) => setFilterPower(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">すべて</option>
                  {filterOptions.powers.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              
              {/* 属性フィルター */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">属性</label>
                <select
                  value={filterAttribute}
                  onChange={(e) => setFilterAttribute(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">すべて</option>
                  {filterOptions.attributes.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              
              {/* トリガーフィルター */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">トリガー</label>
                <select
                  value={filterTrigger}
                  onChange={(e) => setFilterTrigger(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">すべて</option>
                  <option value="あり">あり</option>
                  <option value="なし">なし</option>
                </select>
              </div>
              
              {/* ブロックアイコンフィルター */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">ブロック</label>
                <select
                  value={filterBlock}
                  onChange={(e) => setFilterBlock(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">すべて</option>
                  {filterOptions.blocks.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* 3行目：特徴、フリーワード */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* 特徴フィルター */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">特徴</label>
                <select
                  value={filterFeature}
                  onChange={(e) => setFilterFeature(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">すべて</option>
                  {filterOptions.features.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              
              {/* フリーワード */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">フリーワード（スペース区切りでAND検索）</label>
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="カード名・効果テキスト・特徴など"
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>
        )}
        
        {initialLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filteredDeckCards.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {isFilterActive ? '条件に一致するカードがありません' : 'デッキにカードが追加されていません'}
          </p>
        ) : (
          <div 
            className="grid gap-1 sm:gap-2"
            style={{ gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))` }}
          >
            {filteredDeckCards.map(({ card, count }, idx) => {
              const isUnlimited = UNLIMITED_CARDS.includes(card.card_id);
              const isCompact = colsCount >= 5;
              const isBlankCard = !card.image_url;
              const canAdd = isUnlimited || count < 4;
              return (
                <div key={`${card.card_id}-${idx}`} className="relative">
                  {/* カード画像またはプレースホルダー（クリックで+1枚追加） */}
                  {card.image_url ? (
                    <img
                      src={card.image_url}
                      alt={card.name}
                      className={`w-full rounded transition-opacity ${canAdd ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
                      loading="lazy"
                      onClick={() => canAdd && onAddCard(card)}
                    />
                  ) : (
                    <BlankCardCanvas
                      card={card}
                      onClick={() => canAdd && onAddCard(card)}
                    />
                  )}
                  {/* 虫眼鏡ボタン（モーダル表示） */}
                  <button
                    onClick={() => setZoomedCard(card)}
                    className={`absolute bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-opacity ${
                      isCompact 
                        ? 'bottom-6 left-0.5 w-5 h-5 text-[10px]' 
                        : 'bottom-8 left-1 w-7 h-7 text-sm'
                    } flex items-center justify-center`}
                  >
                    🔍
                  </button>
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
                      disabled={!canAdd}
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
      
      {/* 画像拡大モーダル */}
      <ImageModal
        card={zoomedCard}
        onClose={() => setZoomedCard(null)}
        onUpdateWantedCount={onUpdateWantedCount}
        onUpdateOwnedCount={onUpdateOwnedCount}
        wantedCount={zoomedCard && getWantedCount ? getWantedCount(zoomedCard.card_id) : 0}
        ownedCount={zoomedCard && getOwnedCount ? getOwnedCount(zoomedCard.card_id) : 0}
      />
    </div>
  );
}
