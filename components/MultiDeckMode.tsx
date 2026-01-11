'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Deck, FilterOptions, DEFAULT_FILTER_OPTIONS, UNLIMITED_CARDS, COLOR_ORDER } from '@/lib/types';
import CardGrid from './CardGrid';
import FilterPanel from './FilterPanel';
import ImageModal from './ImageModal';

interface DeckTab {
  id: string;
  name: string;
  deck: Deck;
  leaderCard: Card | null;
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

// タブIDを生成
let tabIdCounter = 0;
const generateTabId = () => `tab-${Date.now()}-${tabIdCounter++}`;

export default function MultiDeckMode() {
  // タブ管理
  const [tabs, setTabs] = useState<DeckTab[]>([
    {
      id: generateTabId(),
      name: 'デッキ1',
      deck: { name: 'デッキ1', leader: '', cards: {} },
      leaderCard: null,
    }
  ]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  
  // カード検索
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [filter, setFilter] = useState<FilterOptions>({
    ...DEFAULT_FILTER_OPTIONS,
    parallel_mode: 'normal',
  });
  const [filterMeta, setFilterMeta] = useState<FilterMeta>({
    colors: [], types: [], costs: [], counters: [], powers: [],
    attributes: [], blocks: [], features: [], seriesIds: [],
  });
  const [loading, setLoading] = useState(false);
  
  // UI状態
  const [showLeaderSelect, setShowLeaderSelect] = useState<string | null>(null); // タブIDまたはnull
  const [leaders, setLeaders] = useState<Card[]>([]);
  const [zoomedCard, setZoomedCard] = useState<Card | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [colsCount, setColsCount] = useState(5);
  const [cardPanelColsCount, setCardPanelColsCount] = useState(6);
  
  // アクティブなタブを取得
  const activeTab = useMemo(() => 
    tabs.find(t => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );
  
  // 初期データ取得
  useEffect(() => {
    const fetchInitialData = async () => {
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
        
        // リーダー一覧
        const leaderRes = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...DEFAULT_FILTER_OPTIONS, types: ['LEADER'], parallel_mode: 'both' }),
        });
        const leaderData = await leaderRes.json();
        setLeaders(leaderData.cards || []);
      } catch (error) {
        console.error('Initial fetch error:', error);
      }
    };
    fetchInitialData();
  }, []);
  
  // カード検索
  useEffect(() => {
    const searchCards = async () => {
      setLoading(true);
      try {
        // アクティブタブのリーダー色でフィルタ
        const leaderColors = activeTab.leaderCard?.color || [];
        const searchFilter = {
          ...filter,
          leader_colors: leaderColors,
          types: filter.types.length > 0 ? filter.types : ['CHARACTER', 'EVENT', 'STAGE'],
        };
        
        const res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(searchFilter),
        });
        const data = await res.json();
        setAllCards(data.cards || []);
        setFilteredCards(data.cards || []);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    const debounce = setTimeout(searchCards, 300);
    return () => clearTimeout(debounce);
  }, [filter, activeTab.leaderCard?.color]);
  
  // タブ操作
  const addTab = useCallback(() => {
    const newTab: DeckTab = {
      id: generateTabId(),
      name: `デッキ${tabs.length + 1}`,
      deck: { name: `デッキ${tabs.length + 1}`, leader: '', cards: {} },
      leaderCard: null,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs.length]);
  
  const removeTab = useCallback((tabId: string) => {
    if (tabs.length <= 1) return;
    
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(newTabs[0].id);
      }
      return newTabs;
    });
  }, [tabs.length, activeTabId]);
  
  const updateTab = useCallback((tabId: string, updates: Partial<DeckTab>) => {
    setTabs(prev => prev.map(t => 
      t.id === tabId ? { ...t, ...updates } : t
    ));
  }, []);
  
  const renameTab = useCallback((tabId: string, newName: string) => {
    updateTab(tabId, { 
      name: newName,
      deck: { ...tabs.find(t => t.id === tabId)!.deck, name: newName }
    });
  }, [updateTab, tabs]);
  
  // デッキ操作
  const setLeader = useCallback((tabId: string, leader: Card) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    updateTab(tabId, {
      leaderCard: leader,
      deck: { ...tab.deck, leader: leader.card_id },
    });
    setShowLeaderSelect(null);
  }, [tabs, updateTab]);
  
  const addCardToDeck = useCallback((tabId: string, card: Card) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const currentCount = tab.deck.cards[card.card_id] || 0;
    const isUnlimited = UNLIMITED_CARDS.includes(card.card_id);
    
    if (!isUnlimited && currentCount >= 4) return;
    
    updateTab(tabId, {
      deck: {
        ...tab.deck,
        cards: {
          ...tab.deck.cards,
          [card.card_id]: currentCount + 1,
        },
      },
    });
  }, [tabs, updateTab]);
  
  const removeCardFromDeck = useCallback((tabId: string, cardId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const currentCount = tab.deck.cards[cardId] || 0;
    if (currentCount <= 0) return;
    
    const newCards = { ...tab.deck.cards };
    if (currentCount === 1) {
      delete newCards[cardId];
    } else {
      newCards[cardId] = currentCount - 1;
    }
    
    updateTab(tabId, {
      deck: { ...tab.deck, cards: newCards },
    });
  }, [tabs, updateTab]);
  
  const resetCardInDeck = useCallback((tabId: string, cardId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const newCards = { ...tab.deck.cards };
    delete newCards[cardId];
    
    updateTab(tabId, {
      deck: { ...tab.deck, cards: newCards },
    });
  }, [tabs, updateTab]);
  
  // カードをタブ間でコピー
  const copyCardToTab = useCallback((fromTabId: string, toTabId: string, cardId: string, count: number) => {
    const toTab = tabs.find(t => t.id === toTabId);
    if (!toTab) return;
    
    const currentCount = toTab.deck.cards[cardId] || 0;
    const isUnlimited = UNLIMITED_CARDS.includes(cardId);
    const maxAdd = isUnlimited ? count : Math.min(count, 4 - currentCount);
    
    if (maxAdd <= 0) return;
    
    updateTab(toTabId, {
      deck: {
        ...toTab.deck,
        cards: {
          ...toTab.deck.cards,
          [cardId]: currentCount + maxAdd,
        },
      },
    });
  }, [tabs, updateTab]);
  
  // デッキの合計枚数
  const getDeckTotal = (deck: Deck) => 
    Object.values(deck.cards).reduce((sum, count) => sum + count, 0);
  
  // カードの枚数取得
  const getCardCount = useCallback((tabId: string, cardId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    return tab?.deck.cards[cardId] || 0;
  }, [tabs]);
  
  // カード追加可否
  const canAddCard = useCallback((tabId: string, cardId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return false;
    
    const currentCount = tab.deck.cards[cardId] || 0;
    if (UNLIMITED_CARDS.includes(cardId)) return true;
    return currentCount < 4;
  }, [tabs]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm px-4 py-2 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">🗂️ マルチデッキ編集</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">カード列:</label>
          <select
            value={cardPanelColsCount}
            onChange={(e) => setCardPanelColsCount(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            {[4, 5, 6, 7, 8].map(n => (
              <option key={n} value={n}>{n}列</option>
            ))}
          </select>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden btn btn-secondary btn-sm"
          >
            🔍
          </button>
        </div>
      </header>
      
      {/* タブバー */}
      <div className="bg-gray-200 px-2 py-1 flex items-center gap-1 overflow-x-auto">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-t text-sm cursor-pointer transition-colors ${
              activeTabId === tab.id
                ? 'bg-white text-gray-800 font-medium'
                : 'bg-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span 
              className="max-w-[100px] truncate"
              onDoubleClick={(e) => {
                e.stopPropagation();
                const newName = prompt('デッキ名を入力', tab.name);
                if (newName) renameTab(tab.id, newName);
              }}
            >
              {tab.name}
            </span>
            <span className={`text-xs px-1 rounded ${
              getDeckTotal(tab.deck) === 50 ? 'bg-green-500 text-white' :
              getDeckTotal(tab.deck) > 50 ? 'bg-red-500 text-white' :
              'bg-gray-400 text-white'
            }`}>
              {getDeckTotal(tab.deck)}
            </span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); removeTab(tab.id); }}
                className="text-gray-400 hover:text-red-500 ml-1"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addTab}
          className="px-3 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
        >
          ＋
        </button>
      </div>
      
      {/* メインコンテンツ */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左: フィルタパネル（デスクトップ） */}
        <aside className={`
          ${sidebarOpen ? 'fixed inset-0 z-40 bg-black bg-opacity-50 md:relative md:bg-transparent' : 'hidden'}
          md:block md:w-64 lg:w-72 flex-shrink-0
        `}>
          <div 
            className={`
              ${sidebarOpen ? 'w-80 max-w-full' : 'w-full'}
              h-full bg-white md:bg-gray-50 overflow-y-auto p-4
            `}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 md:hidden">
              <h2 className="font-bold">フィルタ</h2>
              <button onClick={() => setSidebarOpen(false)} className="text-xl">×</button>
            </div>
            <FilterPanel
              filter={filter}
              onChange={setFilter}
              meta={filterMeta}
              hideLeaderType={true}
            />
          </div>
          {sidebarOpen && (
            <div 
              className="absolute inset-0 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </aside>
        
        {/* 中央: カード一覧 */}
        <div className="flex-1 overflow-y-auto p-2 md:p-4 border-r">
          {activeTab.leaderCard ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {filteredCards.length}件のカード
                </span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
                </div>
              ) : (
                <CardGrid
                  cards={filteredCards}
                  colsCount={cardPanelColsCount}
                  onCardClick={(card) => addCardToDeck(activeTabId, card)}
                  onCardRemove={(card) => removeCardFromDeck(activeTabId, card.card_id)}
                  onCardReset={(card) => resetCardInDeck(activeTabId, card.card_id)}
                  showAddButton={true}
                  getCardCount={(cardId) => getCardCount(activeTabId, cardId)}
                  canAddCard={(cardId) => canAddCard(activeTabId, cardId)}
                />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="text-lg mb-4">リーダーを選択してください</p>
              <button
                onClick={() => setShowLeaderSelect(activeTabId)}
                className="btn btn-primary"
              >
                リーダーを選択
              </button>
            </div>
          )}
        </div>
        
        {/* 右: デッキプレビュー */}
        <aside className="w-64 lg:w-80 flex-shrink-0 bg-white overflow-y-auto hidden md:block">
          <DeckPanel
            tab={activeTab}
            tabs={tabs}
            allCards={allCards}
            colsCount={colsCount}
            setColsCount={setColsCount}
            onSelectLeader={() => setShowLeaderSelect(activeTabId)}
            onAddCard={(card) => addCardToDeck(activeTabId, card)}
            onRemoveCard={(cardId) => removeCardFromDeck(activeTabId, cardId)}
            onZoomCard={setZoomedCard}
            onCopyToTab={copyCardToTab}
            getCardCount={(cardId) => getCardCount(activeTabId, cardId)}
          />
        </aside>
      </div>
      
      {/* リーダー選択モーダル */}
      {showLeaderSelect && (
        <LeaderSelectModal
          leaders={leaders}
          onSelect={(leader) => setLeader(showLeaderSelect, leader)}
          onClose={() => setShowLeaderSelect(null)}
        />
      )}
      
      {/* 画像モーダル */}
      <ImageModal card={zoomedCard} onClose={() => setZoomedCard(null)} />
    </div>
  );
}


// デッキパネルコンポーネント
interface DeckPanelProps {
  tab: DeckTab;
  tabs: DeckTab[];
  allCards: Card[];
  colsCount: number;
  setColsCount: (n: number) => void;
  onSelectLeader: () => void;
  onAddCard: (card: Card) => void;
  onRemoveCard: (cardId: string) => void;
  onZoomCard: (card: Card) => void;
  onCopyToTab: (fromTabId: string, toTabId: string, cardId: string, count: number) => void;
  getCardCount: (cardId: string) => number;
}

function DeckPanel({
  tab,
  tabs,
  allCards,
  colsCount,
  setColsCount,
  onSelectLeader,
  onAddCard,
  onRemoveCard,
  onZoomCard,
  onCopyToTab,
  getCardCount,
}: DeckPanelProps) {
  const [sortedCards, setSortedCards] = useState<{ card: Card; count: number }[]>([]);
  const [copyTarget, setCopyTarget] = useState<string | null>(null);
  
  const total = Object.values(tab.deck.cards).reduce((sum, c) => sum + c, 0);
  
  // デッキカードをソート
  useEffect(() => {
    const fetchSort = async () => {
      const cardIds = Object.keys(tab.deck.cards);
      if (cardIds.length === 0) {
        setSortedCards([]);
        return;
      }
      
      try {
        const res = await fetch('/api/deck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sort', card_ids: cardIds }),
        });
        const data = await res.json();
        
        const sorted = (data.card_ids_sorted || cardIds).map((id: string) => {
          const card = allCards.find(c => c.card_id === id) || data.cards?.find((c: any) => c.card_id === id);
          return { card, count: tab.deck.cards[id] || 0 };
        }).filter((item: any) => item.card);
        
        setSortedCards(sorted);
      } catch (error) {
        console.error('Sort error:', error);
      }
    };
    
    fetchSort();
  }, [tab.deck.cards, allCards]);
  
  // エクスポート
  const handleExport = async () => {
    try {
      const res = await fetch('/api/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export', deck: tab.deck }),
      });
      const data = await res.json();
      
      await navigator.clipboard.writeText(data.text || '');
      alert('デッキをクリップボードにコピーしました');
    } catch (error) {
      console.error('Export error:', error);
    }
  };
  
  // 他タブ一覧（コピー先）
  const otherTabs = tabs.filter(t => t.id !== tab.id);

  return (
    <div className="p-3 h-full flex flex-col">
      {/* リーダー */}
      <div 
        className="mb-3 cursor-pointer"
        onClick={onSelectLeader}
      >
        {tab.leaderCard ? (
          <div className="flex gap-2 items-start">
            <img
              src={tab.leaderCard.image_url}
              alt={tab.leaderCard.name}
              className="w-16 h-auto rounded shadow"
              onClick={(e) => { e.stopPropagation(); onZoomCard(tab.leaderCard!); }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{tab.leaderCard.name}</div>
              <div className="text-xs text-gray-500">{tab.leaderCard.card_id}</div>
              <div className="flex gap-1 mt-1">
                {tab.leaderCard.color.map(c => (
                  <span key={c} className={`color-badge color-badge-${c} text-[10px]`}>{c}</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 rounded p-4 text-center text-gray-500 text-sm">
            リーダーを選択
          </div>
        )}
      </div>
      
      {/* 枚数・操作 */}
      <div className="mb-3 flex items-center justify-between">
        <span className={`font-bold ${
          total === 50 ? 'text-green-600' : total > 50 ? 'text-red-600' : 'text-gray-700'
        }`}>
          {total}/50枚
        </span>
        <div className="flex items-center gap-1">
          <select
            value={colsCount}
            onChange={(e) => setColsCount(Number(e.target.value))}
            className="border rounded px-1 py-0.5 text-xs"
          >
            {[3, 4, 5, 6].map(n => (
              <option key={n} value={n}>{n}列</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
          >
            📋
          </button>
        </div>
      </div>
      
      {/* カードリスト */}
      <div className="flex-1 overflow-y-auto">
        {sortedCards.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-4">
            カードを追加してください
          </div>
        ) : (
          <div 
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))` }}
          >
            {sortedCards.map(({ card, count }) => (
              <div key={card.card_id} className="relative group">
                <img
                  src={card.image_url}
                  alt={card.name}
                  className="w-full rounded shadow cursor-pointer"
                  onClick={() => onZoomCard(card)}
                />
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] px-1 rounded-bl">
                  {count}
                </div>
                
                {/* ホバー時の操作 */}
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button
                    onClick={() => onAddCard(card)}
                    className="bg-green-500 text-white w-6 h-6 rounded text-sm"
                  >
                    +
                  </button>
                  <button
                    onClick={() => onRemoveCard(card.card_id)}
                    className="bg-red-500 text-white w-6 h-6 rounded text-sm"
                  >
                    -
                  </button>
                  {otherTabs.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setCopyTarget(copyTarget === card.card_id ? null : card.card_id)}
                        className="bg-purple-500 text-white w-6 h-6 rounded text-sm"
                        title="他のデッキにコピー"
                      >
                        →
                      </button>
                      {copyTarget === card.card_id && (
                        <div className="absolute bottom-full left-0 mb-1 bg-white shadow-lg rounded p-1 z-10 min-w-[80px]">
                          {otherTabs.map(t => (
                            <button
                              key={t.id}
                              onClick={() => {
                                onCopyToTab(tab.id, t.id, card.card_id, count);
                                setCopyTarget(null);
                              }}
                              className="block w-full text-left text-xs px-2 py-1 hover:bg-gray-100 rounded truncate"
                            >
                              {t.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// リーダー選択モーダル
interface LeaderSelectModalProps {
  leaders: Card[];
  onSelect: (leader: Card) => void;
  onClose: () => void;
}

function LeaderSelectModal({ leaders, onSelect, onClose }: LeaderSelectModalProps) {
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  
  const filteredLeaders = useMemo(() => {
    return leaders.filter(leader => {
      if (selectedColor && !leader.color.includes(selectedColor)) return false;
      if (searchText && !leader.name.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [leaders, selectedColor, searchText]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">リーダーを選択</h2>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-700">×</button>
        </div>
        
        <div className="p-4 border-b flex flex-wrap gap-2 items-center">
          <div className="flex gap-1">
            <button
              onClick={() => setSelectedColor('')}
              className={`px-2 py-1 text-xs rounded border ${
                !selectedColor ? 'bg-gray-800 text-white' : 'bg-white'
              }`}
            >
              全て
            </button>
            {COLOR_ORDER.map(color => (
              <button
                key={color}
                onClick={() => setSelectedColor(selectedColor === color ? '' : color)}
                className={`px-2 py-1 text-xs rounded border ${
                  selectedColor === color ? `color-badge-${color}` : 'bg-white'
                }`}
              >
                {color}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="リーダー名で検索..."
            className="border rounded px-3 py-1 text-sm flex-1 min-w-[150px]"
          />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {filteredLeaders.map(leader => (
              <div
                key={leader.card_id}
                className="cursor-pointer hover:scale-105 transition-transform"
                onClick={() => onSelect(leader)}
              >
                <img
                  src={leader.image_url}
                  alt={leader.name}
                  className="w-full rounded shadow"
                />
                <div className="text-xs text-center mt-1 truncate">{leader.name}</div>
              </div>
            ))}
          </div>
          {filteredLeaders.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              該当するリーダーがありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
