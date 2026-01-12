'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Deck, FilterOptions, DEFAULT_FILTER_OPTIONS, UNLIMITED_CARDS } from '@/lib/types';
import FilterPanel from './FilterPanel';
import CardGrid from './CardGrid';
import DeckSidebar from './DeckSidebar';
import DeckPreview from './DeckPreview';
import LeaderSelect from './LeaderSelect';
import BlankCardModal from './BlankCardModal';

type DeckView = 'leader' | 'preview' | 'add_cards';

interface DeckTab {
  id: string;
  name: string;
  deck: Deck;
  leaderCard: Card | null;
  view: DeckView;
  blankCards: Card[];
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

const createNewTab = (name: string): DeckTab => ({
  id: generateTabId(),
  name,
  deck: { name: '', leader: '', cards: {} },
  leaderCard: null,
  view: 'leader',
  blankCards: [],
});

export default function MultiDeckMode() {
  // タブ管理
  const [tabs, setTabs] = useState<DeckTab[]>([createNewTab('デッキ1')]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);

  // 一括操作モーダル
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showBatchExport, setShowBatchExport] = useState(false);

  // 共有カードデータ
  const [allCards, setAllCards] = useState<Card[]>([]);
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
  const [showBlankCardModal, setShowBlankCardModal] = useState(false);
  const [editingBlankCard, setEditingBlankCard] = useState<Card | null>(null);

  // アクティブなタブ
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // タブを更新
  const updateTab = useCallback((tabId: string, updates: Partial<DeckTab>) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t));
  }, []);

  // 初回データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
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
  const searchCards = useCallback(async (filterOptions: FilterOptions, leaderColors: string[], blankCards: Card[]) => {
    setLoading(true);
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filterOptions, leader_colors: leaderColors }),
      });
      const data = await res.json();

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
  }, []);

  // フィルタ変更時に検索
  useEffect(() => {
    if (activeTab.view === 'add_cards' && activeTab.leaderCard) {
      const timer = setTimeout(() => {
        searchCards(filter, activeTab.leaderCard!.color, activeTab.blankCards);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [filter, activeTab.view, activeTab.leaderCard, activeTab.blankCards, searchCards]);

  // === タブ操作 ===
  const addTab = () => {
    const newTab = createNewTab(`デッキ${tabs.length + 1}`);
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const removeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) setActiveTabId(newTabs[0].id);
      return newTabs;
    });
  };

  const renameTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const newName = prompt('デッキ名を入力', tab.name);
    if (newName?.trim()) updateTab(tabId, { name: newName.trim() });
  };

  // === デッキ操作 ===
  const handleSelectLeader = (card: Card) => {
    updateTab(activeTabId, {
      leaderCard: card,
      deck: { name: '', leader: card.card_id, cards: {} },
      view: 'preview',
    });
    setFilter(prev => ({ ...prev, leader_colors: card.color }));
  };

  const handleAddCard = (card: Card) => {
    const currentCount = activeTab.deck.cards[card.card_id] || 0;
    const isUnlimited = UNLIMITED_CARDS.includes(card.card_id);
    if (!isUnlimited && currentCount >= 4) return;

    updateTab(activeTabId, {
      deck: {
        ...activeTab.deck,
        cards: { ...activeTab.deck.cards, [card.card_id]: currentCount + 1 },
      },
    });
  };

  const handleRemoveCard = (cardId: string) => {
    const currentCount = activeTab.deck.cards[cardId] || 0;
    if (currentCount <= 0) return;

    const newCards = { ...activeTab.deck.cards };
    if (currentCount === 1) delete newCards[cardId];
    else newCards[cardId] = currentCount - 1;

    updateTab(activeTabId, { deck: { ...activeTab.deck, cards: newCards } });
  };

  const handleResetCard = (cardId: string) => {
    const newCards = { ...activeTab.deck.cards };
    delete newCards[cardId];
    updateTab(activeTabId, { deck: { ...activeTab.deck, cards: newCards } });
  };

  const canAddCard = (cardId: string): boolean => {
    const currentCount = activeTab.deck.cards[cardId] || 0;
    if (UNLIMITED_CARDS.includes(cardId)) return true;
    return currentCount < 4;
  };

  const handleChangeLeader = () => {
    updateTab(activeTabId, {
      leaderCard: null,
      deck: { name: '', leader: '', cards: {} },
      view: 'leader',
    });
  };

  // デッキインポート（DeckModeと同じ処理）
  const handleImportDeck = async (text: string) => {
    try {
      let blankCardCounts: Record<string, number> = {};
      let cleanText = text;

      const blankMatch = text.match(/#BLANK:(.+)$/m);
      if (blankMatch) {
        cleanText = text.replace(/\n?#BLANK:.+$/m, '');
        blankMatch[1].split(',').forEach(part => {
          const [id, countStr] = part.split('=');
          if (id && countStr) blankCardCounts[id.trim()] = parseInt(countStr.trim(), 10) || 0;
        });
      }

      let blankLeaderFromQR: Card | null = null;
      const leaderMatch = text.match(/#LEADER:(B\|[^\n]+)/m);
      if (leaderMatch) {
        cleanText = cleanText.replace(/\n?#LEADER:.+$/m, '');
        const { decodeBlankCardFromQR } = await import('@/lib/blankCardQR');
        blankLeaderFromQR = decodeBlankCardFromQR(leaderMatch[1]);
      }

      const res = await fetch('/api/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', text: cleanText }),
      });
      const data = await res.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      if (data.deck) {
        const deckWithBlankCards = {
          ...data.deck,
          cards: { ...data.deck.cards, ...blankCardCounts },
        };

        if (blankLeaderFromQR) {
          deckWithBlankCards.leader = blankLeaderFromQR.card_id;
          const newBlankCards = activeTab.blankCards.some(c => c.card_id === blankLeaderFromQR!.card_id)
            ? activeTab.blankCards
            : [...activeTab.blankCards, blankLeaderFromQR];
          
          updateTab(activeTabId, {
            deck: deckWithBlankCards,
            leaderCard: blankLeaderFromQR,
            view: 'preview',
            blankCards: newBlankCards,
          });
        } else if (data.deck.leader) {
          let foundLeader = allCards.find(c => c.card_id === data.deck.leader);
          if (!foundLeader) foundLeader = activeTab.blankCards.find(c => c.card_id === data.deck.leader);

          if (!foundLeader) {
            const leaderRes = await fetch('/api/cards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...DEFAULT_FILTER_OPTIONS, types: ['LEADER'], parallel_mode: 'both' }),
            });
            const leaderData = await leaderRes.json();
            foundLeader = leaderData.cards?.find((c: Card) => c.card_id === data.deck.leader);
          }

          if (foundLeader) {
            updateTab(activeTabId, {
              deck: deckWithBlankCards,
              leaderCard: foundLeader,
              view: 'preview',
            });
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

  // ブランクカード操作
  const handleAddBlankCard = (card: Card) => {
    updateTab(activeTabId, {
      blankCards: [...activeTab.blankCards, card],
    });
    setAllCards(prev => [...prev, card]);
  };

  const handleUpdateBlankCard = (card: Card) => {
    updateTab(activeTabId, {
      blankCards: activeTab.blankCards.map(c => c.card_id === card.card_id ? card : c),
    });
    setAllCards(prev => prev.map(c => c.card_id === card.card_id ? card : c));
  };

  const handleDeleteBlankCard = (cardId: string) => {
    updateTab(activeTabId, {
      blankCards: activeTab.blankCards.filter(c => c.card_id !== cardId),
      deck: {
        ...activeTab.deck,
        cards: Object.fromEntries(Object.entries(activeTab.deck.cards).filter(([id]) => id !== cardId)),
      },
    });
    setAllCards(prev => prev.filter(c => c.card_id !== cardId));
  };

  // 一括インポート
  const handleBatchImport = async (deckTexts: { name: string; text: string }[]) => {
    for (const { name, text } of deckTexts) {
      try {
        let cleanText = text;
        let blankCardCounts: Record<string, number> = {};
        let blankLeaderFromQR: Card | null = null;

        const blankMatch = text.match(/#BLANK:(.+)$/m);
        if (blankMatch) {
          cleanText = text.replace(/\n?#BLANK:.+$/m, '');
          blankMatch[1].split(',').forEach(part => {
            const [id, countStr] = part.split('=');
            if (id && countStr) blankCardCounts[id.trim()] = parseInt(countStr.trim(), 10) || 0;
          });
        }

        const leaderMatch = text.match(/#LEADER:(B\|[^\n]+)/m);
        if (leaderMatch) {
          cleanText = cleanText.replace(/\n?#LEADER:.+$/m, '');
          const { decodeBlankCardFromQR } = await import('@/lib/blankCardQR');
          blankLeaderFromQR = decodeBlankCardFromQR(leaderMatch[1]);
        }

        const res = await fetch('/api/deck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'import', text: cleanText }),
        });
        const data = await res.json();

        if (data.deck) {
          const deckWithBlankCards = {
            ...data.deck,
            cards: { ...data.deck.cards, ...blankCardCounts },
          };

          if (blankLeaderFromQR) deckWithBlankCards.leader = blankLeaderFromQR.card_id;

          let leaderCard: Card | null = blankLeaderFromQR;
          if (!leaderCard && data.deck.leader) {
            leaderCard = allCards.find(c => c.card_id === data.deck.leader) || null;
            if (!leaderCard) {
              const leaderRes = await fetch('/api/cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...DEFAULT_FILTER_OPTIONS, types: ['LEADER'], parallel_mode: 'both' }),
              });
              const leaderData = await leaderRes.json();
              leaderCard = leaderData.cards?.find((c: Card) => c.card_id === data.deck.leader) || null;
            }
          }

          const newTab: DeckTab = {
            id: generateTabId(),
            name,
            deck: deckWithBlankCards,
            leaderCard,
            view: leaderCard ? 'preview' : 'leader',
            blankCards: blankLeaderFromQR ? [blankLeaderFromQR] : [],
          };
          setTabs(prev => [...prev, newTab]);
        }
      } catch (error) {
        console.error(`Import error for ${name}:`, error);
      }
    }
  };

  const totalCards = Object.values(activeTab.deck.cards).reduce((sum, c) => sum + c, 0);

  return (
    <>
      {/* タブバー */}
      <div className="bg-gray-100 border-b px-2 py-1 flex items-center gap-1 overflow-x-auto sticky top-[52px] sm:top-[60px] z-40">
        {tabs.map(tab => {
          const tabTotal = Object.values(tab.deck.cards).reduce((sum, c) => sum + c, 0);
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={() => renameTab(tab.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-t cursor-pointer select-none min-w-[80px] max-w-[160px] text-sm ${
                activeTabId === tab.id
                  ? 'bg-white border-t border-l border-r border-gray-300 -mb-px font-medium'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
              }`}
            >
              <span className="truncate flex-1">{tab.name}</span>
              {tab.leaderCard && (
                <span className={`text-xs px-1 rounded ${
                  tabTotal === 50 ? 'bg-green-500 text-white' :
                  tabTotal > 50 ? 'bg-red-500 text-white' : 'bg-gray-400 text-white'
                }`}>{tabTotal}</span>
              )}
              {tabs.length > 1 && (
                <button onClick={(e) => removeTab(tab.id, e)} className="text-gray-400 hover:text-red-500">×</button>
              )}
            </div>
          );
        })}
        <button onClick={addTab} className="px-2 py-1.5 text-gray-500 hover:bg-gray-200 rounded" title="新しいデッキ">＋</button>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setShowBatchImport(true)} className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">📥 一括読込</button>
          <button onClick={() => setShowBatchExport(true)} className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">📤 一括出力</button>
        </div>
      </div>

      <div className="flex min-h-screen">
        {/* モバイル用サイドバーオーバーレイ */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* メインコンテンツ */}
        <div className="flex-1 p-4">
          {activeTab.view !== 'leader' && (
            <div className="lg:hidden mb-4">
              <button onClick={() => setSidebarOpen(true)} className="btn btn-secondary w-full">
                🧾 デッキを表示 ({totalCards}/50)
              </button>
            </div>
          )}

          {/* リーダー選択画面 */}
          {activeTab.view === 'leader' && (
            <LeaderSelect
              onSelect={handleSelectLeader}
              onImport={handleImportDeck}
              blankLeaders={activeTab.blankCards.filter(c => c.type === 'LEADER')}
              onCreateBlankLeader={(card) => {
                updateTab(activeTabId, { blankCards: [...activeTab.blankCards, card] });
                setAllCards(prev => [...prev, card]);
              }}
              onEditBlankLeader={(card) => {
                updateTab(activeTabId, { blankCards: activeTab.blankCards.map(c => c.card_id === card.card_id ? card : c) });
                setAllCards(prev => prev.map(c => c.card_id === card.card_id ? card : c));
              }}
              onDeleteBlankLeader={(cardId) => {
                updateTab(activeTabId, { blankCards: activeTab.blankCards.filter(c => c.card_id !== cardId) });
                setAllCards(prev => prev.filter(c => c.card_id !== cardId));
              }}
              existingCardIds={[...allCards.map(c => c.card_id), ...activeTab.blankCards.map(c => c.card_id)]}
            />
          )}

          {/* プレビュー画面 */}
          {activeTab.view === 'preview' && activeTab.leaderCard && (
            <DeckPreview
              deck={activeTab.deck}
              leaderCard={activeTab.leaderCard}
              allCards={[...allCards, ...activeTab.blankCards]}
              onAddCards={() => updateTab(activeTabId, { view: 'add_cards' })}
              onChangeLeader={handleChangeLeader}
              onRemoveCard={handleRemoveCard}
              onAddCard={handleAddCard}
              onEditBlankLeader={(card) => {
                updateTab(activeTabId, { blankCards: activeTab.blankCards.map(c => c.card_id === card.card_id ? card : c), leaderCard: card });
                setAllCards(prev => prev.map(c => c.card_id === card.card_id ? card : c));
              }}
            />
          )}

          {/* カード追加画面 */}
          {activeTab.view === 'add_cards' && activeTab.leaderCard && (
            <div className="flex gap-4">
              <div className="lg:hidden fixed bottom-20 right-4 z-30 flex flex-col gap-2">
                <button onClick={() => setSidebarOpen(true)} className="btn btn-success shadow-lg rounded-full w-14 h-14 flex items-center justify-center relative">
                  🧾
                  <span className={`absolute -top-1 -right-1 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    totalCards === 50 ? 'bg-green-600 text-white' : totalCards > 50 ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                  }`}>{totalCards}</span>
                </button>
                <button onClick={() => setFilterSidebarOpen(true)} className="btn btn-primary shadow-lg rounded-full w-14 h-14 flex items-center justify-center">🔍</button>
              </div>

              {filterSidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setFilterSidebarOpen(false)} />}

              <aside className={`fixed lg:sticky top-0 left-0 w-80 h-screen overflow-y-auto bg-white shadow-lg z-50 transform transition-transform duration-300 ${
                filterSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
              }`} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
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
                    <select value={colsCount} onChange={(e) => setColsCount(Number(e.target.value))} className="w-full border rounded px-3 py-2">
                      {[3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}列{n >= 5 ? '（コンパクト）' : ''}</option>)}
                    </select>
                  </div>
                  <div className="mt-4">
                    <button onClick={() => setShowBlankCardModal(true)} className="w-full btn btn-secondary flex items-center justify-center gap-2">
                      <span>📝</span><span>カードを手動追加</span>
                    </button>
                  </div>
                </div>
              </aside>

              <div className="flex-1">
                <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-lg font-bold">➕ カードを追加</h2>
                    <p className="text-sm text-gray-600">リーダー: {activeTab.leaderCard.name}（{activeTab.leaderCard.color.join('/')}）</p>
                  </div>
                  <button onClick={() => updateTab(activeTabId, { view: 'preview' })} className="btn btn-secondary">🔙 プレビューに戻る</button>
                </div>
                <div className="mb-4"><p className="text-sm text-gray-600">表示中: {filteredCards.length}枚</p></div>
                {loading ? (
                  <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>
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

        {/* サイドバー */}
        {activeTab.view !== 'leader' && (
          <DeckSidebar
            deck={activeTab.deck}
            setDeck={(newDeck) => updateTab(activeTabId, { deck: newDeck })}
            leaderCard={activeTab.leaderCard}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onRemoveCard={handleRemoveCard}
            onAddCard={handleAddCard}
            onPreview={() => updateTab(activeTabId, { view: 'preview' })}
            allCards={[...allCards, ...activeTab.blankCards]}
            blankCards={activeTab.blankCards}
            onEditBlankCard={(card) => { setEditingBlankCard(card); setShowBlankCardModal(true); }}
            onOpenCsvEditor={() => {}}
          />
        )}

        <BlankCardModal
          isOpen={showBlankCardModal}
          onClose={() => { setShowBlankCardModal(false); setEditingBlankCard(null); }}
          onAdd={handleAddBlankCard}
          onUpdate={handleUpdateBlankCard}
          onDelete={handleDeleteBlankCard}
          existingIds={[...allCards.map(c => c.card_id), ...activeTab.blankCards.map(c => c.card_id)]}
          editCard={editingBlankCard}
          availableFeatures={filterMeta?.features || []}
          availableAttributes={filterMeta?.attributes || []}
        />
      </div>

      {/* 一括インポートモーダル */}
      {showBatchImport && (
        <BatchImportModal
          onClose={() => setShowBatchImport(false)}
          onImport={handleBatchImport}
        />
      )}

      {/* 一括エクスポートモーダル */}
      {showBatchExport && (
        <BatchExportModal
          tabs={tabs}
          allCards={allCards}
          onClose={() => setShowBatchExport(false)}
        />
      )}
    </>
  );
}

// 一括インポートモーダル
function BatchImportModal({ onClose, onImport }: { onClose: () => void; onImport: (decks: { name: string; text: string }[]) => void }) {
  const [images, setImages] = useState<File[]>([]);
  const [results, setResults] = useState<{ name: string; text: string; status: string }[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImages(Array.from(e.target.files || []));
    setResults([]);
  };

  const processImages = async () => {
    if (images.length === 0) return;
    setProcessing(true);
    const jsQR = (await import('jsqr')).default;
    const newResults: typeof results = [];

    for (const file of images) {
      try {
        const img = await loadImage(file);
        const text = await extractQR(img, jsQR);
        newResults.push({
          name: file.name.replace(/\.[^.]+$/, ''),
          text: text || '',
          status: text ? '✅ 成功' : '❌ QR検出失敗',
        });
      } catch {
        newResults.push({ name: file.name, text: '', status: '❌ エラー' });
      }
    }
    setResults(newResults);
    setProcessing(false);
  };

  const handleImport = () => {
    const valid = results.filter(r => r.text);
    if (valid.length > 0) {
      onImport(valid);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">📥 デッキ画像一括インポート</h2>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-700">×</button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="block w-full" />
          {images.length > 0 && <p className="text-sm text-gray-600">{images.length}件選択中</p>}
          {images.length > 0 && results.length === 0 && (
            <button onClick={processImages} disabled={processing} className="btn btn-primary w-full">
              {processing ? '処理中...' : '🔍 QRコードを読み取る'}
            </button>
          )}
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className={`p-3 rounded border ${r.text ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex justify-between"><span className="font-medium">{r.name}</span><span className="text-sm">{r.status}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="btn btn-secondary">キャンセル</button>
          {results.filter(r => r.text).length > 0 && (
            <button onClick={handleImport} className="btn btn-primary">{results.filter(r => r.text).length}件をインポート</button>
          )}
        </div>
      </div>
    </div>
  );
}

// 一括エクスポートモーダル
function BatchExportModal({ tabs, allCards, onClose }: { tabs: DeckTab[]; allCards: Card[]; onClose: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const exportJSON = () => {
    const data = tabs.filter(t => t.leaderCard).map(tab => ({
      name: tab.name,
      leader: { card_id: tab.leaderCard!.card_id, name: tab.leaderCard!.name, color: tab.leaderCard!.color },
      cards: Object.entries(tab.deck.cards).map(([cardId, count]) => {
        const card = [...allCards, ...tab.blankCards].find(c => c.card_id === cardId);
        return { card_id: cardId, name: card?.name || cardId, count };
      }),
      total: Object.values(tab.deck.cards).reduce((sum, c) => sum + c, 0),
    }));
    downloadFile(JSON.stringify(data, null, 2), `decks_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  };

  const exportText = async () => {
    const texts: string[] = [];
    for (const tab of tabs.filter(t => t.leaderCard)) {
      try {
        const res = await fetch('/api/deck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'export', deck: tab.deck }) });
        const data = await res.json();
        texts.push(`=== ${tab.name} ===\n${data.text || ''}\n`);
      } catch { texts.push(`=== ${tab.name} ===\nエラー\n`); }
    }
    downloadFile(texts.join('\n'), `decks_${new Date().toISOString().split('T')[0]}.txt`, 'text/plain');
  };

  const exportImages = async () => {
    setExporting(true);
    const { generateDeckImage } = await import('@/lib/imageGenerator');
    const validTabs = tabs.filter(t => t.leaderCard);

    for (let i = 0; i < validTabs.length; i++) {
      const tab = validTabs[i];
      setProgress(((i + 1) / validTabs.length) * 100);
      try {
        const sortRes = await fetch('/api/deck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sort', card_ids: Object.keys(tab.deck.cards) }) });
        const sortData = await sortRes.json();
        const sortedIds = sortData.card_ids_sorted || Object.keys(tab.deck.cards);

        const deckCards: { url: string; card?: Card }[] = [];
        const cardUrls: string[] = [];
        for (const cardId of sortedIds) {
          const card = [...allCards, ...tab.blankCards].find(c => c.card_id === cardId);
          if (!card) continue;
          const count = tab.deck.cards[cardId] || 0;
          for (let j = 0; j < count; j++) {
            cardUrls.push(card.image_url || '');
            deckCards.push({ url: card.image_url || '', card });
          }
        }

        let qrDataUrl = '';
        try {
          const exportRes = await fetch('/api/deck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'export', deck: tab.deck }) });
          const exportData = await exportRes.json();
          if (exportData.text) {
            const qrRes = await fetch(`/api/qr?text=${encodeURIComponent(exportData.text)}`);
            if (qrRes.ok) {
              const blob = await qrRes.blob();
              qrDataUrl = await blobToDataURL(blob);
            }
          }
        } catch {}

        const imageBlob = await generateDeckImage({
          leaderUrl: tab.leaderCard!.image_url || '',
          leaderCard: tab.leaderCard ?? undefined,
          cardUrls,
          cards: deckCards,
          deckName: tab.name || 'デッキ',
          qrDataUrl,
          leaderColors: tab.leaderCard!.color,
        });

        const url = URL.createObjectURL(imageBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tab.name}_${i + 1}.png`;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 500));
      } catch (e) { console.error(`画像生成エラー (${tab.name}):`, e); }
    }
    setExporting(false);
    setProgress(0);
  };

  const validCount = tabs.filter(t => t.leaderCard).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">📤 一括エクスポート</h2>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-700">×</button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">{tabs.length}個のタブ（有効: {validCount}個）</p>
          <button onClick={exportJSON} className="btn btn-primary w-full">📋 JSON形式で出力</button>
          <button onClick={exportText} className="btn btn-secondary w-full">📝 テキスト形式で出力</button>
          <button onClick={exportImages} disabled={exporting || validCount === 0} className="btn btn-success w-full">
            {exporting ? `生成中... ${Math.round(progress)}%` : '🖼️ デッキ画像を一括生成'}
          </button>
          {exporting && <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>}
        </div>
        <div className="p-4 border-t"><button onClick={onClose} className="btn btn-secondary w-full">閉じる</button></div>
      </div>
    </div>
  );
}

// ヘルパー関数
async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function extractQR(img: HTMLImageElement, jsQR: any): Promise<string | null> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  if (code) return code.data;

  // グリッド分割で再試行
  const regions = [
    { x: 0, y: 0, w: 0.3, h: 0.3 },
    { x: 0.7, y: 0, w: 0.3, h: 0.3 },
    { x: 0.35, y: 0, w: 0.3, h: 0.3 },
  ];
  for (const r of regions) {
    const rx = Math.floor(img.width * r.x), ry = Math.floor(img.height * r.y);
    const rw = Math.floor(img.width * r.w), rh = Math.floor(img.height * r.h);
    const regionData = ctx.getImageData(rx, ry, rw, rh);
    const regionCode = jsQR(regionData.data, regionData.width, regionData.height);
    if (regionCode) return regionCode.data;
  }
  return null;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
