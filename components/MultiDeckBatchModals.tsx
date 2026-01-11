'use client';

import { useState, useRef } from 'react';
import { Card, Deck } from '@/lib/types';

interface DeckTabData {
  id: string;
  name: string;
  deck: Deck;
  leaderCard: Card | null;
}

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (decks: { name: string; deckText: string }[]) => void;
}

// 一括インポートモーダル
export function BatchImportModal({ isOpen, onClose, onImport }: BatchImportModalProps) {
  const [images, setImages] = useState<File[]>([]);
  const [results, setResults] = useState<{ name: string; deckText: string; status: string }[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(files);
    setResults([]);
  };

  const processImages = async () => {
    if (images.length === 0) return;
    
    setProcessing(true);
    const newResults: { name: string; deckText: string; status: string }[] = [];

    for (const file of images) {
      try {
        // 画像を読み込み
        const imageData = await loadImage(file);
        
        // QRコードを検出して読み取り
        const deckText = await extractQRFromImage(imageData);
        
        if (deckText) {
          newResults.push({
            name: file.name.replace(/\.[^.]+$/, ''),
            deckText,
            status: '✅ 成功',
          });
        } else {
          newResults.push({
            name: file.name,
            deckText: '',
            status: '❌ QRコード検出失敗',
          });
        }
      } catch (error) {
        newResults.push({
          name: file.name,
          deckText: '',
          status: `❌ エラー: ${error}`,
        });
      }
    }

    setResults(newResults);
    setProcessing(false);
  };

  const handleImport = () => {
    const successfulDecks = results.filter(r => r.deckText);
    if (successfulDecks.length > 0) {
      onImport(successfulDecks);
      onClose();
    }
  };

  const handleClose = () => {
    setImages([]);
    setResults([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">📥 デッキ画像一括インポート</h2>
          <button onClick={handleClose} className="text-2xl text-gray-500 hover:text-gray-700">×</button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {/* ファイル選択 */}
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-primary w-full"
            >
              📁 画像ファイルを選択（複数可）
            </button>
            {images.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                {images.length}件の画像を選択中
              </p>
            )}
          </div>

          {/* 処理ボタン */}
          {images.length > 0 && results.length === 0 && (
            <button
              onClick={processImages}
              disabled={processing}
              className="btn btn-success w-full mb-4"
            >
              {processing ? '処理中...' : '🔍 QRコードを読み取る'}
            </button>
          )}

          {/* 結果一覧 */}
          {results.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">読み取り結果:</h3>
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded border ${
                    result.deckText ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{result.name}</span>
                    <span className="text-sm">{result.status}</span>
                  </div>
                  {result.deckText && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {result.deckText.substring(0, 100)}...
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t flex gap-2 justify-end">
          <button onClick={handleClose} className="btn btn-secondary">
            キャンセル
          </button>
          {results.filter(r => r.deckText).length > 0 && (
            <button onClick={handleImport} className="btn btn-primary">
              {results.filter(r => r.deckText).length}件をインポート
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 画像読み込み
async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// QRコード抽出
async function extractQRFromImage(img: HTMLImageElement): Promise<string | null> {
  const jsQR = (await import('jsqr')).default;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  // まず全体からQRを検出
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  if (code) return code.data;

  // グリッド分割で検出を試行（デッキ画像の場合、QRは特定の位置にある）
  const regions = [
    { x: 0, y: 0, w: 0.3, h: 0.3 },           // 左上
    { x: 0.7, y: 0, w: 0.3, h: 0.3 },         // 右上
    { x: 0, y: 0.7, w: 0.3, h: 0.3 },         // 左下
    { x: 0.7, y: 0.7, w: 0.3, h: 0.3 },       // 右下
    { x: 0.35, y: 0, w: 0.3, h: 0.3 },        // 上中央
  ];

  for (const region of regions) {
    const x = Math.floor(img.width * region.x);
    const y = Math.floor(img.height * region.y);
    const w = Math.floor(img.width * region.w);
    const h = Math.floor(img.height * region.h);
    
    const regionData = ctx.getImageData(x, y, w, h);
    const regionCode = jsQR(regionData.data, regionData.width, regionData.height);
    if (regionCode) return regionCode.data;
  }

  return null;
}

// 一括エクスポートモーダル
interface BatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: DeckTabData[];
  allCards: Card[];
}

export function BatchExportModal({ isOpen, onClose, tabs, allCards }: BatchExportModalProps) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!isOpen) return null;

  // JSON出力
  const exportJSON = () => {
    const data = tabs.map(tab => ({
      name: tab.name,
      leader: tab.leaderCard ? {
        card_id: tab.leaderCard.card_id,
        name: tab.leaderCard.name,
        color: tab.leaderCard.color,
      } : null,
      cards: Object.entries(tab.deck.cards).map(([cardId, count]) => {
        const card = allCards.find(c => c.card_id === cardId);
        return {
          card_id: cardId,
          name: card?.name || cardId,
          count,
        };
      }),
      total: Object.values(tab.deck.cards).reduce((sum, c) => sum + c, 0),
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decks_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // テキスト一括出力
  const exportText = async () => {
    const texts: string[] = [];
    
    for (const tab of tabs) {
      if (!tab.leaderCard) continue;
      
      try {
        const res = await fetch('/api/deck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'export', deck: tab.deck }),
        });
        const data = await res.json();
        texts.push(`=== ${tab.name} ===\n${data.text || ''}\n`);
      } catch (error) {
        texts.push(`=== ${tab.name} ===\nエクスポートエラー\n`);
      }
    }

    const blob = new Blob([texts.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decks_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 画像一括生成
  const exportImages = async () => {
    setExporting(true);
    setProgress(0);

    const { generateDeckImage } = await import('@/lib/imageGenerator');
    const validTabs = tabs.filter(t => t.leaderCard);
    
    for (let i = 0; i < validTabs.length; i++) {
      const tab = validTabs[i];
      setProgress(((i + 1) / validTabs.length) * 100);

      try {
        // ソートされたカードIDを取得
        const res = await fetch('/api/deck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sort', card_ids: Object.keys(tab.deck.cards) }),
        });
        const sortData = await res.json();
        const sortedCardIds = sortData.card_ids_sorted || Object.keys(tab.deck.cards);

        // カードリストを作成
        const deckCards = sortedCardIds.flatMap((cardId: string) => {
          const card = allCards.find(c => c.card_id === cardId);
          if (!card) return [];
          const count = tab.deck.cards[cardId] || 0;
          return Array(count).fill(card);
        });

        // 画像生成
        const imageBlob = await generateDeckImage(
          tab.leaderCard!,
          deckCards,
          tab.name || tab.deck.name || 'デッキ',
          () => {}
        );

        // ダウンロード
        const url = URL.createObjectURL(imageBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tab.name || 'deck'}_${i + 1}.png`;
        a.click();
        URL.revokeObjectURL(url);

        // 少し待機（連続ダウンロード対策）
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`画像生成エラー (${tab.name}):`, error);
      }
    }

    setExporting(false);
    setProgress(0);
  };

  const validTabCount = tabs.filter(t => t.leaderCard).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">📤 一括エクスポート</h2>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-700">×</button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            {tabs.length}個のタブ（有効: {validTabCount}個）
          </p>

          {/* JSON出力 */}
          <button
            onClick={exportJSON}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            <span>📋</span>
            <span>JSON形式で出力</span>
          </button>

          {/* テキスト出力 */}
          <button
            onClick={exportText}
            className="btn btn-secondary w-full flex items-center justify-center gap-2"
          >
            <span>📝</span>
            <span>テキスト形式で出力</span>
          </button>

          {/* 画像一括生成 */}
          <button
            onClick={exportImages}
            disabled={exporting || validTabCount === 0}
            className="btn btn-success w-full flex items-center justify-center gap-2"
          >
            <span>🖼️</span>
            <span>{exporting ? `生成中... ${Math.round(progress)}%` : 'デッキ画像を一括生成'}</span>
          </button>

          {exporting && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {validTabCount === 0 && (
            <p className="text-sm text-red-500">
              ※ リーダーが設定されたデッキがありません
            </p>
          )}
        </div>

        <div className="p-4 border-t">
          <button onClick={onClose} className="btn btn-secondary w-full">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
