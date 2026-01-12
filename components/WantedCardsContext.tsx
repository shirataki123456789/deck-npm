'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
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
  importWantedCards: (data: WantedCard[]) => void;
  exportWantedCards: () => WantedCard[];
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
        // 必要数0かつ所持数も0なら削除
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
        // 所持数0かつ必要数も0なら削除
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

  const importWantedCards = useCallback((data: WantedCard[]) => {
    setWantedCards(data);
  }, []);

  const exportWantedCards = useCallback(() => {
    return wantedCards;
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
      importWantedCards,
      exportWantedCards,
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

type FilterType = 'all' | 'missing' | 'complete';

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
    importWantedCards,
  } = useWantedCards();
  
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // フィルター適用
  const filteredCards = wantedCards.filter(w => {
    if (filter === 'all') return true;
    if (filter === 'missing') return w.count > w.owned; // 不足
    if (filter === 'complete') return w.owned >= w.count && w.count > 0; // 揃った
    return true;
  });

  // 不足数の合計
  const totalMissing = wantedCards.reduce((sum, w) => sum + Math.max(0, w.count - w.owned), 0);

  const downloadList = () => {
    const lines = wantedCards.map(w => {
      const missing = Math.max(0, w.count - w.owned);
      return `${w.card.card_id}\t${w.card.name}\t必要${w.count}枚\t所持${w.owned}枚\t不足${missing}枚`;
    });
    const header = '=== 必要カードリスト ===\n';
    const total = `\n合計: 必要${totalWantedCount}枚 / 所持${totalOwnedCount}枚 / 不足${totalMissing}枚`;
    const text = header + lines.join('\n') + total;
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wanted_cards_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    const header = 'カードID,カード名,色,タイプ,コスト,必要枚数,所持枚数,不足枚数\n';
    const lines = wantedCards.map(w => {
      const missing = Math.max(0, w.count - w.owned);
      return `${w.card.card_id},"${w.card.name}","${w.card.color.join('/')}",${w.card.type},${w.card.cost},${w.count},${w.owned},${missing}`;
    });
    const text = header + lines.join('\n');
    
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wanted_cards_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSONエクスポート
  const downloadJSON = () => {
    const data = wantedCards.map(w => ({
      card_id: w.card.card_id,
      name: w.card.name,
      color: w.card.color,
      type: w.card.type,
      cost: w.card.cost,
      image_url: w.card.image_url,
      count: w.count,
      owned: w.owned,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wanted_cards_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSONインポート
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          const imported: WantedCard[] = data.map(item => ({
            card: {
              card_id: item.card_id,
              name: item.name || item.card_id,
              color: item.color || [],
              type: item.type || 'CHARACTER',
              cost: item.cost ?? 0,
              image_url: item.image_url || '',
              power: item.power ?? 0,
              counter: item.counter ?? 0,
              attribute: item.attribute || '',
              text: item.text || '',
              trigger: item.trigger || '',
              feature: item.feature || '',
              series_id: item.series_id || '',
              rarity: item.rarity || '',
              block: item.block || '',
              life: item.life ?? 0,
            } as Card,
            count: item.count || 0,
            owned: item.owned || 0,
          }));
          importWantedCards(imported);
          alert(`${imported.length}件のカードをインポートしました`);
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('インポートに失敗しました');
      }
    };
    reader.readAsText(file);
    // リセット
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 画像生成機能
  const downloadImage = async () => {
    if (wantedCards.length === 0) return;
    setGenerating(true);

    try {
      // レイアウト設定
      const cardWidth = 100;
      const cardHeight = 140;
      const infoHeight = 50;
      const cols = Math.min(6, wantedCards.length);
      const rows = Math.ceil(wantedCards.length / cols);
      const padding = 20;
      const headerHeight = 60;
      const footerHeight = 50;
      const gap = 8;

      const canvasWidth = padding * 2 + cols * cardWidth + (cols - 1) * gap;
      const canvasHeight = padding + headerHeight + rows * (cardHeight + infoHeight) + (rows - 1) * gap + footerHeight;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d')!;

      // 背景
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // ヘッダー
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(0, 0, canvasWidth, headerHeight);
      ctx.fillStyle = '#c2410c';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📋 必要カードリスト', canvasWidth / 2, 38);

      // カード画像を読み込んで描画
      const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
      };

      for (let i = 0; i < wantedCards.length; i++) {
        const { card, count, owned } = wantedCards[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = padding + col * (cardWidth + gap);
        const y = padding + headerHeight + row * (cardHeight + infoHeight + gap);
        const missing = Math.max(0, count - owned);

        // カード背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, cardWidth, cardHeight + infoHeight);
        ctx.strokeStyle = missing > 0 ? '#ef4444' : '#22c55e';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, cardWidth, cardHeight + infoHeight);

        // カード画像
        if (card.image_url) {
          try {
            const img = await loadImage(card.image_url);
            ctx.drawImage(img, x + 2, y + 2, cardWidth - 4, cardHeight - 4);
          } catch {
            // 画像読み込み失敗時はプレースホルダー
            const bgColor = card.color.length > 0 ? (COLOR_RGB[card.color[0]] || '#94a3b8') : '#94a3b8';
            ctx.fillStyle = bgColor;
            ctx.fillRect(x + 2, y + 2, cardWidth - 4, cardHeight - 4);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(card.name.slice(0, 6), x + cardWidth / 2, y + cardHeight / 2);
          }
        } else {
          // 画像なしカード
          const bgColor = card.color.length > 0 ? (COLOR_RGB[card.color[0]] || '#94a3b8') : '#94a3b8';
          ctx.fillStyle = bgColor;
          ctx.fillRect(x + 2, y + 2, cardWidth - 4, cardHeight - 4);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(card.name.slice(0, 6), x + cardWidth / 2, y + cardHeight / 2);
        }

        // 情報エリア背景
        ctx.fillStyle = missing > 0 ? '#fef2f2' : '#f0fdf4';
        ctx.fillRect(x + 1, y + cardHeight, cardWidth - 2, infoHeight - 1);

        // カード名
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'left';
        const displayName = card.name.length > 8 ? card.name.slice(0, 8) + '..' : card.name;
        ctx.fillText(displayName, x + 4, y + cardHeight + 12);

        // カードID
        ctx.fillStyle = '#64748b';
        ctx.font = '8px sans-serif';
        ctx.fillText(card.card_id, x + 4, y + cardHeight + 22);

        // 必要/所持/不足
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#1e293b';
        ctx.fillText(`必要: ${count}`, x + 4, y + cardHeight + 34);
        ctx.fillStyle = '#16a34a';
        ctx.fillText(`所持: ${owned}`, x + 4, y + cardHeight + 44);
        
        // 不足バッジ
        if (missing > 0) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(x + cardWidth - 14, y + 14, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${missing}`, x + cardWidth - 14, y + 18);
        } else if (count > 0) {
          // 揃った
          ctx.fillStyle = '#22c55e';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText('✓', x + cardWidth - 6, y + cardHeight + 44);
        }
      }

      // フッター
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `必要: ${totalWantedCount}枚 / 所持: ${totalOwnedCount}枚 / 不足: ${totalMissing}枚`, 
        canvasWidth / 2, 
        canvasHeight - 20
      );

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
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[90] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-orange-50">
          <div>
            <h2 className="text-lg font-bold">📋 必要カードリスト</h2>
            <p className="text-sm text-gray-600">
              必要: {totalWantedCount}枚 / 所持: {totalOwnedCount}枚 / 
              <span className="text-red-600 font-medium"> 不足: {totalMissing}枚</span>
            </p>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-700">×</button>
        </div>

        {/* フィルター */}
        <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-2">
          <span className="text-xs text-gray-500">絞込:</span>
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 text-xs rounded ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            すべて ({wantedCards.length})
          </button>
          <button
            onClick={() => setFilter('missing')}
            className={`px-2 py-1 text-xs rounded ${filter === 'missing' ? 'bg-red-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            不足 ({wantedCards.filter(w => w.count > w.owned).length})
          </button>
          <button
            onClick={() => setFilter('complete')}
            className={`px-2 py-1 text-xs rounded ${filter === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
          >
            揃った ({wantedCards.filter(w => w.owned >= w.count && w.count > 0).length})
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {filteredCards.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">📝</div>
              <p>{wantedCards.length === 0 ? '必要なカードがありません' : '該当するカードがありません'}</p>
              <p className="text-sm mt-1">カード拡大画面から追加できます</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCards.map(w => {
                const missing = Math.max(0, w.count - w.owned);
                return (
                  <div 
                    key={w.card.card_id} 
                    className={`flex items-center gap-2 p-2 rounded border-l-4 ${
                      missing > 0 ? 'bg-red-50 border-red-400' : 'bg-green-50 border-green-400'
                    }`}
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
                      {missing > 0 && (
                        <div className="text-xs text-red-600 font-medium">不足: {missing}枚</div>
                      )}
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
                );
              })}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t space-y-2">
          {/* インポート用hidden input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          
          <div className="flex gap-2">
            <button
              onClick={downloadImage}
              disabled={wantedCards.length === 0 || generating}
              className="flex-1 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {generating ? '生成中...' : '🖼️ 画像'}
            </button>
            <button
              onClick={downloadJSON}
              disabled={wantedCards.length === 0}
              className="flex-1 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              📤 JSON
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              📥 読込
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={downloadList}
              disabled={wantedCards.length === 0}
              className="flex-1 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              📝 テキスト
            </button>
            <button
              onClick={downloadCSV}
              disabled={wantedCards.length === 0}
              className="flex-1 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              📊 CSV
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
    </div>
  );
}
