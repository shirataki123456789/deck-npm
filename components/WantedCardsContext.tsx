'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { Card } from '@/lib/types';

interface WantedCard {
  card: Card;
  count: number;  // 必要数
  owned: number;  // 所持数
}

interface WantedCardsContextType {
  wantedCards: WantedCard[];
  addWantedCard: (card: Card, count?: number) => void;
  removeWantedCard: (cardId: string) => void;
  updateWantedCount: (card: Card, count: number) => void;
  updateOwnedCount: (card: Card, owned: number) => void;
  clearWantedCards: () => void;
  getWantedCount: (cardId: string) => number;
  getOwnedCount: (cardId: string) => number;
  totalWantedCount: number;
  totalOwnedCount: number;
  getWantedCardIds: () => string[];
  importFromText: (text: string, allCards: Card[]) => number;
  exportToText: () => string;
}

const WantedCardsContext = createContext<WantedCardsContextType | null>(null);

export function WantedCardsProvider({ children }: { children: ReactNode }) {
  const [wantedCards, setWantedCards] = useState<WantedCard[]>([]);

  const addWantedCard = useCallback((card: Card, count: number = 1) => {
    setWantedCards(prev => {
      const existing = prev.find(w => w.card.card_id === card.card_id);
      if (existing) {
        return prev.map(w => 
          w.card.card_id === card.card_id 
            ? { ...w, count: w.count + count }
            : w
        );
      }
      return [...prev, { card, count, owned: 0 }];
    });
  }, []);

  const removeWantedCard = useCallback((cardId: string) => {
    setWantedCards(prev => prev.filter(w => w.card.card_id !== cardId));
  }, []);

  const updateWantedCount = useCallback((card: Card, count: number) => {
    setWantedCards(prev => {
      const existing = prev.find(w => w.card.card_id === card.card_id);
      if (count <= 0 && (!existing || existing.owned <= 0)) {
        return prev.filter(w => w.card.card_id !== card.card_id);
      }
      if (existing) {
        return prev.map(w => 
          w.card.card_id === card.card_id ? { ...w, count: Math.max(0, count) } : w
        );
      } else if (count > 0) {
        return [...prev, { card, count, owned: 0 }];
      }
      return prev;
    });
  }, []);

  const updateOwnedCount = useCallback((card: Card, owned: number) => {
    setWantedCards(prev => {
      const existing = prev.find(w => w.card.card_id === card.card_id);
      if (owned <= 0 && (!existing || existing.count <= 0)) {
        return prev.filter(w => w.card.card_id !== card.card_id);
      }
      if (existing) {
        return prev.map(w => 
          w.card.card_id === card.card_id ? { ...w, owned: Math.max(0, owned) } : w
        );
      } else if (owned > 0) {
        return [...prev, { card, count: 0, owned }];
      }
      return prev;
    });
  }, []);

  const clearWantedCards = useCallback(() => {
    setWantedCards([]);
  }, []);

  const getWantedCount = useCallback((cardId: string) => {
    return wantedCards.find(w => w.card.card_id === cardId)?.count || 0;
  }, [wantedCards]);

  const getOwnedCount = useCallback((cardId: string) => {
    return wantedCards.find(w => w.card.card_id === cardId)?.owned || 0;
  }, [wantedCards]);

  const getWantedCardIds = useCallback(() => {
    return wantedCards.map(w => w.card.card_id);
  }, [wantedCards]);

  // テキストからインポート（デッキと同形式: card_id:count または card_id:count:owned）
  const importFromText = useCallback((text: string, allCards: Card[]): number => {
    const lines = text.trim().split('\n');
    let importedCount = 0;
    
    const newCards: WantedCard[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const parts = trimmed.split(/[:\t]/);
      const cardId = parts[0]?.trim();
      const count = parseInt(parts[1]) || 1;
      const owned = parseInt(parts[2]) || 0;
      
      if (cardId) {
        const card = allCards.find(c => c.card_id === cardId);
        if (card) {
          newCards.push({ card, count, owned });
          importedCount++;
        }
      }
    }
    
    if (newCards.length > 0) {
      setWantedCards(newCards);
    }
    
    return importedCount;
  }, []);

  // テキストにエクスポート
  const exportToText = useCallback(() => {
    return wantedCards.map(w => `${w.card.card_id}:${w.count}:${w.owned}`).join('\n');
  }, [wantedCards]);

  const totalWantedCount = wantedCards.reduce((sum, w) => sum + w.count, 0);
  const totalOwnedCount = wantedCards.reduce((sum, w) => sum + w.owned, 0);

  return (
    <WantedCardsContext.Provider value={{
      wantedCards,
      addWantedCard,
      removeWantedCard,
      updateWantedCount,
      updateOwnedCount,
      clearWantedCards,
      getWantedCount,
      getOwnedCount,
      totalWantedCount,
      totalOwnedCount,
      getWantedCardIds,
      importFromText,
      exportToText,
    }}>
      {children}
    </WantedCardsContext.Provider>
  );
}

export function useWantedCards() {
  const context = useContext(WantedCardsContext);
  if (!context) {
    throw new Error('useWantedCards must be used within a WantedCardsProvider');
  }
  return context;
}

// 色に対応するRGB値
const COLOR_RGB: Record<string, string> = {
  '赤': '#ef4444',
  '青': '#3b82f6',
  '緑': '#22c55e',
  '紫': '#a855f7',
  '黒': '#374151',
  '黄': '#eab308',
};

// 画像読み込み関数（プロキシ対応）
async function loadImageWithProxy(url: string): Promise<HTMLImageElement | null> {
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  try {
    return await loadImage(url);
  } catch {
    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      return await loadImage(proxyUrl);
    } catch {
      console.error('Failed to load image:', url);
      return null;
    }
  }
}

// 必要リストパネルコンポーネント
export function WantedCardsPanel({ onClose }: { onClose: () => void }) {
  const { 
    wantedCards, 
    updateWantedCount, 
    updateOwnedCount,
    removeWantedCard, 
    clearWantedCards, 
    totalWantedCount,
    totalOwnedCount,
    exportToText,
    importFromText,
  } = useWantedCards();
  
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState('');
  const [showQRImportModal, setShowQRImportModal] = useState(false);
  const [allCards, setAllCards] = useState<Card[]>([]);

  // カードデータ取得
  useEffect(() => {
    fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        colors: [], types: [], costs: [], counters: [], powers: [],
        attributes: [], blocks: [], features: [], series_ids: [],
        free_words: '', leader_colors: [], parallel_mode: 'both', has_trigger: null
      }),
    })
      .then(res => res.json())
      .then(data => setAllCards(data.cards || []))
      .catch(console.error);
  }, []);

  // 画像生成（2150x2048、QR付き）
  const downloadImage = async () => {
    if (wantedCards.length === 0) return;
    setGenerating(true);
    setGenerateProgress('準備中...');

    try {
      // デッキ画像と同じサイズ
      const FINAL_WIDTH = 2150;
      const FINAL_HEIGHT = 2048;
      const CARD_WIDTH = 215;
      const CARD_HEIGHT = 300;
      const CARDS_PER_ROW = 10;
      const CARDS_PER_COL = 5;
      const QR_SIZE = 400;
      const GAP = 48;
      const HEADER_HEIGHT = 120;
      const GRID_START_Y = HEADER_HEIGHT + GAP;

      const canvas = document.createElement('canvas');
      canvas.width = FINAL_WIDTH;
      canvas.height = FINAL_HEIGHT;
      const ctx = canvas.getContext('2d')!;

      // 背景（グラデーション）
      const gradient = ctx.createLinearGradient(0, 0, FINAL_WIDTH, 0);
      gradient.addColorStop(0, '#f97316');
      gradient.addColorStop(1, '#ea580c');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, FINAL_WIDTH, FINAL_HEIGHT);

      // ヘッダー背景
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, FINAL_WIDTH, HEADER_HEIGHT);

      // タイトル
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('📋 必要カードリスト', GAP, 75);

      // サマリー
      ctx.font = '32px sans-serif';
      ctx.fillText(`必要: ${totalWantedCount}枚 / 所持: ${totalOwnedCount}枚 (${wantedCards.length}種類)`, GAP, 110);

      // QRコード生成
      setGenerateProgress('QRコード生成中...');
      const qrText = exportToText();
      let qrDataUrl = '';
      if (qrText) {
        const QRCode = (await import('qrcode')).default;
        qrDataUrl = await QRCode.toDataURL(qrText, {
          width: QR_SIZE,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
      }

      // QRコード描画（右上）
      if (qrDataUrl) {
        const qrImg = await loadImageWithProxy(qrDataUrl);
        if (qrImg) {
          const qrX = FINAL_WIDTH - QR_SIZE - GAP;
          const qrY = GAP;
          ctx.drawImage(qrImg, qrX, qrY, QR_SIZE, QR_SIZE);
        }
      }

      // カードを展開（必要数分）
      const expandedCards: { card: Card; count: number; owned: number; index: number }[] = [];
      for (const w of wantedCards) {
        for (let i = 0; i < w.count; i++) {
          expandedCards.push({ 
            card: w.card, 
            count: w.count, 
            owned: w.owned,
            index: i 
          });
        }
      }

      // 最大50枚まで描画
      const cardsToRender = expandedCards.slice(0, CARDS_PER_ROW * CARDS_PER_COL);

      // カード描画
      for (let i = 0; i < cardsToRender.length; i++) {
        const { card, owned, index } = cardsToRender[i];
        const col = i % CARDS_PER_ROW;
        const row = Math.floor(i / CARDS_PER_ROW);
        const x = (FINAL_WIDTH - CARDS_PER_ROW * CARD_WIDTH) / 2 + col * CARD_WIDTH;
        const y = GRID_START_Y + QR_SIZE + GAP + row * CARD_HEIGHT;

        setGenerateProgress(`カード読み込み中... ${i + 1}/${cardsToRender.length}`);

        // カード画像
        if (card.image_url) {
          const img = await loadImageWithProxy(card.image_url);
          if (img) {
            ctx.drawImage(img, x, y, CARD_WIDTH, CARD_HEIGHT);
          } else {
            const bgColor = card.color.length > 0 ? (COLOR_RGB[card.color[0]] || '#94a3b8') : '#94a3b8';
            ctx.fillStyle = bgColor;
            ctx.fillRect(x, y, CARD_WIDTH, CARD_HEIGHT);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(card.name.slice(0, 6), x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
          }
        } else {
          const bgColor = card.color.length > 0 ? (COLOR_RGB[card.color[0]] || '#94a3b8') : '#94a3b8';
          ctx.fillStyle = bgColor;
          ctx.fillRect(x, y, CARD_WIDTH, CARD_HEIGHT);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(card.name.slice(0, 6), x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
        }

        // 所持済みマーク（緑チェック）
        if (index < owned) {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
          ctx.beginPath();
          ctx.arc(x + CARD_WIDTH - 25, y + 25, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 24px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✓', x + CARD_WIDTH - 25, y + 33);
        }
      }

      setGenerateProgress('画像を生成中...');

      // ダウンロード
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `wanted_cards_${new Date().toISOString().split('T')[0]}.png`;
      a.click();
    } catch (error) {
      console.error('Image generation failed:', error);
      alert('画像生成に失敗しました');
    } finally {
      setGenerating(false);
      setGenerateProgress('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[90] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-orange-50">
          <div>
            <h2 className="text-lg font-bold">📋 必要カードリスト</h2>
            <p className="text-sm text-gray-600">
              必要: {totalWantedCount}枚 / 所持: {totalOwnedCount}枚 ({wantedCards.length}種類)
            </p>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-700">×</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {wantedCards.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">📝</div>
              <p>必要なカードがありません</p>
              <p className="text-sm mt-1">カード拡大画面から追加できます</p>
            </div>
          ) : (
            <div className="space-y-2">
              {wantedCards.map(w => (
                <div 
                  key={w.card.card_id} 
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                >
                  <div className="w-12 h-16 flex-shrink-0 bg-gray-200 rounded overflow-hidden">
                    {w.card.image_url ? (
                      <img src={w.card.image_url} alt={w.card.name} className="w-full h-full object-cover" />
                    ) : (
                      <div 
                        className="w-full h-full flex items-center justify-center text-white text-xs"
                        style={{ backgroundColor: COLOR_RGB[w.card.color[0]] || '#94a3b8' }}
                      >
                        {w.card.name.slice(0, 4)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{w.card.name}</div>
                    <div className="text-xs text-gray-500">{w.card.card_id}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {/* 必要数 */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500 w-6">必要</span>
                      <button
                        onClick={() => updateWantedCount(w.card, w.count - 1)}
                        className="w-5 h-5 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200"
                      >
                        -
                      </button>
                      <span className="w-5 text-center text-xs font-medium">{w.count}</span>
                      <button
                        onClick={() => updateWantedCount(w.card, w.count + 1)}
                        className="w-5 h-5 bg-green-100 text-green-600 rounded text-xs hover:bg-green-200"
                      >
                        +
                      </button>
                    </div>
                    {/* 所持数 */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500 w-6">所持</span>
                      <button
                        onClick={() => updateOwnedCount(w.card, w.owned - 1)}
                        disabled={w.owned <= 0}
                        className={`w-5 h-5 rounded text-xs ${
                          w.owned > 0 ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' : 'bg-gray-100 text-gray-300'
                        }`}
                      >
                        -
                      </button>
                      <span className="w-5 text-center text-xs font-medium">{w.owned}</span>
                      <button
                        onClick={() => updateOwnedCount(w.card, w.owned + 1)}
                        className="w-5 h-5 bg-blue-100 text-blue-600 rounded text-xs hover:bg-blue-200"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => removeWantedCard(w.card.card_id)}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* ボタン: 画像、QR読み込み、クリア */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <button
              onClick={downloadImage}
              disabled={wantedCards.length === 0 || generating}
              className="flex-1 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {generating ? generateProgress || '生成中...' : '🖼️ 画像'}
            </button>
            <button
              onClick={() => setShowQRImportModal(true)}
              className="flex-1 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              📷 QR読込
            </button>
            <button
              onClick={clearWantedCards}
              disabled={wantedCards.length === 0}
              className="flex-1 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              🗑️ クリア
            </button>
          </div>
        </div>
      </div>

      {/* QRインポートモーダル */}
      {showQRImportModal && (
        <QRImportModal
          allCards={allCards}
          onClose={() => setShowQRImportModal(false)}
        />
      )}
    </div>
  );
}

// QRインポートモーダル
function QRImportModal({ 
  allCards,
  onClose 
}: { 
  allCards: Card[];
  onClose: () => void;
}) {
  const [scannedText, setScannedText] = useState('');
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importFromText } = useWantedCards();

  // 画像からQRコード読み取り
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    try {
      const jsQR = (await import('jsqr')).default;
      
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      URL.revokeObjectURL(url);

      if (code) {
        setScannedText(code.data);
      } else {
        alert('QRコードを検出できませんでした');
      }
    } catch (error) {
      console.error('QR scan error:', error);
      alert('画像の読み取りに失敗しました');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImport = () => {
    if (!scannedText) return;
    const count = importFromText(scannedText, allCards);
    alert(`${count}件のカードをインポートしました`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-bold">📷 QRコード読込</h3>
          <button onClick={onClose} className="text-xl">×</button>
        </div>
        
        <div className="p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          
          {scannedText ? (
            <div>
              <div className="p-2 bg-green-50 rounded mb-2">
                <p className="text-sm text-green-700">✓ QRコードを読み取りました</p>
                <p className="text-xs text-gray-500 mt-1">
                  {scannedText.split('\n').filter(l => l.trim()).length}件のカード情報
                </p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setScannedText('')}
                  className="flex-1 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  別の画像
                </button>
                <button 
                  onClick={handleImport}
                  className="flex-1 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  インポート
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
                className="w-full py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {processing ? '読み取り中...' : '🖼️ 画像を選択'}
              </button>
              <p className="text-sm text-gray-500 mt-2">
                QRコードの画像を選択してください
              </p>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t">
          <button 
            onClick={onClose}
            className="w-full py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
