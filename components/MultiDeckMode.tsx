'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Deck, FilterOptions, DEFAULT_FILTER_OPTIONS, UNLIMITED_CARDS, COLOR_PRIORITY } from '@/lib/types';
import FilterPanel from './FilterPanel';
import CardGrid from './CardGrid';
import DeckSidebar from './DeckSidebar';
import DeckPreview from './DeckPreview';
import LeaderSelect from './LeaderSelect';
import BlankCardModal from './BlankCardModal';
import { useWantedCards } from './WantedCardsContext';

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
  const [showGridView, setShowGridView] = useState(false);
  const [gridColorFilter, setGridColorFilter] = useState<string[]>([]);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

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

  // 必要カードリスト
  const { addWantedCard, getWantedCount } = useWantedCards();

  // アクティブなタブ
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const activeTabIndex = tabs.findIndex(t => t.id === activeTabId);

  // デッキナビゲーション
  const goToPrevDeck = () => {
    if (activeTabIndex > 0) {
      setActiveTabId(tabs[activeTabIndex - 1].id);
    }
  };

  const goToNextDeck = () => {
    if (activeTabIndex < tabs.length - 1) {
      setActiveTabId(tabs[activeTabIndex + 1].id);
    }
  };

  // ドラッグ&ドロップ
  const handleDragStart = (tabId: string) => {
    setDraggedTabId(tabId);
  };

  const handleDragOver = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    if (!draggedTabId || draggedTabId === targetTabId) return;
    
    setTabs(prev => {
      const draggedIndex = prev.findIndex(t => t.id === draggedTabId);
      const targetIndex = prev.findIndex(t => t.id === targetTabId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      const newTabs = [...prev];
      const [draggedTab] = newTabs.splice(draggedIndex, 1);
      newTabs.splice(targetIndex, 0, draggedTab);
      return newTabs;
    });
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
  };

  // 色フィルター定義
  const colorOptions = [
    { value: '赤', label: '赤', bgClass: 'bg-red-500' },
    { value: '青', label: '青', bgClass: 'bg-blue-500' },
    { value: '緑', label: '緑', bgClass: 'bg-green-500' },
    { value: '紫', label: '紫', bgClass: 'bg-purple-500' },
    { value: '黒', label: '黒', bgClass: 'bg-gray-800' },
    { value: '黄', label: '黄', bgClass: 'bg-yellow-400' },
  ];

  // グリッドビュー用のフィルター済みタブ
  const filteredTabs = gridColorFilter.length === 0
    ? tabs
    : tabs.filter(tab => {
        if (!tab.leaderCard) return false;
        return tab.leaderCard.color.some(c => gridColorFilter.includes(c));
      });

  // タブの並べ替え
  const moveTab = (tabId: string, direction: 'left' | 'right') => {
    setTabs(prev => {
      const index = prev.findIndex(t => t.id === tabId);
      if (index === -1) return prev;
      
      const newIndex = direction === 'left' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      
      const newTabs = [...prev];
      [newTabs[index], newTabs[newIndex]] = [newTabs[newIndex], newTabs[index]];
      return newTabs;
    });
  };

  // タブを整頓（カード検索と同じルールでソート）
  const sortTabs = () => {
    setTabs(prev => {
      return [...prev].sort((a, b) => {
        // リーダーがないタブは後ろ
        if (!a.leaderCard && !b.leaderCard) return 0;
        if (!a.leaderCard) return 1;
        if (!b.leaderCard) return -1;

        // 1) 色の優先度（最初の色で比較）
        const getColorPriority = (card: Card) => {
          if (card.color.length === 0) return 999;
          for (const color of card.color) {
            if (color in COLOR_PRIORITY) return COLOR_PRIORITY[color];
          }
          return 999;
        };

        const colorA = getColorPriority(a.leaderCard);
        const colorB = getColorPriority(b.leaderCard);
        if (colorA !== colorB) return colorA - colorB;

        // 2) 複数色は単色の後
        if (a.leaderCard.color.length !== b.leaderCard.color.length) {
          return a.leaderCard.color.length - b.leaderCard.color.length;
        }

        // 3) 2色目の優先度（複数色の場合）
        if (a.leaderCard.color.length > 1 && b.leaderCard.color.length > 1) {
          const subColorA = a.leaderCard.color.length > 1 ? (COLOR_PRIORITY[a.leaderCard.color[1]] ?? 999) : 999;
          const subColorB = b.leaderCard.color.length > 1 ? (COLOR_PRIORITY[b.leaderCard.color[1]] ?? 999) : 999;
          if (subColorA !== subColorB) return subColorA - subColorB;
        }

        // 4) カードID
        return a.leaderCard.card_id.localeCompare(b.leaderCard.card_id);
      });
    });
  };

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
    const defaultName = `${card.color.join('')}${card.name}`;
    updateTab(activeTabId, {
      leaderCard: card,
      deck: { name: defaultName, leader: card.card_id, cards: {} },
      view: 'preview',
      name: defaultName,
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

        // デッキ名があればタブ名を更新、なければ色+リーダー名
        let deckName = data.deck.name || '';

        if (blankLeaderFromQR) {
          deckWithBlankCards.leader = blankLeaderFromQR.card_id;
          const newBlankCards = activeTab.blankCards.some(c => c.card_id === blankLeaderFromQR!.card_id)
            ? activeTab.blankCards
            : [...activeTab.blankCards, blankLeaderFromQR];
          
          // デッキ名がなければ色+リーダー名を生成
          if (!deckName) {
            deckName = `${blankLeaderFromQR.color.join('')}${blankLeaderFromQR.name}`;
            deckWithBlankCards.name = deckName;
          }
          
          updateTab(activeTabId, {
            deck: deckWithBlankCards,
            leaderCard: blankLeaderFromQR,
            view: 'preview',
            blankCards: newBlankCards,
            name: deckName,
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
            // デッキ名がなければ色+リーダー名を生成
            if (!deckName) {
              deckName = `${foundLeader.color.join('')}${foundLeader.name}`;
              deckWithBlankCards.name = deckName;
            }
            
            updateTab(activeTabId, {
              deck: deckWithBlankCards,
              leaderCard: foundLeader,
              view: 'preview',
              name: deckName,
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
    // インポート前に未編集タブをフィルタ（リーダー未選択のタブを除外）
    const existingValidTabs = tabs.filter(t => t.leaderCard !== null);
    const newTabs: DeckTab[] = [];
    
    for (const { name: fileName, text } of deckTexts) {
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

          // デッキ名: deck.name → 色+リーダー名 → ファイル名
          let tabName = data.deck.name || '';
          if (!tabName && leaderCard) {
            tabName = `${leaderCard.color.join('')}${leaderCard.name}`;
          }
          if (!tabName) {
            tabName = fileName;
          }
          deckWithBlankCards.name = tabName;

          const newTab: DeckTab = {
            id: generateTabId(),
            name: tabName,
            deck: deckWithBlankCards,
            leaderCard,
            view: leaderCard ? 'preview' : 'leader',
            blankCards: blankLeaderFromQR ? [blankLeaderFromQR] : [],
          };
          newTabs.push(newTab);
        }
      } catch (error) {
        console.error(`Import error for ${fileName}:`, error);
      }
    }
    
    // 既存の有効なタブ + 新しいタブをセット
    if (newTabs.length > 0) {
      const allTabs = [...existingValidTabs, ...newTabs];
      setTabs(allTabs);
      setActiveTabId(newTabs[0].id);
    }
  };

  // JSONインポート
  const handleJSONImport = async (jsonData: any[]) => {
    // インポート前に未編集タブをフィルタ（リーダー未選択のタブを除外）
    const existingValidTabs = tabs.filter(t => t.leaderCard !== null);
    const newTabs: DeckTab[] = [];
    
    for (const item of jsonData) {
      try {
        // リーダーを検索
        let leaderCard: Card | null = null;
        if (item.leader?.card_id) {
          leaderCard = allCards.find(c => c.card_id === item.leader.card_id) || null;
          if (!leaderCard) {
            const leaderRes = await fetch('/api/cards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...DEFAULT_FILTER_OPTIONS, types: ['LEADER'], parallel_mode: 'both' }),
            });
            const leaderData = await leaderRes.json();
            leaderCard = leaderData.cards?.find((c: Card) => c.card_id === item.leader.card_id) || null;
          }
        }

        // デッキ名: item.name → 色+リーダー名 → デフォルト
        let tabName = item.name || '';
        if (!tabName && leaderCard) {
          tabName = `${leaderCard.color.join('')}${leaderCard.name}`;
        }
        if (!tabName) {
          tabName = `デッキ${existingValidTabs.length + newTabs.length + 1}`;
        }

        // カード枚数を構築
        const cards: Record<string, number> = {};
        if (item.cards && Array.isArray(item.cards)) {
          for (const cardItem of item.cards) {
            if (cardItem.card_id && cardItem.count) {
              cards[cardItem.card_id] = cardItem.count;
            }
          }
        }

        const newTab: DeckTab = {
          id: generateTabId(),
          name: tabName,
          deck: {
            name: tabName,
            leader: item.leader?.card_id || '',
            cards,
          },
          leaderCard,
          view: leaderCard ? 'preview' : 'leader',
          blankCards: [],
        };
        newTabs.push(newTab);
      } catch (error) {
        console.error(`JSON import error:`, error);
      }
    }
    
    // 既存の有効なタブ + 新しいタブをセット
    if (newTabs.length > 0) {
      const allTabs = [...existingValidTabs, ...newTabs];
      setTabs(allTabs);
      setActiveTabId(newTabs[0].id);
    }
  };

  const totalCards = Object.values(activeTab.deck.cards).reduce((sum, c) => sum + c, 0);

  // 選択中タブのインデックス
  const activeTabIndex = tabs.findIndex(t => t.id === activeTabId);

  return (
    <>
      {/* ツールバー（携帯でも見やすいように2段構成） */}
      <div className="bg-gray-100 border-b">
        {/* 上段: 操作ボタン */}
        <div className="px-2 py-1.5 flex items-center gap-1 border-b border-gray-200">
          <button
            onClick={() => setShowGridView(!showGridView)}
            className={`px-2 py-1.5 text-xs rounded ${showGridView ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            title="グリッド一覧"
          >
            {showGridView ? '📋 タブ表示' : '🔲 一覧'}
          </button>
          <button onClick={addTab} className="px-2 py-1.5 text-xs bg-gray-200 text-gray-700 hover:bg-gray-300 rounded" title="新しいデッキ">＋ 追加</button>
          {/* 並べ替えボタン */}
          {!showGridView && tabs.length > 1 && (
            <div className="flex items-center gap-0.5 ml-1">
              <button
                onClick={() => moveTab(activeTabId, 'left')}
                disabled={activeTabIndex === 0}
                className={`px-1.5 py-1 text-xs rounded ${
                  activeTabIndex === 0
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="左へ移動"
              >
                ◀
              </button>
              <button
                onClick={() => moveTab(activeTabId, 'right')}
                disabled={activeTabIndex === tabs.length - 1}
                className={`px-1.5 py-1 text-xs rounded ${
                  activeTabIndex === tabs.length - 1
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="右へ移動"
              >
                ▶
              </button>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setShowBatchImport(true)} className="px-2 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">📥 読込</button>
            <button onClick={() => setShowBatchExport(true)} className="px-2 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600">📤 出力</button>
          </div>
        </div>
        {/* 下段: タブ一覧（グリッドモード以外で表示） */}
        {!showGridView && (
          <div className="px-2 py-1.5 flex items-center gap-1 overflow-x-auto">
            {tabs.map(tab => {
              const tabTotal = Object.values(tab.deck.cards).reduce((sum, c) => sum + c, 0);
              return (
                <div
                  key={tab.id}
                  draggable
                  onDragStart={() => handleDragStart(tab.id)}
                  onDragOver={(e) => handleDragOver(e, tab.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setActiveTabId(tab.id)}
                  onDoubleClick={() => renameTab(tab.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer select-none whitespace-nowrap text-xs ${
                    activeTabId === tab.id
                      ? 'bg-white border border-gray-300 font-medium shadow-sm'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                  } ${draggedTabId === tab.id ? 'opacity-50' : ''}`}
                  }`}
                >
                  <span className="max-w-[100px] truncate">{tab.name}</span>
                  {tab.leaderCard && (
                    <span className={`px-1 rounded ${
                      tabTotal === 50 ? 'bg-green-500 text-white' :
                      tabTotal > 50 ? 'bg-red-500 text-white' : 'bg-gray-400 text-white'
                    }`}>{tabTotal}</span>
                  )}
                  {tabs.length > 1 && (
                    <button onClick={(e) => removeTab(tab.id, e)} className="text-gray-400 hover:text-red-500 ml-1">×</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* グリッド一覧モード */}
      {showGridView ? (
        <div className="p-4">
          {/* 色フィルター */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">色で絞込:</span>
            {colorOptions.map(color => (
              <button
                key={color.value}
                onClick={() => {
                  setGridColorFilter(prev =>
                    prev.includes(color.value)
                      ? prev.filter(c => c !== color.value)
                      : [...prev, color.value]
                  );
                }}
                className={`w-7 h-7 rounded-full border-2 ${color.bgClass} ${
                  gridColorFilter.includes(color.value)
                    ? 'border-white ring-2 ring-offset-1 ring-gray-400'
                    : 'border-transparent opacity-50 hover:opacity-100'
                }`}
                title={color.label}
              />
            ))}
            {gridColorFilter.length > 0 && (
              <button
                onClick={() => setGridColorFilter([])}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                クリア
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={sortTabs}
                className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                title="色順に整頓"
              >
                🔄 整頓
              </button>
              <span className="text-xs text-gray-500">
                {filteredTabs.length}/{tabs.length}件
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredTabs.map((tab, index) => {
              const tabTotal = Object.values(tab.deck.cards).reduce((sum, c) => sum + c, 0);
              const originalIndex = tabs.findIndex(t => t.id === tab.id);
              return (
                <div
                  key={tab.id}
                  draggable
                  onDragStart={() => handleDragStart(tab.id)}
                  onDragOver={(e) => handleDragOver(e, tab.id)}
                  onDragEnd={handleDragEnd}
                  className={`relative cursor-pointer rounded-lg border-2 overflow-hidden hover:shadow-lg transition-shadow ${
                    activeTabId === tab.id ? 'border-blue-500' : 'border-gray-200'
                  } ${draggedTabId === tab.id ? 'opacity-50' : ''}`}
                >
                  {/* 並べ替えボタン */}
                  <div className="absolute top-1 left-1 right-1 flex justify-between z-10">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveTab(tab.id, 'left'); }}
                      disabled={originalIndex === 0}
                      className={`w-6 h-6 rounded bg-black/50 text-white text-xs flex items-center justify-center ${
                        originalIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/70'
                      }`}
                    >
                      ◀
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveTab(tab.id, 'right'); }}
                      disabled={originalIndex === tabs.length - 1}
                      className={`w-6 h-6 rounded bg-black/50 text-white text-xs flex items-center justify-center ${
                        originalIndex === tabs.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/70'
                      }`}
                    >
                      ▶
                    </button>
                  </div>
                  
                  {/* リーダー画像または空の表示 */}
                  <div
                    onClick={() => { setActiveTabId(tab.id); setShowGridView(false); }}
                    className="aspect-[7/10] bg-gray-100 flex items-center justify-center"
                  >
                    {tab.leaderCard?.image_url ? (
                      <img src={tab.leaderCard.image_url} alt={tab.leaderCard.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-gray-400 text-center p-2">
                        <div className="text-3xl mb-1">📝</div>
                        <div className="text-xs">未選択</div>
                      </div>
                    )}
                  </div>
                  {/* デッキ情報 */}
                  <div className="p-2 bg-white">
                    <div className="text-xs font-medium truncate">{tab.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        tabTotal === 50 ? 'bg-green-500 text-white' :
                        tabTotal > 50 ? 'bg-red-500 text-white' :
                        tabTotal > 0 ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {tabTotal}/50
                      </span>
                      {tabs.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeTab(tab.id, e); }}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* 新規追加カード */}
            <div
              onClick={addTab}
              className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 flex flex-col items-center justify-center aspect-[7/10] bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="text-3xl text-gray-400">＋</div>
              <div className="text-xs text-gray-500 mt-1">新規追加</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex">
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
              onPrevDeck={goToPrevDeck}
              onNextDeck={goToNextDeck}
              hasPrevDeck={activeTabIndex > 0}
              hasNextDeck={activeTabIndex < tabs.length - 1}
              currentDeckIndex={activeTabIndex}
              totalDecks={tabs.length}
              onAddToWanted={addWantedCard}
              getWantedCount={getWantedCount}
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
                    onAddToWanted={addWantedCard}
                    getWantedCount={getWantedCount}
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
            setDeck={(newDeck) => {
              // デッキ名が変更されたらタブ名も同期
              const updates: Partial<DeckTab> = { deck: newDeck };
              if (newDeck.name && newDeck.name !== activeTab.deck.name) {
                updates.name = newDeck.name;
              }
              updateTab(activeTabId, updates);
            }}
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
      )}

      {/* 一括インポートモーダル */}
      {showBatchImport && (
        <BatchImportModal
          onClose={() => setShowBatchImport(false)}
          onImport={handleBatchImport}
          onJSONImport={handleJSONImport}
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
function BatchImportModal({ onClose, onImport, onJSONImport }: { 
  onClose: () => void; 
  onImport: (decks: { name: string; text: string }[]) => void;
  onJSONImport: (jsonData: any[]) => void;
}) {
  const [mode, setMode] = useState<'image' | 'json'>('image');
  const [images, setImages] = useState<File[]>([]);
  const [results, setResults] = useState<{ name: string; text: string; status: string }[]>([]);
  const [processing, setProcessing] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // JSONファイルかどうかチェック
    if (files.length === 1 && files[0].name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setJsonText(e.target?.result as string || '');
        setMode('json');
      };
      reader.readAsText(files[0]);
      return;
    }
    
    setImages(files);
    setResults([]);
    setMode('image');
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

  const handleJSONImport = () => {
    try {
      const data = JSON.parse(jsonText);
      if (!Array.isArray(data)) {
        setJsonError('JSONは配列形式である必要があります');
        return;
      }
      onJSONImport(data);
      onClose();
    } catch (e) {
      setJsonError('JSONの解析に失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">📥 一括インポート</h2>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-700">×</button>
        </div>

        {/* モード切替タブ */}
        <div className="flex border-b">
          <button
            onClick={() => setMode('image')}
            className={`flex-1 py-2 text-sm font-medium ${mode === 'image' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          >
            🖼️ 画像からQR読取
          </button>
          <button
            onClick={() => setMode('json')}
            className={`flex-1 py-2 text-sm font-medium ${mode === 'json' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          >
            📋 JSONインポート
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {mode === 'image' ? (
            <>
              <input type="file" accept="image/*,.json" multiple onChange={handleFileSelect} className="block w-full" />
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
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                一括出力で生成したJSONファイルを貼り付けるか、ファイルを選択してください
              </p>
              <textarea
                value={jsonText}
                onChange={(e) => { setJsonText(e.target.value); setJsonError(''); }}
                placeholder='[{"name": "デッキ名", "leader": {"card_id": "OP01-001"}, "cards": [{"card_id": "OP01-004", "count": 4}]}]'
                className="w-full h-48 border rounded p-2 text-sm font-mono"
              />
              {jsonError && <p className="text-red-500 text-sm">{jsonError}</p>}
              <input type="file" accept=".json" onChange={handleFileSelect} className="block w-full text-sm" />
            </>
          )}
        </div>

        <div className="p-4 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="btn btn-secondary">キャンセル</button>
          {mode === 'image' && results.filter(r => r.text).length > 0 && (
            <button onClick={handleImport} className="btn btn-primary">{results.filter(r => r.text).length}件をインポート</button>
          )}
          {mode === 'json' && jsonText.trim() && (
            <button onClick={handleJSONImport} className="btn btn-primary">JSONをインポート</button>
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
      name: tab.deck.name || tab.name || 'デッキ',
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
        const deckName = tab.deck.name || tab.name || 'デッキ';
        texts.push(`=== ${deckName} ===\n${data.text || ''}\n`);
      } catch { texts.push(`=== ${tab.deck.name || tab.name || 'デッキ'} ===\nエラー\n`); }
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
          deckName: tab.deck.name || tab.name || 'デッキ',
          qrDataUrl,
          leaderColors: tab.leaderCard!.color,
        });

        // ファイル名: デッキ名_シリーズ名（リーダーIDから取得）
        const seriesMatch = tab.leaderCard!.card_id.match(/^([A-Z]+\d+)/);
        const seriesName = seriesMatch ? seriesMatch[1] : '';
        const deckNameForFile = tab.deck.name || tab.name || 'デッキ';
        const safeDeckName = deckNameForFile.replace(/[\\/:*?"<>|]/g, '_');
        const fileName = seriesName ? `${safeDeckName}_${seriesName}.png` : `${safeDeckName}.png`;

        const url = URL.createObjectURL(imageBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
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
