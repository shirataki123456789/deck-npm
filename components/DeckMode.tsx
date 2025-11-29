'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Deck, FilterOptions, DEFAULT_FILTER_OPTIONS, UNLIMITED_CARDS, COLOR_ORDER } from '@/lib/types';
import FilterPanel from './FilterPanel';
import CardGrid from './CardGrid';
import DeckSidebar from './DeckSidebar';
import DeckPreview from './DeckPreview';
import LeaderSelect from './LeaderSelect';

type DeckView = 'leader' | 'preview' | 'add_cards';

interface FilterMeta {
  colors: string[];
  types: string[];
  costs: number[];
  counters: number[];
  attributes: string[];
  blocks: string[];
  features: string[];
  seriesIds: string[];
}

export default function DeckMode() {
  // デッキ状態
  const [deck, setDeck] = useState<Deck>({
    name: '',
    leader: '',
    cards: {},
  });
  const [leaderCard, setLeaderCard] = useState<Card | null>(null);
  
  // 画面状態
  const [view, setView] = useState<DeckView>('leader');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // カード検索関連
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [filter, setFilter] = useState<FilterOptions>({
    ...DEFAULT_FILTER_OPTIONS,
    types: ['CHARACTER', 'EVENT', 'STAGE'], // リーダー以外
  });
  const [filterMeta, setFilterMeta] = useState<FilterMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [colsCount, setColsCount] = useState(3);
  
  // フィルタメタデータを取得
  useEffect(() => {
    fetch('/api/cards')
      .then(res => res.json())
      .then(data => {
        setFilterMeta({
          colors: data.colors || [],
          types: (data.types || []).filter((t: string) => t !== 'LEADER'),
          costs: data.costs || [],
          counters: data.counters || [],
          attributes: data.attributes || [],
          blocks: data.blocks || [],
          features: data.features || [],
          seriesIds: data.seriesIds || [],
        });
      })
      .catch(console.error);
  }, []);
  
  // リーダー色でフィルタを更新
  useEffect(() => {
    if (leaderCard) {
      setFilter(prev => ({
        ...prev,
        leader_colors: leaderCard.color,
      }));
    }
  }, [leaderCard]);
  
  // カード検索
  const searchCards = useCallback(async (filterOptions: FilterOptions) => {
    setLoading(true);
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filterOptions),
      });
      const data = await res.json();
      setFilteredCards(data.cards || []);
    } catch (error) {
      console.error('Search error:', error);
      setFilteredCards([]);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // フィルタ変更時に検索（カード追加画面でのみ）
  useEffect(() => {
    if (view === 'add_cards' && leaderCard) {
      const timer = setTimeout(() => {
        searchCards(filter);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [filter, view, leaderCard, searchCards]);
  
  // リーダー選択
  const handleSelectLeader = (card: Card) => {
    setLeaderCard(card);
    setDeck({
      name: '',
      leader: card.card_id,
      cards: {},
    });
    setView('preview');
  };
  
  // カード追加
  const handleAddCard = (card: Card) => {
    const currentCount = deck.cards[card.card_id] || 0;
    const isUnlimited = UNLIMITED_CARDS.includes(card.card_id);
    
    if (!isUnlimited && currentCount >= 4) {
      return;
    }
    
    setDeck(prev => ({
      ...prev,
      cards: {
        ...prev.cards,
        [card.card_id]: currentCount + 1,
      },
    }));
  };
  
  // カード削除
  const handleRemoveCard = (cardId: string) => {
    const currentCount = deck.cards[cardId] || 0;
    if (currentCount <= 0) return;
    
    setDeck(prev => {
      const newCards = { ...prev.cards };
      if (currentCount === 1) {
        delete newCards[cardId];
      } else {
        newCards[cardId] = currentCount - 1;
      }
      return { ...prev, cards: newCards };
    });
  };
  
  // カード追加可能かチェック
  const canAddCard = (cardId: string): boolean => {
    const currentCount = deck.cards[cardId] || 0;
    if (UNLIMITED_CARDS.includes(cardId)) return true;
    return currentCount < 4;
  };
  
  // デッキ合計枚数
  const totalCards = Object.values(deck.cards).reduce((sum, count) => sum + count, 0);
  
  // リーダー変更（リセット）
  const handleChangeLeader = () => {
    setLeaderCard(null);
    setDeck({ name: '', leader: '', cards: {} });
    setView('leader');
  };
  
  // デッキインポート
  const handleImportDeck = async (text: string) => {
    try {
      const res = await fetch('/api/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', text }),
      });
      const data = await res.json();
      
      if (data.deck) {
        setDeck(data.deck);
        
        // リーダーカード情報を取得
        if (data.leader_info) {
          const leaderRes = await fetch('/api/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...DEFAULT_FILTER_OPTIONS,
              types: ['LEADER'],
              free_words: data.deck.leader,
              parallel_mode: 'both',
            }),
          });
          const leaderData = await leaderRes.json();
          const foundLeader = leaderData.cards?.find((c: Card) => c.card_id === data.deck.leader);
          if (foundLeader) {
            setLeaderCard(foundLeader);
          }
        }
        
        setView('preview');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('インポートに失敗しました');
    }
  };
  
  return (
    <div className="flex min-h-screen">
      {/* モバイル用サイドバーオーバーレイ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* メインコンテンツ */}
      <div className="flex-1 p-4">
        {/* モバイル用サイドバーボタン */}
        {view !== 'leader' && (
          <div className="lg:hidden mb-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="btn btn-secondary w-full"
            >
              🧾 デッキを表示 ({totalCards}/50)
            </button>
          </div>
        )}
        
        {/* リーダー選択画面 */}
        {view === 'leader' && (
          <LeaderSelect
            onSelect={handleSelectLeader}
            onImport={handleImportDeck}
          />
        )}
        
        {/* デッキプレビュー画面 */}
        {view === 'preview' && leaderCard && (
          <DeckPreview
            deck={deck}
            leaderCard={leaderCard}
            onAddCards={() => setView('add_cards')}
            onChangeLeader={handleChangeLeader}
            onRemoveCard={handleRemoveCard}
            onAddCard={handleAddCard}
          />
        )}
        
        {/* カード追加画面 */}
        {view === 'add_cards' && leaderCard && (
          <div>
            <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-bold">➕ カードを追加</h2>
                <p className="text-sm text-gray-600">
                  リーダー: {leaderCard.name}（{leaderCard.color.join('/')}）
                  - リーダーの色と同じカードのみが表示されます
                </p>
              </div>
              <button
                onClick={() => setView('preview')}
                className="btn btn-secondary"
              >
                🔙 プレビューに戻る
              </button>
            </div>
            
            {/* フィルタ */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h3 className="font-bold mb-3">🔍 カード検索フィルタ</h3>
              {filterMeta && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* タイプ */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">タイプ</label>
                    <div className="flex flex-wrap gap-1">
                      {filterMeta.types.map(type => (
                        <button
                          key={type}
                          onClick={() => {
                            const newTypes = filter.types.includes(type)
                              ? filter.types.filter(t => t !== type)
                              : [...filter.types, type];
                            setFilter(prev => ({ ...prev, types: newTypes }));
                          }}
                          className={`px-2 py-1 text-xs rounded border ${
                            filter.types.includes(type)
                              ? 'bg-green-600 text-white'
                              : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* コスト */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">コスト</label>
                    <div className="flex flex-wrap gap-1">
                      {filterMeta.costs.slice(0, 11).map(cost => (
                        <button
                          key={cost}
                          onClick={() => {
                            const newCosts = filter.costs.includes(cost)
                              ? filter.costs.filter(c => c !== cost)
                              : [...filter.costs, cost];
                            setFilter(prev => ({ ...prev, costs: newCosts }));
                          }}
                          className={`w-7 h-7 text-xs rounded border ${
                            filter.costs.includes(cost)
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          {cost}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* フリーワード */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">フリーワード</label>
                    <input
                      type="text"
                      value={filter.free_words}
                      onChange={(e) => setFilter(prev => ({ ...prev, free_words: e.target.value }))}
                      placeholder="カード名・テキスト・特徴など"
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  
                  {/* パラレルモード */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">カードバージョン</label>
                    <div className="flex gap-1">
                      {(['normal', 'parallel', 'both'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setFilter(prev => ({ ...prev, parallel_mode: mode }))}
                          className={`flex-1 px-2 py-1 text-xs rounded border ${
                            filter.parallel_mode === mode
                              ? 'bg-yellow-500 text-white'
                              : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          {mode === 'normal' ? '通常' : mode === 'parallel' ? 'パラレル' : '両方'}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* 列数 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">表示列数</label>
                    <select
                      value={colsCount}
                      onChange={(e) => setColsCount(Number(e.target.value))}
                      className="w-full border rounded px-2 py-1 text-sm"
                    >
                      <option value={2}>2列</option>
                      <option value={3}>3列</option>
                      <option value={4}>4列</option>
                      <option value={5}>5列</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            
            {/* カード一覧 */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                表示中のカード: {filteredCards.length} 枚
              </p>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
              </div>
            ) : (
              <CardGrid
                cards={filteredCards}
                colsCount={colsCount}
                onCardClick={handleAddCard}
                showAddButton={true}
                getCardCount={(cardId) => deck.cards[cardId] || 0}
                canAddCard={canAddCard}
              />
            )}
          </div>
        )}
      </div>
      
      {/* サイドバー（デッキ情報） */}
      {view !== 'leader' && (
        <DeckSidebar
          deck={deck}
          setDeck={setDeck}
          leaderCard={leaderCard}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onRemoveCard={handleRemoveCard}
          onAddCard={handleAddCard}
          onPreview={() => setView('preview')}
        />
      )}
    </div>
  );
}
