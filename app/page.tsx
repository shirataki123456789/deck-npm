'use client';

import { useState } from 'react';
import SearchMode from '@/components/SearchMode';
import DeckMode from '@/components/DeckMode';

type Mode = 'search' | 'deck';

export default function Home() {
  const [mode, setMode] = useState<Mode>('search');
  
  return (
    <div className="min-h-screen">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">
              🏴‍☠️ ワンピースカード デッキビルダー
            </h1>
            
            {/* モード切替 */}
            <div className="flex gap-2">
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
    </div>
  );
}
