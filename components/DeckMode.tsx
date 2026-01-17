'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Deck, FilterOptions, DEFAULT_FILTER_OPTIONS, UNLIMITED_CARDS, COLOR_ORDER } from '@/lib/types';
import FilterPanel from './FilterPanel';
import CardGrid from './CardGrid';
import DeckSidebar from './DeckSidebar';
import DeckPreview from './DeckPreview';
import LeaderSelect from './LeaderSelect';
import BlankCardModal from './BlankCardModal';
import CsvEditorMode from './CsvEditorMode';
import { useWantedCards } from './WantedCardsContext';

type DeckView = 'leader' | 'preview' | 'add_cards' | 'select_don';

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
  rarities: string[];
}

const DECK_STATE_KEY = 'deck_builder_single_deck_state';

export default function DeckMode() {
  // デッキ状態（sessionStorageから復元）
  const [deck, setDeck] = useState<Deck>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(DECK_STATE_KEY);
        if (saved) return JSON.parse(saved).deck || { name: '', leader: '', cards: {} };
      } catch {}
    }
    return { name: '', leader: '', cards: {} };
  });
  const [leaderCard, setLeaderCard] = useState<Card | null>(null);
  const [donCard, setDonCard] = useState<Card | null>(null);  // ドンカード
  
  // 画面状態
  const [view, setView] = useState<DeckView>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(DECK_STATE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.view || (parsed.deck?.leader ? 'preview' : 'leader');
        }
      } catch {}
    }
    return 'leader';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);
  const [csvEditorOpen, setCsvEditorOpen] = useState(false);
  
  // カード検索関連
  const [allCards, setAllCards] = useState<Card[]>([]); // 全カードのキャッシュ
  const [blankCards, setBlankCards] = useState<Card[]>([]); // ブランクカード
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [filter, setFilter] = useState<FilterOptions>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(DECK_STATE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...DEFAULT_FILTER_OPTIONS, types: [], ...parsed.filter };
        }
      } catch {}
    }
    return { ...DEFAULT_FILTER_OPTIONS, types: [] };
  });
  const [filterMeta, setFilterMeta] = useState<FilterMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [colsCount, setColsCount] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(DECK_STATE_KEY);
        if (saved) return JSON.parse(saved).colsCount || 4;
      } catch {}
    }
    return 4;
  });
  const [showBlankCardModal, setShowBlankCardModal] = useState(false);
  const [wantedOnly, setWantedOnly] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  
  // 必要カードリスト & ブックマーク
  const { 
    updateWantedCount, 
    updateOwnedCount, 
    getWantedCount, 
    getOwnedCount, 
    getWantedCardIds,
    bookmarkedCardIds,
    toggleBookmark,
    isBookmarked,
  } = useWantedCards();
  
  // 状態をsessionStorageに保存
  useEffect(() => {
    try {
      sessionStorage.setItem(DECK_STATE_KEY, JSON.stringify({ 
        deck, 
        view: view === 'add_cards' ? 'preview' : view, // add_cardsは保存しない
        filter, 
        colsCount 
      }));
    } catch {}
  }, [deck, view, filter, colsCount]);
  
  // 初回ロード時にリーダーカードを復元
  useEffect(() => {
    if (deck.leader && !leaderCard && allCards.length > 0) {
      const leader = allCards.find(c => c.card_id === deck.leader);
      if (leader) {
        setLeaderCard(leader);
      }
    }
  }, [deck.leader, leaderCard, allCards]);
  
  // 初回ロード時にドンカードを復元
  useEffect(() => {
    if (deck.don && !donCard && allCards.length > 0) {
      const don = allCards.find(c => c.card_id === deck.don);
      if (don) {
        setDonCard(don);
      }
    }
  }, [deck.don, donCard, allCards]);
  
  // 必要リスト・ブックマークフィルター適用
  const displayCards = useMemo(() => {
    let result = filteredCards;
    if (wantedOnly) {
      const wantedIds = getWantedCardIds();
      result = result.filter(c => wantedIds.includes(c.card_id));
    }
    if (bookmarkedOnly) {
      result = result.filter(c => bookmarkedCardIds.includes(c.card_id));
    }
    return result;
  }, [filteredCards, wantedOnly, bookmarkedOnly, getWantedCardIds, bookmarkedCardIds]);
  
  // ブランクカードインポートイベントのリスナー
  useEffect(() => {
    const handleImportBlankCards = (e: CustomEvent<Card[]>) => {
      const newCards = e.detail;
      
      setBlankCards(prev => {
        // 既存のブランクカードIDとallCardsのIDを取得
        const existingIds = new Set([
          ...prev.map(c => c.card_id),
          ...allCards.map(c => c.card_id),
        ]);
        
        // 重複を除外
        const uniqueNewCards = newCards.filter(card => !existingIds.has(card.card_id));
        
        if (uniqueNewCards.length < newCards.length) {
          const skipped = newCards.length - uniqueNewCards.length;
          console.log(`${skipped}件のブランクカードは既に存在するためスキップしました`);
        }
        
        return [...prev, ...uniqueNewCards];
      });
      
      // LEADERタイプ以外のみallCardsに追加（リーダーはブランクリーダーセクションに表示）
      setAllCards(prev => {
        const existingIds = new Set(prev.map(c => c.card_id));
        const uniqueNewCards = newCards.filter(card => 
          !existingIds.has(card.card_id) && card.type !== 'LEADER'
        );
        return [...prev, ...uniqueNewCards];
      });
    };
    
    window.addEventListener('importBlankCards', handleImportBlankCards as EventListener);
    return () => {
      window.removeEventListener('importBlankCards', handleImportBlankCards as EventListener);
    };
  }, [allCards]);
  
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
          rarities: data.rarities || [],
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
      
      // ブランクカードもフィルタして追加（LEADERとDONは除外）
      const filteredBlankCards = blankCards.filter(card => {
        // LEADERタイプとDONタイプは除外
        if (card.type === 'LEADER' || card.type === 'DON') {
          return false;
        }
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
        // フリーワードフィルタ（カード名、ID、特徴、効果テキストを検索）
        if (filterOptions.free_words.trim()) {
          const searchText = `${card.name} ${card.card_id} ${card.features.join(' ')} ${card.text || ''}`.toLowerCase();
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
  
  // ドン選択画面用のカード検索
  const searchDonCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...DEFAULT_FILTER_OPTIONS, types: ['DON'], parallel_mode: 'both' }),
      });
      const data = await res.json();
      setFilteredCards(data.cards || []);
    } catch (error) {
      console.error('DON search error:', error);
      setFilteredCards([]);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // ドン選択画面に入ったらドンカードを検索
  useEffect(() => {
    if (view === 'select_don') {
      searchDonCards();
    }
  }, [view, searchDonCards]);
  
  // リーダー選択（既存カードを保持し、新リーダーの色に合うものだけ残す）
  const handleSelectLeader = (card: Card) => {
    const newLeaderColors = card.color;
    
    // 既存のデッキカードをフィルタリング
    const filteredDeckCards: Record<string, number> = {};
    const removedCards: string[] = [];
    
    Object.entries(deck.cards).forEach(([cardId, count]) => {
      const existingCard = allCards.find(c => c.card_id === cardId) || blankCards.find(c => c.card_id === cardId);
      if (existingCard) {
        // カードの色がリーダーの色に含まれるかチェック
        const hasMatchingColor = existingCard.color.some(c => newLeaderColors.includes(c));
        if (hasMatchingColor) {
          filteredDeckCards[cardId] = count;
        } else {
          removedCards.push(existingCard.name);
        }
      }
    });
    
    // 削除されたカードがあれば通知
    if (removedCards.length > 0) {
      alert(`リーダーの色に合わないカードが除外されました:\n${removedCards.slice(0, 5).join('\n')}${removedCards.length > 5 ? `\n...他${removedCards.length - 5}枚` : ''}`);
    }
    
    setLeaderCard(card);
    setDeck({
      name: deck.name,
      leader: card.card_id,
      cards: filteredDeckCards,
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
  
  // リーダー変更（カードは保持したままリーダー選択画面へ）
  // リーダー情報は保持し、新しいリーダー選択時に更新
  const handleChangeLeader = () => {
    setView('leader');
  };
  
  // リーダー変更キャンセル（元のリーダーのままプレビューに戻る）
  const handleCancelChangeLeader = () => {
    setView('preview');
  };
  
  // ドン選択
  const handleSelectDon = (card: Card) => {
    setDonCard(card);
    setDeck(prev => ({ ...prev, don: card.card_id }));
    setView('preview');
  };
  
  // ドン削除
  const handleRemoveDon = () => {
    setDonCard(null);
    setDeck(prev => ({ ...prev, don: undefined }));
  };
  
  // マルチデッキに追加
  const handleAddToMultiDeck = () => {
    if (!leaderCard || Object.keys(deck.cards).length === 0) {
      alert('デッキにカードを追加してください');
      return;
    }
    
    // 名前ルール: デッキ名があればそのまま、なければ色+リーダー名
    const deckName = deck.name || `${leaderCard.color.join('')}${leaderCard.name}`;
    
    // sessionStorageに保存してMultiDeckModeに渡す
    const deckData = {
      deck: { ...deck, name: deckName },
      leaderCard,
      donCard,
      blankCards: blankCards.filter(c => 
        deck.cards[c.card_id] || c.card_id === deck.leader
      ),
      timestamp: Date.now(),
    };
    sessionStorage.setItem('pendingMultiDeckAdd', JSON.stringify(deckData));
    
    // カスタムイベントでモード切り替えを通知
    window.dispatchEvent(new CustomEvent('switchToMultiDeck'));
    
    alert('マルチデッキに追加しました！\n「マルチデッキ」タブに移動します。');
  };
  
  // デッキインポート（ブランクカードの枚数情報も含む）
  const handleImportDeck = async (text: string) => {
    try {
      // ブランクカード枚数情報を抽出
      // フォーマット: #BLANK:ID=枚数,ID=枚数
      let blankCardCounts: Record<string, number> = {};
      let cleanText = text;
      
      const blankMatch = text.match(/#BLANK:(.+)$/m);
      if (blankMatch) {
        cleanText = text.replace(/\n?#BLANK:.+$/m, '');
        const blankParts = blankMatch[1].split(',');
        blankParts.forEach(part => {
          const [id, countStr] = part.split('=');
          if (id && countStr) {
            blankCardCounts[id.trim()] = parseInt(countStr.trim(), 10) || 0;
          }
        });
        console.log('Blank card counts from QR:', blankCardCounts);
      }
      
      // ドンカード情報を抽出
      // フォーマット: #DON:card_id
      let donCardId: string | null = null;
      const donMatch = cleanText.match(/#DON:([^\n]+)/m);
      if (donMatch) {
        cleanText = cleanText.replace(/\n?#DON:.+$/m, '');
        donCardId = donMatch[1].trim();
        console.log('Don card from import:', donCardId);
      }
      
      // ブランクリーダー情報を抽出
      // フォーマット: #LEADER:B|id|name|type|...
      let blankLeaderFromQR: Card | null = null;
      const leaderMatch = text.match(/#LEADER:(B\|[^\n]+)/m);
      if (leaderMatch) {
        cleanText = cleanText.replace(/\n?#LEADER:.+$/m, '');
        const { decodeBlankCardFromQR } = await import('@/lib/blankCardQR');
        blankLeaderFromQR = decodeBlankCardFromQR(leaderMatch[1]);
        if (blankLeaderFromQR) {
          console.log('Blank leader from QR:', blankLeaderFromQR.name);
        }
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
        // ブランクカードの枚数をデッキに反映
        const deckWithBlankCards = {
          ...data.deck,
          cards: {
            ...data.deck.cards,
            ...blankCardCounts,
          },
        };
        
        // ブランクリーダーの場合はリーダーIDを上書き
        if (blankLeaderFromQR) {
          deckWithBlankCards.leader = blankLeaderFromQR.card_id;
        }
        
        // ドンカードIDを設定
        if (donCardId) {
          deckWithBlankCards.don = donCardId;
        }
        
        setDeck(deckWithBlankCards);
        
        // ドンカード情報を取得して設定
        if (donCardId) {
          let foundDon = allCards.find(c => c.card_id === donCardId);
          if (!foundDon) {
            const donRes = await fetch('/api/cards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...DEFAULT_FILTER_OPTIONS, types: ['DON'], parallel_mode: 'both' }),
            });
            const donData = await donRes.json();
            foundDon = donData.cards?.find((c: Card) => c.card_id === donCardId);
          }
          if (foundDon) {
            setDonCard(foundDon);
          }
        }
        
        // リーダーカード情報を取得
        if (blankLeaderFromQR) {
          // ブランクリーダーをblankCardsにのみ追加（allCardsには追加しない）
          setBlankCards(prev => {
            if (prev.some(c => c.card_id === blankLeaderFromQR!.card_id)) return prev;
            return [...prev, blankLeaderFromQR!];
          });
          setLeaderCard(blankLeaderFromQR);
          setView('preview');
          
          // ブランクカード枚数があれば通知
          if (Object.keys(blankCardCounts).length > 0) {
            const totalBlank = Object.values(blankCardCounts).reduce((sum, c) => sum + c, 0);
            console.log(`Imported ${totalBlank} blank cards`);
          }
        } else if (data.deck.leader) {
          // 通常リーダー: まずキャッシュされたallCardsから検索
          let foundLeader = allCards.find(c => c.card_id === data.deck.leader);
          
          // blankCardsからも検索
          if (!foundLeader) {
            foundLeader = blankCards.find(c => c.card_id === data.deck.leader);
          }
          
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
            
            // ブランクカード枚数があれば通知
            if (Object.keys(blankCardCounts).length > 0) {
              const totalBlank = Object.values(blankCardCounts).reduce((sum, c) => sum + c, 0);
              console.log(`Imported ${totalBlank} blank cards`);
            }
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
    <>
      {/* CSV編集モード */}
      {csvEditorOpen ? (
        <CsvEditorMode
          blankCards={blankCards}
          onClose={() => setCsvEditorOpen(false)}
        />
      ) : (
      <>
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
            onCancel={leaderCard ? handleCancelChangeLeader : undefined}
            blankLeaders={blankCards.filter(c => c.type === 'LEADER')}
            onCreateBlankLeader={(card) => {
              setBlankCards(prev => [...prev, card]);
              setAllCards(prev => [...prev, card]);
            }}
            onEditBlankLeader={(card) => {
              setBlankCards(prev => prev.map(c => c.card_id === card.card_id ? card : c));
              setAllCards(prev => prev.map(c => c.card_id === card.card_id ? card : c));
            }}
            onDeleteBlankLeader={(cardId) => {
              setBlankCards(prev => prev.filter(c => c.card_id !== cardId));
              setAllCards(prev => prev.filter(c => c.card_id !== cardId));
            }}
            existingCardIds={[...allCards.map(c => c.card_id), ...blankCards.map(c => c.card_id)]}
          />
        )}
        
        {/* デッキプレビュー画面 */}
        {view === 'preview' && leaderCard && (
          <>
            {/* マルチデッキ追加ボタン */}
            <div className="mb-4 flex justify-end">
              <button
                onClick={handleAddToMultiDeck}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                📁 マルチデッキに追加
              </button>
            </div>
            
            <DeckPreview
            deck={deck}
            leaderCard={leaderCard}
            donCard={donCard}
            allCards={allCards}
            onAddCards={() => setView('add_cards')}
            onChangeLeader={handleChangeLeader}
            onRemoveCard={handleRemoveCard}
            onAddCard={handleAddCard}
            onSelectDon={() => setView('select_don')}
            onRemoveDon={handleRemoveDon}
            onEditBlankLeader={(card) => {
              // ブランクリーダー編集後に更新
              setBlankCards(prev => prev.map(c => c.card_id === card.card_id ? card : c));
              setAllCards(prev => prev.map(c => c.card_id === card.card_id ? card : c));
              setLeaderCard(card);
            }}
            onUpdateWantedCount={updateWantedCount}
            onUpdateOwnedCount={updateOwnedCount}
            getWantedCount={getWantedCount}
            getOwnedCount={getOwnedCount}
          />
          </>
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
                
                {/* 必要カード・ブックマークフィルター */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    カード絞り込み
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setWantedOnly(!wantedOnly)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        wantedOnly
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      📋 必要カード
                    </button>
                    <button
                      onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        bookmarkedOnly
                          ? 'bg-yellow-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      ★ ブックマーク
                    </button>
                  </div>
                </div>
                
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
                    {Array.from({ length: 15 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}列{n >= 5 ? '（コンパクト）' : ''}</option>
                    ))}
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
                  <h2 className="text-lg font-bold">
                    ➕ カードを追加
                    {wantedOnly && <span className="ml-2 text-sm text-orange-600">（必要リストのみ）</span>}
                  </h2>
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
                  表示中のカード: {displayCards.length} 枚
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
                  cards={displayCards}
                  colsCount={colsCount}
                  onCardClick={handleAddCard}
                  onCardRemove={(card) => handleRemoveCard(card.card_id)}
                  onCardReset={(card) => handleResetCard(card.card_id)}
                  showAddButton={true}
                  getCardCount={(cardId) => deck.cards[cardId] || 0}
                  canAddCard={canAddCard}
                  onUpdateWantedCount={updateWantedCount}
                  onUpdateOwnedCount={updateOwnedCount}
                  getWantedCount={getWantedCount}
                  getOwnedCount={getOwnedCount}
                  showWantedBadge={wantedOnly}
                  isBookmarked={isBookmarked}
                  onToggleBookmark={toggleBookmark}
                />
              )}
            </div>
          </div>
        )}
        
        {/* ドン選択画面 */}
        {view === 'select_don' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">🃏 ドンカードを選択</h2>
              <button
                onClick={() => setView('preview')}
                className="btn btn-secondary"
              >
                ← 戻る
              </button>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {filteredCards.map(card => (
                  <div
                    key={card.card_id}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleSelectDon(card)}
                  >
                    {card.image_url ? (
                      <img
                        src={card.image_url}
                        alt={card.name}
                        className="w-full h-auto rounded shadow"
                      />
                    ) : (
                      <div className="w-full aspect-[5/7] bg-yellow-200 rounded shadow flex items-center justify-center text-xs text-center p-1">
                        {card.name}
                      </div>
                    )}
                    <p className="text-xs text-center mt-1 truncate">{card.name}</p>
                  </div>
                ))}
              </div>
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
          donCard={donCard}
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
          onOpenCsvEditor={() => setCsvEditorOpen(true)}
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
    </>
    )}
    </>
  );
}
