'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Deck, FilterOptions, DEFAULT_FILTER_OPTIONS, UNLIMITED_CARDS, COLOR_ORDER } from '@/lib/types';
import FilterPanel from './FilterPanel';
import CardGrid from './CardGrid';
import DeckSidebar from './DeckSidebar';
import DeckPreview from './DeckPreview';
import LeaderSelect from './LeaderSelect';
import BlankCardModal from './BlankCardModal';

type DeckView = 'leader' | 'preview' | 'add_cards';

interface FilterMeta {
  colors: string[];
  types: string[];
  costs: number[];
  counters: number[];
  powers: number[];
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
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);
  
  // カード検索関連
  const [allCards, setAllCards] = useState<Card[]>([]); // 全カードのキャッシュ
  const [blankCards, setBlankCards] = useState<Card[]>([]); // ブランクカード（セッション内のみ）
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [filter, setFilter] = useState<FilterOptions>({
    ...DEFAULT_FILTER_OPTIONS,
    types: [], // 未選択で全表示（リーダーはleader_colorsで除外される）
  });
  const [filterMeta, setFilterMeta] = useState<FilterMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [colsCount, setColsCount] = useState(4);
  const [showBlankCardModal, setShowBlankCardModal] = useState(false);
  
  // ブランクカードインポートイベントのリスナー
  useEffect(() => {
    const handleImportBlankCards = (e: CustomEvent<Card[]>) => {
      const newCards = e.detail;
      setBlankCards(prev => [...prev, ...newCards]);
      setAllCards(prev => [...prev, ...newCards]);
    };
    
    window.addEventListener('importBlankCards', handleImportBlankCards as EventListener);
    return () => {
      window.removeEventListener('importBlankCards', handleImportBlankCards as EventListener);
    };
  }, []);
  
  // 初回に全カードを取得してキャッシュ
  useEffect(() => {
    const fetchAllCards = async () => {
      try {
        const res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...DEFAULT_FILTER_OPTIONS,
            parallel_mode: 'both',
          }),
        });
        const data = await res.json();
        setAllCards(data.cards || []);
      } catch (error) {
        console.error('Fetch all cards error:', error);
      }
    };
    fetchAllCards();
  }, []);
  
  // フィルタメタデータを取得
  useEffect(() => {
    fetch('/api/cards')
      .then(res => res.json())
      .then(data => {
        setFilterMeta({
          colors: data.colors || [],
          types: data.types || [], // 全タイプを取得（FilterPanel側でLEADERを除外）
          costs: data.costs || [],
          counters: data.counters || [],
          powers: data.powers || [],
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
      
      // ブランクカードもフィルタして追加
      const filteredBlankCards = blankCards.filter(card => {
        // リーダー色フィルタ
        if (filterOptions.leader_colors.length > 0) {
          if (!card.color.some(c => filterOptions.leader_colors.includes(c))) {
            return false;
          }
        }
        // 色フィルタ
        if (filterOptions.colors.length > 0) {
          if (!card.color.some(c => filterOptions.colors.includes(c))) {
            return false;
          }
        }
        // タイプフィルタ
        if (filterOptions.types.length > 0) {
          if (!filterOptions.types.includes(card.type)) {
            return false;
          }
        }
        // フリーワードフィルタ
        if (filterOptions.free_words.trim()) {
          const searchText = `${card.name} ${card.card_id}`.toLowerCase();
          const words = filterOptions.free_words.toLowerCase().split(/\s+/);
          if (!words.every(w => searchText.includes(w))) {
            return false;
          }
        }
        return true;
      });
      
      setFilteredCards([...filteredBlankCards, ...(data.cards || [])]);
    } catch (error) {
      console.error('Search error:', error);
      setFilteredCards(blankCards);
    } finally {
      setLoading(false);
    }
  }, [blankCards]);
  
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
  
  // カード枚数を0にリセット
  const handleResetCard = (cardId: string) => {
    setDeck(prev => {
      const newCards = { ...prev.cards };
      delete newCards[cardId];
      return { ...prev, cards: newCards };
    });
  };
  
  // ブランクカードを追加
  const handleAddBlankCard = (card: Card) => {
    setBlankCards(prev => [...prev, card]);
    // allCardsにも追加（DeckPreviewで表示するため）
    setAllCards(prev => [...prev, card]);
    // 検索を再実行してリストに表示
    searchCards(filter);
  };
  
  // ブランクカードを更新
  const handleUpdateBlankCard = (card: Card) => {
    setBlankCards(prev => prev.map(c => c.card_id === card.card_id ? card : c));
    setAllCards(prev => prev.map(c => c.card_id === card.card_id ? card : c));
    searchCards(filter);
  };
  
  // ブランクカードを削除
  const handleDeleteBlankCard = (cardId: string) => {
    setBlankCards(prev => prev.filter(c => c.card_id !== cardId));
    setAllCards(prev => prev.filter(c => c.card_id !== cardId));
    // デッキからも削除
    setDeck(prev => {
      const newCards = { ...prev.cards };
      delete newCards[cardId];
      return { ...prev, cards: newCards };
    });
    searchCards(filter);
  };
  
  // ブランクカードをインポート
  const handleImportBlankCards = (cards: Card[], counts: Record<string, number>) => {
    // 既存のIDと重複しないようにする
    const existingIds = new Set([...allCards.map(c => c.card_id), ...blankCards.map(c => c.card_id)]);
    const newCards = cards.filter(c => !existingIds.has(c.card_id));
    
    if (newCards.length > 0) {
      setBlankCards(prev => [...prev, ...newCards]);
      setAllCards(prev => [...prev, ...newCards]);
      
      // デッキにも追加
      setDeck(prev => {
        const newDeckCards = { ...prev.cards };
        newCards.forEach(c => {
          newDeckCards[c.card_id] = counts[c.card_id] || 1;
        });
        return { ...prev, cards: newDeckCards };
      });
      
      searchCards(filter);
    }
  };
  
  // 編集中のブランクカード
  const [editingBlankCard, setEditingBlankCard] = useState<Card | null>(null);
  
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
    setBlankCards([]);
    setView('leader');
  };
  
  // ブランクカードをQR形式からデコード
  const decodeBlankCardsFromText = (text: string): { normalText: string; cards: Card[]; counts: Record<string, number> } => {
    const lines = text.split('\n');
    const blankLines = lines.filter(l => l.startsWith('B|'));
    const normalLines = lines.filter(l => !l.startsWith('B|'));
    
    if (blankLines.length === 0) {
      return { normalText: text, cards: [], counts: {} };
    }
    
    const cards: Card[] = [];
    const counts: Record<string, number> = {};
    
    blankLines.forEach(line => {
      const parts = line.split('|');
      if (parts.length >= 10) {
        const [, cardId, name, typeCode, colors, cost, power, counter, attr, count, features, effectText] = parts;
        const type = typeCode === 'C' ? 'CHARACTER' : typeCode === 'E' ? 'EVENT' : 'STAGE';
        
        cards.push({
          name: name || '不明カード',
          card_id: cardId,
          card_code: '',
          type,
          rarity: '?',
          cost: parseInt(cost) || 0,
          attribute: attr === '-' ? '' : attr,
          power: parseInt(power) || 0,
          counter: parseInt(counter) || 0,
          color: colors ? colors.split(',') : [],
          block_icon: '',
          features: features ? features.split(',').filter(Boolean) : [],
          text: effectText || '',
          trigger: '',
          source: 'ブランクカード（QRインポート）',
          image_url: '',
          is_parallel: false,
          series_id: 'BLANK',
        });
        counts[cardId] = parseInt(count) || 1;
      }
    });
    
    return { normalText: normalLines.join('\n').trim(), cards, counts };
  };
  
  // デッキインポート
  const handleImportDeck = async (text: string) => {
    try {
      // ブランクカードを抽出
      const { normalText, cards: importedBlankCards, counts: blankCounts } = decodeBlankCardsFromText(text);
      
      const res = await fetch('/api/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', text: normalText }),
      });
      const data = await res.json();
      
      if (data.error) {
        alert(data.error);
        return;
      }
      
      if (data.deck) {
        // ブランクカードの枚数をデッキに追加
        const deckWithBlank = {
          ...data.deck,
          cards: {
            ...data.deck.cards,
            ...blankCounts,
          },
        };
        
        setDeck(deckWithBlank);
        
        // ブランクカードを追加
        if (importedBlankCards.length > 0) {
          setBlankCards(prev => {
            const existingIds = new Set(prev.map(c => c.card_id));
            const newCards = importedBlankCards.filter(c => !existingIds.has(c.card_id));
            return [...prev, ...newCards];
          });
          setAllCards(prev => {
            const existingIds = new Set(prev.map(c => c.card_id));
            const newCards = importedBlankCards.filter(c => !existingIds.has(c.card_id));
            return [...prev, ...newCards];
          });
        }
        
        // リーダーカード情報を取得（allCardsから検索、またはAPIから取得）
        if (data.deck.leader) {
          // まずキャッシュされたallCardsから検索
          let foundLeader = allCards.find(c => c.card_id === data.deck.leader);
          
          // 見つからない場合はAPIから取得
          if (!foundLeader) {
            const leaderRes = await fetch('/api/cards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...DEFAULT_FILTER_OPTIONS,
                types: ['LEADER'],
                parallel_mode: 'both',
              }),
            });
            const leaderData = await leaderRes.json();
            foundLeader = leaderData.cards?.find((c: Card) => c.card_id === data.deck.leader);
          }
          
          if (foundLeader) {
            setLeaderCard(foundLeader);
            setView('preview');
          } else {
            alert('リーダーカードが見つかりませんでした: ' + data.deck.leader);
          }
        }
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
            allCards={allCards}
            onAddCards={() => setView('add_cards')}
            onChangeLeader={handleChangeLeader}
            onRemoveCard={handleRemoveCard}
            onAddCard={handleAddCard}
          />
        )}
        
        {/* カード追加画面 */}
        {view === 'add_cards' && leaderCard && (
          <div className="flex gap-4">
            {/* モバイル用丸ボタン */}
            <div className="lg:hidden fixed bottom-20 right-4 z-30 flex flex-col gap-2">
              {/* デッキ表示ボタン */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="btn btn-success shadow-lg rounded-full w-14 h-14 flex items-center justify-center relative"
              >
                🧾
                {/* 枚数バッジ */}
                <span className={`absolute -top-1 -right-1 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  totalCards === 50 ? 'bg-green-600 text-white' : totalCards > 50 ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                  {totalCards}
                </span>
              </button>
              {/* フィルタボタン */}
              <button
                onClick={() => setFilterSidebarOpen(true)}
                className="btn btn-primary shadow-lg rounded-full w-14 h-14 flex items-center justify-center"
              >
                🔍
              </button>
            </div>
            
            {/* フィルタサイドバー（モバイル用オーバーレイ） */}
            {filterSidebarOpen && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                onClick={() => setFilterSidebarOpen(false)}
              />
            )}
            
            {/* フィルタサイドバー */}
            <aside
              className={`
                fixed lg:sticky top-0 left-0
                w-80 h-screen overflow-y-auto
                bg-white shadow-lg z-50
                transform transition-transform duration-300
                ${filterSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
              `}
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              <div className="p-4 pb-32 lg:pb-4">
                <div className="flex items-center justify-between mb-4 lg:hidden">
                  <h2 className="font-bold text-lg">🔍 フィルタ</h2>
                  <button
                    onClick={() => setFilterSidebarOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    ✕
                  </button>
                </div>
                
                {filterMeta && (
                  <FilterPanel
                    filter={filter}
                    onChange={(newFilter) => setFilter({ ...newFilter, leader_colors: leaderCard.color })}
                    meta={filterMeta}
                    hideLeaderType={true}
                  />
                )}
                
                {/* 表示設定 */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    表示列数
                  </label>
                  <select
                    value={colsCount}
                    onChange={(e) => setColsCount(Number(e.target.value))}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value={3}>3列</option>
                    <option value={4}>4列</option>
                    <option value={5}>5列（コンパクト）</option>
                    <option value={6}>6列（コンパクト）</option>
                    <option value={7}>7列（コンパクト）</option>
                    <option value={8}>8列（コンパクト）</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    5列以上は画像のみ表示
                  </p>
                </div>
                
                {/* ブランクカード追加 */}
                <div className="mt-4">
                  <button
                    onClick={() => setShowBlankCardModal(true)}
                    className="w-full btn btn-secondary flex items-center justify-center gap-2"
                  >
                    <span>📝</span>
                    <span>カードを手動追加</span>
                  </button>
                  <p className="text-xs text-gray-500 mt-1">
                    データ未登録のカードを仮追加できます
                  </p>
                  {blankCards.length > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      ブランクカード: {blankCards.length}枚追加済み
                    </p>
                  )}
                </div>
              </div>
            </aside>
            
            {/* メインコンテンツ */}
            <div className="flex-1">
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
              
              {/* カード一覧 */}
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  表示中のカード: {filteredCards.length} 枚
                </p>
                <button
                  onClick={() => setFilterSidebarOpen(true)}
                  className="btn btn-secondary btn-sm lg:hidden"
                >
                  🔍 フィルタ
                </button>
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
                  onCardRemove={(card) => handleRemoveCard(card.card_id)}
                  onCardReset={(card) => handleResetCard(card.card_id)}
                  showAddButton={true}
                  getCardCount={(cardId) => deck.cards[cardId] || 0}
                  canAddCard={canAddCard}
                />
              )}
            </div>
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
          allCards={[...allCards, ...blankCards]}
          blankCards={blankCards}
          onEditBlankCard={(card) => {
            setEditingBlankCard(card);
            setShowBlankCardModal(true);
          }}
          onImportBlankCards={handleImportBlankCards}
        />
      )}
      
      {/* ブランクカード追加/編集モーダル */}
      <BlankCardModal
        isOpen={showBlankCardModal}
        onClose={() => {
          setShowBlankCardModal(false);
          setEditingBlankCard(null);
        }}
        onAdd={handleAddBlankCard}
        onUpdate={handleUpdateBlankCard}
        onDelete={handleDeleteBlankCard}
        existingIds={[...allCards.map(c => c.card_id), ...blankCards.map(c => c.card_id)]}
        editCard={editingBlankCard}
        availableFeatures={filterMeta?.features || []}
        availableAttributes={filterMeta?.attributes || []}
      />
    </div>
  );
}
