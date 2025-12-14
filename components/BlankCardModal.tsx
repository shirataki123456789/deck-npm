'use client';

import { useState } from 'react';
import { Card, COLOR_ORDER } from '@/lib/types';

interface BlankCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (card: Card) => void;
  existingIds: string[]; // 既存カードIDのリスト（重複チェック用）
}

export default function BlankCardModal({ isOpen, onClose, onAdd, existingIds }: BlankCardModalProps) {
  const [cardId, setCardId] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardType, setCardType] = useState<string>('CHARACTER');
  const [selectedColors, setSelectedColors] = useState<string[]>(['赤']);
  const [cost, setCost] = useState<number>(0);
  const [power, setPower] = useState<number>(0);
  const [counter, setCounter] = useState<number>(0);
  const [error, setError] = useState<string>('');
  
  if (!isOpen) return null;
  
  const handleSubmit = () => {
    // バリデーション
    if (!cardId.trim()) {
      setError('カードIDを入力してください');
      return;
    }
    
    // ID形式チェック（例: OP10-001, ST01-001, EB01-001）
    if (!/^[A-Z]{2,3}\d{2}-\d{3}$/i.test(cardId.trim())) {
      setError('カードIDの形式が正しくありません（例: OP10-001）');
      return;
    }
    
    // 重複チェック
    if (existingIds.includes(cardId.trim().toUpperCase())) {
      setError('このカードIDは既に存在します');
      return;
    }
    
    if (selectedColors.length === 0) {
      setError('色を1つ以上選択してください');
      return;
    }
    
    // ブランクカードを作成
    const blankCard: Card = {
      name: cardName.trim() || `不明カード (${cardId.trim().toUpperCase()})`,
      card_id: cardId.trim().toUpperCase(),
      card_code: '',
      type: cardType,
      rarity: '?',
      cost: cardType === 'LEADER' ? -1 : cost,
      attribute: '',
      power: power,
      counter: counter,
      color: selectedColors,
      block_icon: '',
      features: [],
      text: '',
      trigger: '',
      source: 'ブランクカード（手動追加）',
      image_url: '', // 空の場合はプレースホルダー表示
      is_parallel: false,
      series_id: 'BLANK',
    };
    
    onAdd(blankCard);
    
    // フォームリセット
    setCardId('');
    setCardName('');
    setCardType('CHARACTER');
    setSelectedColors(['赤']);
    setCost(0);
    setPower(0);
    setCounter(0);
    setError('');
    onClose();
  };
  
  const toggleColor = (color: string) => {
    setSelectedColors(prev => 
      prev.includes(color)
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">➕ ブランクカードを追加</h2>
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
          
          {/* カードID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カードID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={cardId}
              onChange={(e) => { setCardId(e.target.value); setError(''); }}
              placeholder="例: OP10-001"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              形式: OP10-001, ST01-001, EB01-001 など
            </p>
          </div>
          
          {/* カード名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カード名（任意）
            </label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="例: モンキー・D・ルフィ"
              className="w-full border rounded px-3 py-2 text-sm"
            />
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
          
          {/* 色 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              色 <span className="text-red-500">*</span>
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
          
          {/* プレビュー */}
          <div className="bg-gray-100 rounded p-3">
            <p className="text-sm font-medium text-gray-700 mb-2">プレビュー</p>
            <div className="flex items-center gap-3">
              {/* プレースホルダー画像 */}
              <div className="w-16 h-22 bg-gray-300 rounded flex items-center justify-center text-2xl text-gray-500">
                ?
              </div>
              <div className="flex-1">
                <p className="font-medium">{cardName || `不明カード (${cardId.toUpperCase() || '???'})`}</p>
                <p className="text-sm text-gray-600">{cardId.toUpperCase() || '???'}</p>
                <div className="flex gap-1 mt-1">
                  {selectedColors.map(c => (
                    <span key={c} className={`color-badge color-badge-${c} text-xs`}>
                      {c}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {cardType} / コスト{cost} / パワー{power}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t flex gap-2">
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
            追加する
          </button>
        </div>
      </div>
    </div>
  );
}
