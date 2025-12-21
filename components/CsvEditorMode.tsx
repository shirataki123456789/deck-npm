'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, COLOR_ORDER } from '@/lib/types';

// CSV列の定義
const CSV_COLUMNS = [
  { key: 'name', label: 'カード名', csvHeader: 'カード名' },
  { key: 'card_id', label: 'カードID', csvHeader: 'カードID' },
  { key: 'card_code', label: 'カードコード', csvHeader: 'カードコード' },
  { key: 'type', label: 'タイプ', csvHeader: 'タイプ' },
  { key: 'rarity', label: 'レアリティ', csvHeader: 'レアリティ' },
  { key: 'cost', label: 'コスト', csvHeader: 'コスト' },
  { key: 'attribute', label: '属性', csvHeader: '属性' },
  { key: 'power', label: 'パワー', csvHeader: 'パワー' },
  { key: 'counter', label: 'カウンター', csvHeader: 'カウンター' },
  { key: 'color', label: '色', csvHeader: '色' },
  { key: 'block_icon', label: 'ブロックアイコン', csvHeader: 'ブロックアイコン' },
  { key: 'features', label: '特徴', csvHeader: '特徴' },
  { key: 'text', label: 'テキスト', csvHeader: 'テキスト' },
  { key: 'trigger', label: 'トリガー', csvHeader: 'トリガー' },
  { key: 'source', label: '入手情報', csvHeader: '入手情報' },
  { key: 'image_url', label: '画像URL', csvHeader: '画像URL' },
] as const;

type CsvColumnKey = typeof CSV_COLUMNS[number]['key'];

// 編集用の行データ型
interface EditableRow {
  id: string; // 一意なID
  data: Record<CsvColumnKey, string>;
  isNew?: boolean; // 新規追加された行
}

interface CsvEditorModeProps {
  blankCards: Card[];
  onClose: () => void;
}

// CardをCSV行データに変換
function cardToRowData(card: Card): Record<CsvColumnKey, string> {
  return {
    name: card.name || '',
    card_id: card.card_id || '',
    card_code: card.card_code || '',
    type: card.type || '',
    rarity: card.rarity || '',
    cost: card.cost >= 0 ? String(card.cost) : '',
    attribute: card.attribute || '',
    power: card.power > 0 ? String(card.power) : '',
    counter: card.counter > 0 ? String(card.counter) : '',
    color: card.color.join('/') || '',
    block_icon: card.block_icon || '',
    features: card.features.join('/') || '',
    text: card.text || '',
    trigger: card.trigger || '',
    source: card.source || '',
    image_url: card.image_url || '',
  };
}

// CSVテキストをパース
function parseCSV(csvText: string): EditableRow[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',');
  const rows: EditableRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    // CSVパース（ダブルクォート対応）
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    
    const data: Record<CsvColumnKey, string> = {
      name: '', card_id: '', card_code: '', type: '', rarity: '',
      cost: '', attribute: '', power: '', counter: '', color: '',
      block_icon: '', features: '', text: '', trigger: '', source: '', image_url: '',
    };
    
    headers.forEach((header, idx) => {
      const col = CSV_COLUMNS.find(c => c.csvHeader === header.trim());
      if (col && values[idx] !== undefined) {
        data[col.key] = values[idx].trim();
      }
    });
    
    rows.push({
      id: `csv-${i}-${Date.now()}`,
      data,
    });
  }
  
  return rows;
}

// 行データをCSV文字列に変換
function rowsToCSV(rows: EditableRow[]): string {
  const header = CSV_COLUMNS.map(c => c.csvHeader).join(',');
  const dataLines = rows.map(row => {
    return CSV_COLUMNS.map(col => {
      const value = row.data[col.key] || '';
      // カンマや改行を含む場合はダブルクォートで囲む
      if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });
  
  return [header, ...dataLines].join('\n');
}

export default function CsvEditorMode({ blankCards, onClose }: CsvEditorModeProps) {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 初期データ読み込み
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      
      try {
        // custom_cards.csvを読み込み
        const res = await fetch('/api/custom-csv');
        const data = await res.json();
        
        let initialRows: EditableRow[] = [];
        
        if (data.csv) {
          initialRows = parseCSV(data.csv);
        }
        
        // ブランクカードを追加（重複チェック）
        blankCards.forEach(card => {
          const exists = initialRows.some(row => row.data.card_id === card.card_id);
          if (!exists) {
            initialRows.push({
              id: `blank-${card.card_id}-${Date.now()}`,
              data: cardToRowData(card),
              isNew: true,
            });
          }
        });
        
        setRows(initialRows);
      } catch (error) {
        console.error('Failed to load CSV:', error);
        
        // エラー時はブランクカードのみ
        const blankRows = blankCards.map(card => ({
          id: `blank-${card.card_id}-${Date.now()}`,
          data: cardToRowData(card),
          isNew: true,
        }));
        setRows(blankRows);
      }
      
      setLoading(false);
    };
    
    loadInitialData();
  }, [blankCards]);
  
  // 行の値を更新
  const updateCell = useCallback((rowId: string, key: CsvColumnKey, value: string) => {
    setRows(prev => prev.map(row => 
      row.id === rowId 
        ? { ...row, data: { ...row.data, [key]: value } }
        : row
    ));
  }, []);
  
  // 新しい行を追加
  const addRow = useCallback(() => {
    const newRow: EditableRow = {
      id: `new-${Date.now()}`,
      data: {
        name: '', card_id: '', card_code: '', type: 'CHARACTER', rarity: '',
        cost: '', attribute: '', power: '', counter: '', color: '',
        block_icon: '', features: '', text: '', trigger: '', source: '', image_url: '',
      },
      isNew: true,
    };
    setRows(prev => [...prev, newRow]);
    setSelectedRowId(newRow.id);
  }, []);
  
  // 行を削除
  const deleteRow = useCallback((rowId: string) => {
    if (confirm('この行を削除しますか？')) {
      setRows(prev => prev.filter(row => row.id !== rowId));
      if (selectedRowId === rowId) {
        setSelectedRowId(null);
      }
    }
  }, [selectedRowId]);
  
  // JSONインポート
  const handleJsonImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const cards: Card[] = Array.isArray(json) ? json : [json];
        
        let addedCount = 0;
        cards.forEach(card => {
          const exists = rows.some(row => row.data.card_id === card.card_id);
          if (!exists) {
            setRows(prev => [...prev, {
              id: `json-${card.card_id}-${Date.now()}`,
              data: cardToRowData(card),
              isNew: true,
            }]);
            addedCount++;
          }
        });
        
        alert(`${addedCount}件のカードをインポートしました`);
      } catch (error) {
        alert('JSONの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
    
    // ファイル選択をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [rows]);
  
  // CSVダウンロード
  const handleDownload = useCallback(() => {
    const csv = rowsToCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'custom_cards.csv';
    link.click();
    URL.revokeObjectURL(url);
  }, [rows]);
  
  // 選択された行のデータ
  const selectedRow = rows.find(r => r.id === selectedRowId);
  
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-100 z-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
          >
            ← 戻る
          </button>
          <h1 className="text-lg font-bold">📝 CSV編集モード</h1>
          <span className="text-sm text-gray-500">({rows.length}件)</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="btn btn-secondary btn-sm cursor-pointer">
            📄 JSONインポート
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleJsonImport}
            />
          </label>
          <button
            onClick={addRow}
            className="btn btn-secondary btn-sm"
          >
            ➕ 行を追加
          </button>
          <button
            onClick={handleDownload}
            className="btn btn-primary btn-sm"
          >
            💾 CSVダウンロード
          </button>
        </div>
      </div>
      
      {/* メインコンテンツ */}
      <div className="flex-1 flex overflow-hidden">
        {/* テーブル一覧 */}
        <div className="w-1/2 overflow-auto border-r">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left border-b w-8"></th>
                <th className="px-2 py-2 text-left border-b">カード名</th>
                <th className="px-2 py-2 text-left border-b">カードID</th>
                <th className="px-2 py-2 text-left border-b">タイプ</th>
                <th className="px-2 py-2 text-left border-b">色</th>
                <th className="px-2 py-2 text-left border-b w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.id}
                  className={`cursor-pointer hover:bg-gray-50 ${
                    selectedRowId === row.id ? 'bg-blue-50' : ''
                  } ${row.isNew ? 'bg-green-50' : ''}`}
                  onClick={() => setSelectedRowId(row.id)}
                >
                  <td className="px-2 py-1 border-b">
                    {row.isNew && <span className="text-green-600 text-xs">新</span>}
                  </td>
                  <td className="px-2 py-1 border-b truncate max-w-[150px]">{row.data.name || '-'}</td>
                  <td className="px-2 py-1 border-b">{row.data.card_id || '-'}</td>
                  <td className="px-2 py-1 border-b">{row.data.type || '-'}</td>
                  <td className="px-2 py-1 border-b">{row.data.color || '-'}</td>
                  <td className="px-2 py-1 border-b">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRow(row.id); }}
                      className="text-red-500 hover:text-red-700"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {rows.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              データがありません
            </div>
          )}
        </div>
        
        {/* 詳細編集パネル */}
        <div className="w-1/2 overflow-auto p-4 bg-white">
          {selectedRow ? (
            <div className="space-y-4">
              <h2 className="font-bold text-lg border-b pb-2">
                詳細編集
                {selectedRow.isNew && (
                  <span className="ml-2 text-sm text-green-600 font-normal">（新規）</span>
                )}
              </h2>
              
              {CSV_COLUMNS.map(col => (
                <div key={col.key} className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    {col.label}
                  </label>
                  {col.key === 'text' || col.key === 'trigger' ? (
                    <textarea
                      value={selectedRow.data[col.key]}
                      onChange={(e) => updateCell(selectedRow.id, col.key, e.target.value)}
                      className="border rounded px-3 py-2 text-sm resize-y min-h-[80px]"
                      placeholder={col.label}
                    />
                  ) : col.key === 'type' ? (
                    <select
                      value={selectedRow.data[col.key]}
                      onChange={(e) => updateCell(selectedRow.id, col.key, e.target.value)}
                      className="border rounded px-3 py-2 text-sm"
                    >
                      <option value="">選択してください</option>
                      <option value="LEADER">LEADER</option>
                      <option value="CHARACTER">CHARACTER</option>
                      <option value="EVENT">EVENT</option>
                      <option value="STAGE">STAGE</option>
                    </select>
                  ) : col.key === 'color' ? (
                    <div className="flex flex-wrap gap-2">
                      {COLOR_ORDER.map(color => {
                        const colors = selectedRow.data.color.split('/').filter(c => c);
                        const isSelected = colors.includes(color);
                        return (
                          <label key={color} className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const newColors = e.target.checked
                                  ? [...colors, color]
                                  : colors.filter(c => c !== color);
                                updateCell(selectedRow.id, 'color', newColors.join('/'));
                              }}
                            />
                            <span className={`color-badge color-badge-${color}`}>{color}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      type={col.key === 'cost' || col.key === 'power' || col.key === 'counter' ? 'number' : 'text'}
                      value={selectedRow.data[col.key]}
                      onChange={(e) => updateCell(selectedRow.id, col.key, e.target.value)}
                      className="border rounded px-3 py-2 text-sm"
                      placeholder={col.label}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              左の一覧から行を選択してください
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
