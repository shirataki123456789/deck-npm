'use client';

import { useState, useEffect } from 'react';
import { Card, COLOR_ORDER } from '@/lib/types';

interface BlankCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (card: Card) => void;
  onUpdate?: (card: Card) => void;
  onDelete?: (cardId: string) => void;
  existingIds: string[];
  editCard?: Card | null;
  availableFeatures?: string[]; // APIから取得した特徴リスト
  availableAttributes?: string[]; // APIから取得した属性リスト
}

// ブランクカード用の一意IDを生成
let blankCardCounter = Date.now() % 10000;
const generateBlankId = () => {
  blankCardCounter++;
  return `BLANK-${String(blankCardCounter).padStart(4, '0')}`;
};

export default function BlankCardModal({ 
  isOpen, 
  onClose, 
  onAdd, 
  onUpdate,
  onDelete,
  existingIds,
  editCard,
  availableFeatures = [],
  availableAttributes = [],
}: BlankCardModalProps) {
  const [cardId, setCardId] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardType, setCardType] = useState<string>('CHARACTER');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [cost, setCost] = useState<number>(0);
  const [power, setPower] = useState<number>(5000);
  const [counter, setCounter] = useState<number>(1000);
  const [attribute, setAttribute] = useState<string>('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [customFeature, setCustomFeature] = useState('');
  const [effectText, setEffectText] = useState('');
  const [trigger, setTrigger] = useState('');
  const [error, setError] = useState<string>('');
  const [featureFilter, setFeatureFilter] = useState(''); // 特徴の絞り込み用
  
  const isEditMode = !!editCard;
  
  // 編集モード時にフォームを初期化
  useEffect(() => {
    if (editCard) {
      setCardId(editCard.card_id);
      setCardName(editCard.name);
      setCardType(editCard.type);
      setSelectedColors(editCard.color);
      setCost(editCard.cost >= 0 ? editCard.cost : 0);
      setPower(editCard.power);
      setCounter(editCard.counter);
      setAttribute(editCard.attribute || '');
      setSelectedFeatures(editCard.features || []);
      setEffectText(editCard.text || '');
      setTrigger(editCard.trigger || '');
      setError('');
      setFeatureFilter('');
    } else if (isOpen) {
      resetForm();
    }
  }, [editCard, isOpen]);
  
  const resetForm = () => {
    setCardId('');
    setCardName('');
    setCardType('CHARACTER');
    setSelectedColors([]);
    setCost(0);
    setPower(5000);
    setCounter(1000);
    setAttribute('');
    setSelectedFeatures([]);
    setCustomFeature('');
    setEffectText('');
    setTrigger('');
    setError('');
    setFeatureFilter('');
  };
  
  if (!isOpen) return null;
  
  // 特徴の絞り込み
  const filteredFeatures = availableFeatures.filter(f => 
    featureFilter === '' || f.toLowerCase().includes(featureFilter.toLowerCase())
  );
  
  const handleSubmit = () => {
    let finalCardId = cardId.trim().toUpperCase();
    
    if (isEditMode) {
      finalCardId = editCard!.card_id;
    } else {
      if (finalCardId) {
        if (!/^[A-Z]{2,3}\d{2}-\d{3}$/i.test(finalCardId)) {
          setError('カードIDの形式が正しくありません（例: OP10-001）');
          return;
        }
        if (existingIds.includes(finalCardId)) {
          setError('このカードIDは既に存在します');
          return;
        }
      } else {
        finalCardId = generateBlankId();
      }
    }
    
    const finalName = cardName.trim() || '不明カード';
    
    const blankCard: Card = {
      name: finalName,
      card_id: finalCardId,
      card_code: '',
      type: cardType,
      rarity: '?',
      cost: cardType === 'LEADER' ? -1 : cost,
      attribute: attribute,
      power: power,
      counter: counter,
      color: selectedColors,
      block_icon: '',
      features: selectedFeatures,
      text: effectText,
      trigger: trigger,
      source: 'ブランクカード（手動追加）',
      image_url: '',
      is_parallel: false,
      series_id: 'BLANK',
    };
    
    if (isEditMode && onUpdate) {
      onUpdate(blankCard);
    } else {
      onAdd(blankCard);
    }
    
    resetForm();
    onClose();
  };
  
  const handleDelete = () => {
    if (editCard && onDelete) {
      if (confirm(`「${editCard.name}」を削除しますか？\nデッキ内のこのカードも削除されます。`)) {
        onDelete(editCard.card_id);
        resetForm();
        onClose();
      }
    }
  };
  
  const toggleColor = (color: string) => {
    setSelectedColors(prev => 
      prev.includes(color)
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };
  
  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };
  
  const addCustomFeature = () => {
    const trimmed = customFeature.trim();
    if (trimmed && !selectedFeatures.includes(trimmed)) {
      setSelectedFeatures(prev => [...prev, trimmed]);
      setCustomFeature('');
    }
  };
  
  const previewId = isEditMode ? editCard!.card_id : (cardId.trim().toUpperCase() || '(自動生成)');
  const previewName = cardName.trim() || '不明カード';
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold">
            {isEditMode ? '✏️ ブランクカードを編集' : '📝 ブランクカードを追加'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded text-sm">
              {error}
            </div>
          )}
          
          {/* カード名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カード名
            </label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="例: モンキー・D・ルフィ"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          
          {/* カードID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カードID{!isEditMode && '（任意）'}
            </label>
            {isEditMode ? (
              <div className="px-3 py-2 bg-gray-100 rounded text-sm text-gray-600">
                {editCard!.card_id}（変更不可）
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={cardId}
                  onChange={(e) => { setCardId(e.target.value); setError(''); }}
                  placeholder="例: OP10-001（空欄で自動生成）"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  空欄の場合は自動でIDが生成されます
                </p>
              </>
            )}
          </div>
          
          {/* タイプ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タイプ
            </label>
            <div className="flex gap-2">
              {['CHARACTER', 'EVENT', 'STAGE'].map(type => (
                <button
                  key={type}
                  onClick={() => setCardType(type)}
                  className={`flex-1 py-2 rounded border text-sm transition-colors ${
                    cardType === type
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          
          {/* 色（任意） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              色（任意・複数選択可）
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_ORDER.map(color => (
                <button
                  key={color}
                  onClick={() => toggleColor(color)}
                  className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                    selectedColors.includes(color)
                      ? `color-badge-${color}`
                      : 'bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
            {selectedColors.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">未選択の場合、グレーで表示されます</p>
            )}
          </div>
          
          {/* 属性 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              属性
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAttribute('')}
                className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                  attribute === ''
                    ? 'bg-gray-600 text-white border-gray-600'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                なし
              </button>
              {availableAttributes.map(attr => (
                <button
                  key={attr}
                  onClick={() => setAttribute(attr)}
                  className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                    attribute === attr
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {attr}
                </button>
              ))}
            </div>
          </div>
          
          {/* コスト・パワー・カウンター */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                コスト
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                パワー
              </label>
              <input
                type="number"
                min="0"
                max="15000"
                step="1000"
                value={power}
                onChange={(e) => setPower(Number(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                カウンター
              </label>
              <select
                value={counter}
                onChange={(e) => setCounter(Number(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value={0}>なし</option>
                <option value={1000}>+1000</option>
                <option value={2000}>+2000</option>
              </select>
            </div>
          </div>
          
          {/* 特徴 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              特徴（複数選択可）
            </label>
            {/* 絞り込み検索 */}
            <input
              type="text"
              value={featureFilter}
              onChange={(e) => setFeatureFilter(e.target.value)}
              placeholder="特徴を検索..."
              className="w-full border rounded px-3 py-1.5 text-sm mb-2"
            />
            <div className="flex flex-wrap gap-1 mb-2 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
              {filteredFeatures.length > 0 ? (
                filteredFeatures.map(feature => (
                  <button
                    key={feature}
                    onClick={() => toggleFeature(feature)}
                    className={`px-2 py-1 rounded border text-xs transition-colors ${
                      selectedFeatures.includes(feature)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {feature}
                  </button>
                ))
              ) : (
                <p className="text-xs text-gray-500">
                  {availableFeatures.length === 0 ? '特徴データを読み込み中...' : '該当する特徴がありません'}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customFeature}
                onChange={(e) => setCustomFeature(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomFeature())}
                placeholder="カスタム特徴を入力"
                className="flex-1 border rounded px-3 py-1.5 text-sm"
              />
              <button
                onClick={addCustomFeature}
                type="button"
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                追加
              </button>
            </div>
            {selectedFeatures.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-xs text-gray-500">選択中:</span>
                {selectedFeatures.map(f => (
                  <span
                    key={f}
                    onClick={() => toggleFeature(f)}
                    className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs cursor-pointer hover:bg-blue-200"
                  >
                    {f} ✕
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* 効果テキスト */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              効果テキスト・メモ
            </label>
            <textarea
              value={effectText}
              onChange={(e) => setEffectText(e.target.value)}
              placeholder="カードの効果やメモを入力..."
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm resize-none"
            />
          </div>
          
          {/* トリガー */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              トリガー効果
            </label>
            <input
              type="text"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="例: このカードを手札に加える"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          
          {/* プレビュー */}
          <div className="bg-gray-100 rounded p-3">
            <p className="text-sm font-medium text-gray-700 mb-2">プレビュー</p>
            <div className="flex gap-3">
              <div 
                className={`w-20 aspect-[400/560] rounded flex flex-col items-center justify-center text-xs ${
                  selectedColors.length > 0 
                    ? 'bg-gradient-to-br from-gray-400 to-gray-500' 
                    : 'bg-gradient-to-br from-gray-300 to-gray-400'
                }`}
                style={selectedColors.length === 1 ? {
                  background: `var(--color-${selectedColors[0]}, #888)`
                } : undefined}
              >
                <span className="text-white text-2xl mb-1 drop-shadow">?</span>
                <span className="px-1 text-center truncate w-full text-[10px] text-white drop-shadow">{previewName}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{previewName}</p>
                <p className="text-sm text-gray-600">{previewId}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {selectedColors.map(c => (
                    <span key={c} className={`color-badge color-badge-${c} text-xs`}>
                      {c}
                    </span>
                  ))}
                  {attribute && (
                    <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">
                      {attribute}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {cardType} / コスト{cost} / パワー{power} / C{counter > 0 ? `+${counter}` : 'なし'}
                </p>
                {selectedFeatures.length > 0 && (
                  <p className="text-xs text-gray-500 truncate">
                    特徴: {selectedFeatures.join(', ')}
                  </p>
                )}
                {effectText && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {effectText}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t flex gap-2 sticky bottom-0 bg-white">
          {isEditMode && onDelete && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
            >
              🗑️ 削除
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 btn btn-secondary"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 btn btn-primary"
          >
            {isEditMode ? '更新する' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  );
}
