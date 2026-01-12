'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Card } from '@/lib/types';

interface WantedCard {
  card: Card;
  count: number;
}

interface WantedCardsContextType {
  wantedCards: WantedCard[];
  addWantedCard: (card: Card, count?: number) => void;
  removeWantedCard: (cardId: string) => void;
  updateWantedCount: (cardId: string, count: number) => void;
  clearWantedCards: () => void;
  getWantedCount: (cardId: string) => number;
  totalWantedCount: number;
}

const WantedCardsContext = createContext<WantedCardsContextType | null>(null);

export function WantedCardsProvider({ children }: { children: ReactNode }) {
  const [wantedCards, setWantedCards] = useState<WantedCard[]>([]);

  const addWantedCard = useCallback((card: Card, count: number = 1) => {
    setWantedCards(prev => {
      const existing = prev.find(w => w.card.card_id === card.card_id);
      if (existing) {
        return prev.map(w => 
          w.card.card_id === card.card_id 
            ? { ...w, count: w.count + count }
            : w
        );
      }
      return [...prev, { card, count }];
    });
  }, []);

  const removeWantedCard = useCallback((cardId: string) => {
    setWantedCards(prev => prev.filter(w => w.card.card_id !== cardId));
  }, []);

  const updateWantedCount = useCallback((cardId: string, count: number) => {
    if (count <= 0) {
      setWantedCards(prev => prev.filter(w => w.card.card_id !== cardId));
    } else {
      setWantedCards(prev => prev.map(w => 
        w.card.card_id === cardId ? { ...w, count } : w
      ));
    }
  }, []);

  const clearWantedCards = useCallback(() => {
    setWantedCards([]);
  }, []);

  const getWantedCount = useCallback((cardId: string) => {
    return wantedCards.find(w => w.card.card_id === cardId)?.count || 0;
  }, [wantedCards]);

  const totalWantedCount = wantedCards.reduce((sum, w) => sum + w.count, 0);

  return (
    <WantedCardsContext.Provider value={{
      wantedCards,
      addWantedCard,
      removeWantedCard,
      updateWantedCount,
      clearWantedCards,
      getWantedCount,
      totalWantedCount,
    }}>
      {children}
    </WantedCardsContext.Provider>
  );
}

export function useWantedCards() {
  const context = useContext(WantedCardsContext);
  if (!context) {
    throw new Error('useWantedCards must be used within a WantedCardsProvider');
  }
  return context;
}

// 必要リストパネルコンポーネント
export function WantedCardsPanel({ onClose }: { onClose: () => void }) {
  const { wantedCards, updateWantedCount, removeWantedCard, clearWantedCards, totalWantedCount } = useWantedCards();

  const downloadList = () => {
    const lines = wantedCards.map(w => `${w.card.card_id}\t${w.card.name}\t${w.count}枚`);
    const header = '=== 必要カードリスト ===\n';
    const total = `\n合計: ${totalWantedCount}枚`;
    const text = header + lines.join('\n') + total;
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wanted_cards_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    const header = 'カードID,カード名,色,タイプ,コスト,必要枚数\n';
    const lines = wantedCards.map(w => 
      `${w.card.card_id},"${w.card.name}","${w.card.color.join('/')}",${w.card.type},${w.card.cost},${w.count}`
    );
    const text = header + lines.join('\n');
    
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wanted_cards_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[90] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-orange-50">
          <div>
            <h2 className="text-lg font-bold">📋 必要カードリスト</h2>
            <p className="text-sm text-gray-600">合計: {totalWantedCount}枚</p>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-700">×</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {wantedCards.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">📝</div>
              <p>必要なカードがありません</p>
              <p className="text-sm mt-1">カード拡大画面から追加できます</p>
            </div>
          ) : (
            <div className="space-y-2">
              {wantedCards.map(w => (
                <div key={w.card.card_id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <div className="w-10 h-14 flex-shrink-0 bg-gray-200 rounded overflow-hidden">
                    {w.card.image_url && (
                      <img src={w.card.image_url} alt={w.card.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{w.card.name}</div>
                    <div className="text-xs text-gray-500">{w.card.card_id}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateWantedCount(w.card.card_id, w.count - 1)}
                      className="w-6 h-6 bg-gray-200 rounded text-sm hover:bg-gray-300"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{w.count}</span>
                    <button
                      onClick={() => updateWantedCount(w.card.card_id, w.count + 1)}
                      className="w-6 h-6 bg-gray-200 rounded text-sm hover:bg-gray-300"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeWantedCard(w.card.card_id)}
                      className="ml-1 text-red-500 hover:text-red-700 text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t space-y-2">
          <div className="flex gap-2">
            <button
              onClick={downloadList}
              disabled={wantedCards.length === 0}
              className="flex-1 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              📥 テキストDL
            </button>
            <button
              onClick={downloadCSV}
              disabled={wantedCards.length === 0}
              className="flex-1 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              📊 CSV DL
            </button>
          </div>
          <button
            onClick={clearWantedCards}
            disabled={wantedCards.length === 0}
            className="w-full py-2 bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            🗑️ リストをクリア
          </button>
        </div>
      </div>
    </div>
  );
}
