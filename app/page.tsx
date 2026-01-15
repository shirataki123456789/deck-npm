'use client';

import { useState, useEffect } from 'react';
import SearchMode from '@/components/SearchMode';
import DeckMode from '@/components/DeckMode';
import MultiDeckMode from '@/components/MultiDeckMode';
import { WantedCardsProvider, WantedCardsPanel, useWantedCards } from '@/components/WantedCardsContext';

type Mode = 'search' | 'deck' | 'multi';

function WantedCardsButton({ onClick }: { onClick: () => void }) {
  const { totalWantedCount } = useWantedCards();
  
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 flex items-center gap-1"
    >
      📋 <span className="hidden sm:inline">必要リスト</span>
      {totalWantedCount > 0 && (
        <span className="bg-orange-700 px-1.5 py-0.5 rounded text-xs">{totalWantedCount}</span>
      )}
    </button>
  );
}

function HomeContent() {
  const [mode, setMode] = useState<Mode>('search');
  const [showWantedPanel, setShowWantedPanel] = useState(false);
  const { totalWantedCount } = useWantedCards();

  // DeckModeからのモード切り替えイベントをリッスン
  useEffect(() => {
    const handleSwitchToMultiDeck = () => {
      setMode('multi');
    };
    
    window.addEventListener('switchToMultiDeck', handleSwitchToMultiDeck);
    return () => window.removeEventListener('switchToMultiDeck', handleSwitchToMultiDeck);
  }, []);

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base sm:text-xl font-bold text-gray-800 truncate">
              🏴‍☠️ <span className="hidden sm:inline">ワンピースカード</span> デッキビルダー
            </h1>
            
            {/* モード切替（PC用） */}
            <div className="hidden sm:flex gap-2">
              <button
                onClick={() => setMode('search')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  mode === 'search'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🔍 カード検索
              </button>
              <button
                onClick={() => setMode('deck')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  mode === 'deck'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🧱 デッキ作成
              </button>
              <button
                onClick={() => setMode('multi')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  mode === 'multi'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🗂️ マルチデッキ
              </button>
              <WantedCardsButton onClick={() => setShowWantedPanel(true)} />
            </div>
          </div>
        </div>
      </header>
      
      {/* メインコンテンツ */}
      <main>
        {mode === 'search' && <SearchMode />}
        {mode === 'deck' && <DeckMode />}
        {mode === 'multi' && <MultiDeckMode />}
      </main>
      
      {/* モバイル用固定フッターナビ */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 safe-area-bottom">
        <div className="flex">
          <button
            onClick={() => setMode('search')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              mode === 'search'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <div className="text-lg">🔍</div>
            <div className="text-xs">検索</div>
          </button>
          <button
            onClick={() => setMode('deck')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              mode === 'deck'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <div className="text-lg">🧱</div>
            <div className="text-xs">デッキ</div>
          </button>
          <button
            onClick={() => setMode('multi')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              mode === 'multi'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <div className="text-lg">🗂️</div>
            <div className="text-xs">マルチ</div>
          </button>
          <button
            onClick={() => setShowWantedPanel(true)}
            className="flex-1 py-3 text-center font-medium transition-colors bg-orange-500 text-white relative"
          >
            <div className="text-lg">📋</div>
            <div className="text-xs">必要リスト</div>
            {totalWantedCount > 0 && (
              <span className="absolute top-1 right-2 bg-orange-700 text-white text-[10px] px-1 rounded-full">
                {totalWantedCount}
              </span>
            )}
          </button>
        </div>
      </nav>
      
      {/* 必要カードリストパネル */}
      {showWantedPanel && (
        <WantedCardsPanel onClose={() => setShowWantedPanel(false)} />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <WantedCardsProvider>
      <HomeContent />
    </WantedCardsProvider>
  );
}
