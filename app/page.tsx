'use client';

import { useState } from 'react';
import SearchMode from '@/components/SearchMode';
import DeckMode from '@/components/DeckMode';
import MultiDeckMode from '@/components/MultiDeckMode';

type Mode = 'search' | 'deck' | 'multi';

export default function Home() {
  const [mode, setMode] = useState<Mode>('search');
  
  // マルチデッキモードは全画面表示
  if (mode === 'multi') {
    return (
      <div className="min-h-screen flex flex-col">
        {/* マルチデッキ用ヘッダー（モード切替のみ） */}
        <div className="bg-gray-800 px-2 py-1 flex items-center gap-2">
          <button
            onClick={() => setMode('search')}
            className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
          >
            🔍 検索
          </button>
          <button
            onClick={() => setMode('deck')}
            className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
          >
            🧱 通常
          </button>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-white font-medium">🗂️ マルチデッキ編集中</span>
        </div>
        <div className="flex-1">
          <MultiDeckMode />
        </div>
      </div>
    );
  }
  
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
        </div>
      </nav>
    </div>
  );
}