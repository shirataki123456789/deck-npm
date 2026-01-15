'use client';

import { useState, useMemo } from 'react';
import { FilterOptions, COLOR_ORDER } from '@/lib/types';

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

interface FilterPanelProps {
  filter: FilterOptions;
  onChange: (filter: FilterOptions) => void;
  meta: FilterMeta;
  hideLeaderColors?: boolean;
  hideLeaderType?: boolean;
}

// 展開可能な複数選択コンポーネント
function ExpandableMultiSelect({
  options,
  selected,
  onChange,
  placeholder = '検索...',
}: {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchText, setSearchText] = useState('');
  
  const filteredOptions = useMemo(() => {
    if (!searchText) return options;
    const lower = searchText.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(lower));
  }, [options, searchText]);
  
  const toggleItem = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter(s => s !== item));
    } else {
      onChange([...selected, item]);
    }
  };
  
  return (
    <div className="border rounded bg-white">
      {/* 選択中のアイテム表示 */}
      {selected.length > 0 && (
        <div className="p-2 border-b flex flex-wrap gap-1">
          {selected.map(item => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded"
            >
              {item}
              <button
                onClick={() => toggleItem(item)}
                className="hover:text-blue-600"
              >
                ×
              </button>
            </span>
          ))}
          <button
            onClick={() => onChange([])}
            className="text-xs text-gray-500 hover:text-gray-700 ml-1"
          >
            全てクリア
          </button>
        </div>
      )}
      
      {/* 展開ボタン */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50"
      >
        <span className="text-gray-600">
          {isExpanded ? '閉じる' : `選択する (${options.length}件)`}
        </span>
        <span>{isExpanded ? '▲' : '▼'}</span>
      </button>
      
      {/* 展開時のリスト */}
      {isExpanded && (
        <div className="border-t">
          {/* 検索入力 */}
          <div className="p-2 border-b">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={placeholder}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          
          {/* オプションリスト */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-sm text-gray-500">該当なし</div>
            ) : (
              filteredOptions.map(opt => (
                <label
                  key={opt}
                  className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => toggleItem(opt)}
                    className="mr-2"
                  />
                  <span className="truncate">{opt}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FilterPanel({
  filter,
  onChange,
  meta,
  hideLeaderColors = true,
  hideLeaderType = false,
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
  
  // タイプリストからLEADERを除外するかどうか
  const displayTypes = hideLeaderType 
    ? meta.types.filter(t => t !== 'LEADER')
    : meta.types;
  
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
          {displayTypes.map(type => (
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
      
      {/* トリガー */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          トリガー
        </label>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => updateFilter({ has_trigger: filter.has_trigger === null ? true : (filter.has_trigger === true ? false : null) })}
            className={`px-3 py-1.5 text-sm rounded border transition-colors ${
              filter.has_trigger === null
                ? 'bg-gray-200 text-gray-700 border-gray-300'
                : filter.has_trigger === true
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-gray-500 text-white border-gray-500'
            }`}
          >
            {filter.has_trigger === null ? '全て' : filter.has_trigger ? 'トリガーあり' : 'トリガーなし'}
          </button>
        </div>
      </div>
      
      {/* レアリティ */}
      {meta.rarities && meta.rarities.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            レアリティ
          </label>
          <div className="flex flex-wrap gap-1">
            {meta.rarities.map(rarity => (
              <button
                key={rarity}
                onClick={() => updateFilter({ rarities: toggleArrayItem(filter.rarities || [], rarity) })}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  (filter.rarities || []).includes(rarity)
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                {rarity}
              </button>
            ))}
            {(filter.rarities || []).length > 0 && (
              <button
                onClick={() => updateFilter({ rarities: [] })}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                クリア
              </button>
            )}
          </div>
        </div>
      )}
      
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
      
      {/* パワー */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          パワー
        </label>
        <div className="flex flex-wrap gap-1">
          {[0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000].map(power => (
            <button
              key={power}
              onClick={() => updateFilter({ powers: toggleArrayItem(filter.powers, power) })}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                filter.powers.includes(power)
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              {power === 0 ? '0' : `${power / 1000}K`}
            </button>
          ))}
          {filter.powers.length > 0 && (
            <button
              onClick={() => updateFilter({ powers: [] })}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              クリア
            </button>
          )}
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
          特徴 {filter.features.length > 0 && `(${filter.features.length}件選択中)`}
        </label>
        <ExpandableMultiSelect
          options={meta.features}
          selected={filter.features}
          onChange={(selected) => updateFilter({ features: selected })}
          placeholder="特徴を検索..."
        />
      </div>
      
      {/* シリーズID */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          入手シリーズ {filter.series_ids.length > 0 && `(${filter.series_ids.length}件選択中)`}
        </label>
        <ExpandableMultiSelect
          options={meta.seriesIds}
          selected={filter.series_ids}
          onChange={(selected) => updateFilter({ series_ids: selected })}
          placeholder="シリーズを検索..."
        />
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
          powers: [],
          attributes: [],
          blocks: [],
          features: [],
          series_ids: [],
          rarities: [],
          free_words: '',
          leader_colors: filter.leader_colors, // リーダー色は維持
          parallel_mode: 'normal',
          has_trigger: null,
        })}
        className="w-full btn btn-secondary"
      >
        フィルタをリセット
      </button>
    </div>
  );
}