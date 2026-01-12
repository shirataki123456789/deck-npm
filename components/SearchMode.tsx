'use client';

import { useState, useEffect, useCallback } from 'react';
import FilterPanel from './FilterPanel';
import CardGrid from './CardGrid';
import { Card, FilterOptions, DEFAULT_FILTER_OPTIONS } from '@/lib/types';
import { useWantedCards } from './WantedCardsContext';

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

export default function SearchMode() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterOptions>(DEFAULT_FILTER_OPTIONS);
  const [filterMeta, setFilterMeta] = useState<FilterMeta | null>(null);
  const [colsCount, setColsCount] = useState(4);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // 必要カードリスト
  const { updateWantedCount, getWantedCount } = useWantedCards();
  
  // フィルタメタデータを取得
  useEffect(() => {
    fetch('/api/cards')
      .then(res => res.json())
      .then(data => {
        setFilterMeta({
          colors: data.colors || [],
          types: data.types || [],
          costs: data.costs || [],
          counters: data.counters || [],
          powers: data.powers || [],
          attributes: data.attributes || [],
          blocks: data.blocks || [],
          features: data.features || [],
          seriesIds: data.seriesIds || [],
        });
      })
      .catch(console.error);
  }, []);
  
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
      setCards(data.cards || []);
    } catch (error) {
      console.error('Search error:', error);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // フィルタ変更時に検索
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCards(filter);
    }, 300);
    return () => clearTimeout(timer);
  }, [filter, searchCards]);
  
  return (
    <div className="flex">
      {/* モバイル用サイドバーオーバーレイ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* サイドバー（フィルタ） */}
      <aside
        className={`
          fixed lg:sticky top-0 right-0 lg:left-0
          w-80 h-screen overflow-y-auto
          bg-white shadow-lg z-50
          transform transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="p-4 pb-32 lg:pb-4">
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <h2 className="font-bold text-lg">フィルタ</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              ✕
            </button>
          </div>
          
          {filterMeta && (
            <FilterPanel
              filter={filter}
              onChange={setFilter}
              meta={filterMeta}
            />
          )}
          
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
              <option value={3}>3列</option>
              <option value={4}>4列</option>
              <option value={5}>5列（コンパクト）</option>
              <option value={6}>6列（コンパクト）</option>
              <option value={7}>7列（コンパクト）</option>
              <option value={8}>8列（コンパクト）</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              5列以上は画像のみ表示
            </p>
          </div>
        </div>
      </aside>
      
      {/* メインコンテンツ */}
      <div className="flex-1 p-4">
        {/* モバイル用フィルタボタン（丸アイコン） */}
        <div className="lg:hidden fixed bottom-20 right-4 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="btn btn-primary shadow-lg rounded-full w-14 h-14 flex items-center justify-center text-xl"
          >
            🔍
          </button>
        </div>
        
        {/* 検索結果 */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            🔍 カード検索
          </h2>
          <span className="text-gray-600">
            該当カード数: {cards.length} 枚
          </span>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : (
          <CardGrid
            cards={cards}
            colsCount={colsCount}
            onUpdateWantedCount={updateWantedCount}
            getWantedCount={getWantedCount}
          />
        )}
      </div>
    </div>
  );
}