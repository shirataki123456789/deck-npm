'use client';

import { FilterOptions, COLOR_ORDER } from '@/lib/types';

interface FilterMeta {
  colors: string[];
  types: string[];
  costs: number[];
  counters: number[];
  attributes: string[];
  blocks: string[];
  features: string[];
  seriesIds: string[];
}

interface FilterPanelProps {
  filter: FilterOptions;
  onChange: (filter: FilterOptions) => void;
  meta: FilterMeta;
  hideLeaderColors?: boolean;
}

export default function FilterPanel({
  filter,
  onChange,
  meta,
  hideLeaderColors = true,
}: FilterPanelProps) {
  
  const toggleArrayItem = <T,>(arr: T[], item: T): T[] => {
    if (arr.includes(item)) {
      return arr.filter(x => x !== item);
    }
    return [...arr, item];
  };
  
  const updateFilter = (partial: Partial<FilterOptions>) => {
    onChange({ ...filter, ...partial });
  };
  
  return (
    <div className="space-y-4">
      {/* パラレルモード */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          カードバージョン
        </label>
        <div className="flex gap-1">
          {(['normal', 'parallel', 'both'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => updateFilter({ parallel_mode: mode })}
              className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                filter.parallel_mode === mode
                  ? 'bg-yellow-500 text-white border-yellow-500'
                  : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              {mode === 'normal' ? '通常のみ' : mode === 'parallel' ? 'パラレルのみ' : '両方'}
            </button>
          ))}
        </div>
      </div>
      
      {/* 色 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          色
        </label>
        <div className="flex flex-wrap gap-1">
          {COLOR_ORDER.map(color => (
            <button
              key={color}
              onClick={() => updateFilter({ colors: toggleArrayItem(filter.colors, color) })}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                filter.colors.includes(color)
                  ? `color-badge-${color}`
                  : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              {color}
            </button>
          ))}
        </div>
      </div>
      
      {/* タイプ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          タイプ
        </label>
        <div className="flex flex-wrap gap-1">
          {meta.types.map(type => (
            <button
              key={type}
              onClick={() => updateFilter({ types: toggleArrayItem(filter.types, type) })}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                filter.types.includes(type)
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
      
      {/* コスト */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          コスト
        </label>
        <div className="flex flex-wrap gap-1">
          {meta.costs.slice(0, 11).map(cost => (
            <button
              key={cost}
              onClick={() => updateFilter({ costs: toggleArrayItem(filter.costs, cost) })}
              className={`w-8 h-8 text-sm rounded border transition-colors ${
                filter.costs.includes(cost)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cost}
            </button>
          ))}
          {filter.costs.length > 0 && (
            <button
              onClick={() => updateFilter({ costs: [] })}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              クリア
            </button>
          )}
        </div>
      </div>
      
      {/* カウンター */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          カウンター
        </label>
        <div className="flex flex-wrap gap-1">
          {meta.counters.map(counter => (
            <button
              key={counter}
              onClick={() => updateFilter({ counters: toggleArrayItem(filter.counters, counter) })}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                filter.counters.includes(counter)
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              {counter}
            </button>
          ))}
        </div>
      </div>
      
      {/* 属性 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          属性
        </label>
        <div className="flex flex-wrap gap-1">
          {meta.attributes.map(attr => (
            <button
              key={attr}
              onClick={() => updateFilter({ attributes: toggleArrayItem(filter.attributes, attr) })}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                filter.attributes.includes(attr)
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              {attr}
            </button>
          ))}
        </div>
      </div>
      
      {/* ブロックアイコン */}
      {meta.blocks.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ブロックアイコン
          </label>
          <div className="flex flex-wrap gap-1">
            {meta.blocks.map(block => (
              <button
                key={block}
                onClick={() => updateFilter({ blocks: toggleArrayItem(filter.blocks, block) })}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  filter.blocks.includes(block)
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                {block}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* 特徴 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          特徴
        </label>
        <select
          multiple
          value={filter.features}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, opt => opt.value);
            updateFilter({ features: selected });
          }}
          className="w-full border rounded px-3 py-2 h-32 text-sm"
        >
          {meta.features.map(feature => (
            <option key={feature} value={feature}>
              {feature}
            </option>
          ))}
        </select>
        {filter.features.length > 0 && (
          <button
            onClick={() => updateFilter({ features: [] })}
            className="mt-1 text-xs text-gray-500 hover:text-gray-700"
          >
            選択をクリア
          </button>
        )}
      </div>
      
      {/* シリーズID */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          入手シリーズ
        </label>
        <select
          multiple
          value={filter.series_ids}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, opt => opt.value);
            updateFilter({ series_ids: selected });
          }}
          className="w-full border rounded px-3 py-2 h-32 text-sm"
        >
          {meta.seriesIds.map(series => (
            <option key={series} value={series}>
              {series}
            </option>
          ))}
        </select>
        {filter.series_ids.length > 0 && (
          <button
            onClick={() => updateFilter({ series_ids: [] })}
            className="mt-1 text-xs text-gray-500 hover:text-gray-700"
          >
            選択をクリア
          </button>
        )}
      </div>
      
      {/* フリーワード */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          フリーワード検索
        </label>
        <input
          type="text"
          value={filter.free_words}
          onChange={(e) => updateFilter({ free_words: e.target.value })}
          placeholder="カード名・テキスト・特徴など"
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          スペース区切りでAND検索
        </p>
      </div>
      
      {/* フィルタリセット */}
      <button
        onClick={() => onChange({
          colors: [],
          types: [],
          costs: [],
          counters: [],
          attributes: [],
          blocks: [],
          features: [],
          series_ids: [],
          free_words: '',
          leader_colors: filter.leader_colors, // リーダー色は維持
          parallel_mode: 'normal',
        })}
        className="w-full btn btn-secondary"
      >
        フィルタをリセット
      </button>
    </div>
  );
}
