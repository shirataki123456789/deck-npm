'use client';

import { useState } from 'react';
import SearchMode from '@/components/SearchMode';
import DeckMode from '@/components/DeckMode';

type Mode = 'search' | 'deck';

export default function Home() {
  const [mode, setMode] = useState<Mode>('search');
  
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
            </div>
          </div>
        </div>
      </header>
      
      {/* メインコンテンツ */}
      <main>
        {mode === 'search' ? <SearchMode /> : <DeckMode />}
      </main>
      
      {/* モバイル用固定フッターナビ */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 safe-area-bottom">
        <div className="flex">
          <button
            onClick={() => setMode('search')}
            className={`flex-1 py-4 text-center font-medium transition-colors ${
              mode === 'search'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            🔍 カード検索
          </button>
          <button
            onClick={() => setMode('deck')}
            className={`flex-1 py-4 text-center font-medium transition-colors ${
              mode === 'deck'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            🧱 デッキ作成
          </button>
        </div>
      </nav>
    </div>
  );
}