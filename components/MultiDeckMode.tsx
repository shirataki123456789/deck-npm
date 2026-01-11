'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Deck, FilterOptions, DEFAULT_FILTER_OPTIONS, UNLIMITED_CARDS } from '@/lib/types';
import FilterPanel from './FilterPanel';
import CardGrid from './CardGrid';
import DeckPreview from './DeckPreview';
import LeaderSelect from './LeaderSelect';
import BlankCardModal from './BlankCardModal';
import { BatchImportModal, BatchExportModal } from './MultiDeckBatchModals';

// タブデータの型定義
interface DeckTab {
  id: string;
  name: string;
  deck: Deck;
  leaderCard: Card | null;
  view: 'leader' | 'preview' | 'add_cards';
}

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

let tabCounter = 0;
const generateTabId = () => `tab-${Date.now()}-${++tabCounter}`;

export default function MultiDeckMode() {
  // タブ管理
  const [tabs, setTabs] = useState<DeckTab[]>([
    {
      id: generateTabId(),
      name: 'デッキ1',
      deck: { name: '', leader: '', cards: {} },
      leaderCard: null,
      view: 'leader',
    }
  ]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);

  // モーダル状態
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showBatchExport, setShowBatchExport] = useState(false);
  const [showBlankCardModal, setShowBlankCardModal] = useState(false);

  // カード関連状態
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [blankCards, setBlankCards] = useState<Card[]>([]);
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [filter, setFilter] = useState<FilterOptions>({
    ...DEFAULT_FILTER_OPTIONS,
    types: [],
  });
  const [filterMeta, setFilterMeta] = useState<FilterMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [colsCount, setColsCount] = useState(4);

  // UI状態
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);

  // アクティブなタブを取得
  const activeTab = useMemo(() =>
    tabs.find(t => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  // タブを更新するヘルパー
  const updateTab = useCallback((tabId: string, updates: Partial<DeckTab>) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, ...updates } : t
    ));
  }, []);

  // 初回データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        // メタ情報
        const metaRes = await fetch('/api/cards');
        const metaData = await metaRes.json();
        setFilterMeta({
          colors: metaData.colors || [],
          types: metaData.types || [],
          costs: metaData.costs || [],
          counters: metaData.counters || [],
          powers: metaData.powers || [],
          attributes: metaData.attributes || [],
          blocks: metaData.blocks || [],
          features: metaData.features || [],
          seriesIds: metaData.seriesIds || [],
        });

        // 全カード
        const cardsRes = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...DEFAULT_FILTER_OPTIONS, parallel_mode: 'both' }),
        });
        const cardsData = await cardsRes.json();
        setAllCards(cardsData.cards || []);
      } catch (error) {
        console.error('Fetch error:', error);
      }
    };
    fetchData();
  }, []);

  // カード検索
  const searchCards = useCallback(async (filterOptions: FilterOptions, leaderColors: string[]) => {
    setLoading(true);
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filterOptions, leader_colors: leaderColors }),
      });
      const data = await res.json();

      // ブランクカードもフィルタして追加
      const filteredBlank = blankCards.filter(card => {
        if (card.type === 'LEADER') return false;
        if (leaderColors.length > 0 && !card.color.some(c => leaderColors.includes(c))) return false;
        if (filterOptions.colors.length > 0 && !card.color.some(c => filterOptions.colors.includes(c))) return false;
        if (filterOptions.types.length > 0 && !filterOptions.types.includes(card.type)) return false;
        return true;
      });

      setFilteredCards([...filteredBlank, ...(data.cards || [])]);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [blankCards]);

  // フィルタ変更時に検索
  useEffect(() => {
    if (activeTab.view === 'add_cards' && activeTab.leaderCard) {
      const timer = setTimeout(() => {
        searchCards(filter, activeTab.leaderCard!.color);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [filter, activeTab.view, activeTab.leaderCard, searchCards]);

  // === タブ操作 ===
  const addTab = useCallback(() => {
    const newTab: DeckTab = {
      id: generateTabId(),
      name: `デッキ${tabs.length + 1}`,
      deck: { name: '', leader: '', cards: {} },
      leaderCard: null,
      view: 'leader',
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs.length]);

  const removeTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;

    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(newTabs[0].id);
      }
      return newTabs;
    });
  }, [tabs.length, activeTabId]);

  const renameTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const newName = prompt('デッキ名を入力', tab.name);
    if (newName?.trim()) {
      updateTab(tabId, { name: newName.trim() });
    }
  }, [tabs, updateTab]);

  // === デッキ操作 ===
  const handleSelectLeader = useCallback((card: Card) => {
    updateTab(activeTabId, {
      leaderCard: card,
      deck: { name: '', leader: card.card_id, cards: {} },
      view: 'preview',
    });
    setFilter(prev => ({ ...prev, leader_colors: card.color }));
  }, [activeTabId, updateTab]);

  const handleAddCard = useCallback((card: Card) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    const currentCount = tab.deck.cards[card.card_id] || 0;
    const isUnlimited = UNLIMITED_CARDS.includes(card.card_id);
    if (!isUnlimited && currentCount >= 4) return;

    updateTab(activeTabId, {
      deck: {
        ...tab.deck,
        cards: { ...tab.deck.cards, [card.card_id]: currentCount + 1 },
      },
    });
  }, [tabs, activeTabId, updateTab]);

  const handleRemoveCard = useCallback((cardId: string) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    const currentCount = tab.deck.cards[cardId] || 0;
    if (currentCount <= 0) return;

    const newCards = { ...tab.deck.cards };
    if (currentCount === 1) {
      delete newCards[cardId];
    } else {
      newCards[cardId] = currentCount - 1;
    }

    updateTab(activeTabId, { deck: { ...tab.deck, cards: newCards } });
  }, [tabs, activeTabId, updateTab]);

  const handleResetCard = useCallback((cardId: string) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    const newCards = { ...tab.deck.cards };
    delete newCards[cardId];
    updateTab(activeTabId, { deck: { ...tab.deck, cards: newCards } });
  }, [tabs, activeTabId, updateTab]);

  const canAddCard = useCallback((cardId: string): boolean => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return false;
    const currentCount = tab.deck.cards[cardId] || 0;
    if (UNLIMITED_CARDS.includes(cardId)) return true;
    return currentCount < 4;
  }, [tabs, activeTabId]);

  const handleChangeLeader = useCallback(() => {
    updateTab(activeTabId, {
      leaderCard: null,
      deck: { name: '', leader: '', cards: {} },
      view: 'leader',
    });
  }, [activeTabId, updateTab]);

  // === 一括インポート ===
  const handleBatchImport = useCallback(async (decks: { name: string; deckText: string }[]) => {
    for (const { name, deckText } of decks) {
      try {
        const res = await fetch('/api/deck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'import', text: deckText }),
        });
        const data = await res.json();

        if (data.deck && data.leader_id) {
          const leaderCard = allCards.find(c => c.card_id === data.leader_id) || null;
          const newTab: DeckTab = {
            id: generateTabId(),
            name,
            deck: data.deck,
            leaderCard,
            view: leaderCard ? 'preview' : 'leader',
          };
          setTabs(prev => [...prev, newTab]);
        }
      } catch (error) {
        console.error(`Import error for ${name}:`, error);
      }
    }
  }, [allCards]);

  // === ブランクカード ===
  const handleAddBlankCard = useCallback((card: Card) => {
    setBlankCards(prev => [...prev, card]);
    setAllCards(prev => [...prev, card]);
  }, []);

  // デッキの合計枚数
  const totalCards = Object.values(activeTab.deck.cards).reduce((sum, c) => sum + c, 0);

  return (
    <div className="flex flex-col min-h-screen">
      {/* タブバー */}
      <div className="bg-gray-100 border-b px-2 py-1 flex items-center gap-1 overflow-x-auto flex-shrink-0">
        {tabs.map(tab => {
          const tabTotal = Object.values(tab.deck.cards).reduce((sum, c) => sum + c, 0);
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={() => renameTab(tab.id)}
              className={`
                flex items-center gap-1 px-3 py-2 rounded-t cursor-pointer
                transition-colors select-none min-w-[80px] max-w-[180px]
                ${activeTabId === tab.id
                  ? 'bg-white border-t border-l border-r border-gray-300 -mb-px'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                }
              `}
            >
              <span className="truncate flex-1 text-sm">{tab.name}</span>
              {tab.leaderCard && (
                <span className={`text-xs px-1 rounded ${
                  tabTotal === 50 ? 'bg-green-500 text-white' :
                  tabTotal > 50 ? 'bg-red-500 text-white' :
                  'bg-gray-400 text-white'
                }`}>
                  {tabTotal}
                </span>
              )}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => removeTab(tab.id, e)}
                  className="text-gray-400 hover:text-red-500 text-sm"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={addTab}
          className="px-2 py-2 text-gray-500 hover:bg-gray-200 rounded"
          title="新しいデッキを追加"
        >
          ＋
        </button>

        {/* 一括操作ボタン */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setShowBatchImport(true)}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            title="画像から一括インポート"
          >
            📥 一括読込
          </button>
          <button
            onClick={() => setShowBatchExport(true)}
            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
            title="一括エクスポート"
          >
            📤 一括出力
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 max-w-7xl mx-auto px-3 py-4 w-full">
        {/* リーダー選択画面 */}
        {activeTab.view === 'leader' && (
          <LeaderSelect
            onSelect={handleSelectLeader}
            onImportDeck={async (text) => {
              try {
                const res = await fetch('/api/deck', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'import', text }),
                });
                const data = await res.json();
                if (data.deck && data.leader_id) {
                  const leaderCard = allCards.find(c => c.card_id === data.leader_id) || null;
                  updateTab(activeTabId, {
                    deck: data.deck,
                    leaderCard,
                    view: leaderCard ? 'preview' : 'leader',
                  });
                }
              } catch (error) {
                console.error('Import error:', error);
              }
            }}
            blankLeaders={blankCards.filter(c => c.type === 'LEADER')}
            onAddBlankLeader={handleAddBlankCard}
            onEditBlankLeader={() => {}}
            onDeleteBlankLeader={() => {}}
            existingCardIds={allCards.map(c => c.card_id)}
          />
        )}

        {/* プレビュー画面 */}
        {activeTab.view === 'preview' && activeTab.leaderCard && (
          <DeckPreview
            deck={activeTab.deck}
            leaderCard={activeTab.leaderCard}
            allCards={[...allCards, ...blankCards]}
            onAddCards={() => updateTab(activeTabId, { view: 'add_cards' })}
            onChangeLeader={handleChangeLeader}
            onRemoveCard={handleRemoveCard}
            onAddCard={handleAddCard}
            onEditBlankLeader={() => {}}
          />
        )}

        {/* カード追加画面 */}
        {activeTab.view === 'add_cards' && activeTab.leaderCard && (
          <div className="flex gap-4">
            {/* モバイル用丸ボタン */}
            <div className="lg:hidden fixed bottom-20 right-4 z-30 flex flex-col gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                className="btn btn-success shadow-lg rounded-full w-14 h-14 flex items-center justify-center relative"
              >
                🧾
                <span className={`absolute -top-1 -right-1 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  totalCards === 50 ? 'bg-green-600 text-white' : totalCards > 50 ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                  {totalCards}
                </span>
              </button>
              <button
                onClick={() => setFilterSidebarOpen(true)}
                className="btn btn-primary shadow-lg rounded-full w-14 h-14 flex items-center justify-center"
              >
                🔍
              </button>
            </div>

            {/* フィルタサイドバー */}
            {filterSidebarOpen && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                onClick={() => setFilterSidebarOpen(false)}
              />
            )}

            <aside
              className={`
                fixed lg:sticky top-0 left-0
                w-80 h-screen overflow-y-auto
                bg-white shadow-lg z-50
                transform transition-transform duration-300
                ${filterSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
              `}
            >
              <div className="p-4 pb-32 lg:pb-4">
                <div className="flex items-center justify-between mb-4 lg:hidden">
                  <h2 className="font-bold text-lg">🔍 フィルタ</h2>
                  <button onClick={() => setFilterSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded">✕</button>
                </div>

                {filterMeta && (
                  <FilterPanel
                    filter={filter}
                    onChange={(newFilter) => setFilter({ ...newFilter, leader_colors: activeTab.leaderCard!.color })}
                    meta={filterMeta}
                    hideLeaderType={true}
                  />
                )}

                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">表示列数</label>
                  <select
                    value={colsCount}
                    onChange={(e) => setColsCount(Number(e.target.value))}
                    className="w-full border rounded px-3 py-2"
                  >
                    {[3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>{n}列{n >= 5 ? '（コンパクト）' : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => setShowBlankCardModal(true)}
                    className="w-full btn btn-secondary flex items-center justify-center gap-2"
                  >
                    <span>📝</span>
                    <span>カードを手動追加</span>
                  </button>
                </div>
              </div>
            </aside>

            {/* メインコンテンツ */}
            <div className="flex-1">
              <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-bold">➕ カードを追加</h2>
                  <p className="text-sm text-gray-600">
                    リーダー: {activeTab.leaderCard.name}（{activeTab.leaderCard.color.join('/')}）
                  </p>
                </div>
                <button
                  onClick={() => updateTab(activeTabId, { view: 'preview' })}
                  className="btn btn-secondary"
                >
                  🔙 プレビューに戻る
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600">表示中: {filteredCards.length}枚</p>
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
                  getCardCount={(cardId) => activeTab.deck.cards[cardId] || 0}
                  canAddCard={canAddCard}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* モーダル */}
      <BatchImportModal
        isOpen={showBatchImport}
        onClose={() => setShowBatchImport(false)}
        onImport={handleBatchImport}
      />

      <BatchExportModal
        isOpen={showBatchExport}
        onClose={() => setShowBatchExport(false)}
        tabs={tabs}
        allCards={[...allCards, ...blankCards]}
      />

      <BlankCardModal
        isOpen={showBlankCardModal}
        onClose={() => setShowBlankCardModal(false)}
        onAdd={handleAddBlankCard}
        onUpdate={() => {}}
        onDelete={() => {}}
        existingIds={allCards.map(c => c.card_id)}
        editCard={null}
        availableFeatures={filterMeta?.features || []}
        availableAttributes={filterMeta?.attributes || []}
      />
    </div>
  );
}
