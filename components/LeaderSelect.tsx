'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, FilterOptions, DEFAULT_FILTER_OPTIONS, COLOR_ORDER } from '@/lib/types';
import { decodeBlankCardFromQR } from '@/lib/blankCardQR';
import jsQR from 'jsqr';

interface LeaderSelectProps {
  onSelect: (card: Card) => void;
  onImport: (text: string) => void;
}

export default function LeaderSelect({ onSelect, onImport }: LeaderSelectProps) {
  const [leaders, setLeaders] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [parallelMode, setParallelMode] = useState<'normal' | 'parallel' | 'both'>('normal');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [colsCount, setColsCount] = useState(4);
  
  // リーダー一覧を取得
  const fetchLeaders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...DEFAULT_FILTER_OPTIONS,
          types: ['LEADER'],
          parallel_mode: parallelMode,
        }),
      });
      const data = await res.json();
      setLeaders(data.cards || []);
    } catch (error) {
      console.error('Fetch leaders error:', error);
      setLeaders([]);
    } finally {
      setLoading(false);
    }
  }, [parallelMode]);
  
  useEffect(() => {
    fetchLeaders();
  }, [fetchLeaders]);
  
  // 色フィルター適用
  const filteredLeaders = useMemo(() => {
    if (selectedColors.length === 0) return leaders;
    return leaders.filter(leader => 
      leader.color.some(c => selectedColors.includes(c))
    );
  }, [leaders, selectedColors]);
  
  // 利用可能な色一覧
  const availableColors = useMemo(() => {
    const colors = new Set<string>();
    leaders.forEach(leader => leader.color.forEach(c => colors.add(c)));
    return COLOR_ORDER.filter(c => colors.has(c));
  }, [leaders]);
  
  // 色の選択/解除
  const toggleColor = (color: string) => {
    setSelectedColors(prev => 
      prev.includes(color) 
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };
  
  // QRコード読み取り（クライアントサイドで処理、複数QR対応）
  const handleQrUpload = async (file: File) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          alert('Canvasの初期化に失敗しました');
          URL.revokeObjectURL(url);
          return;
        }
        
        // デッキ画像のレイアウト定数（imageGenerator.tsと同じ）
        const FINAL_WIDTH = 2150;
        const FINAL_HEIGHT = 2048;
        const GRID_HEIGHT = 1500;
        const UPPER_HEIGHT = FINAL_HEIGHT - GRID_HEIGHT;
        const CARD_WIDTH = 215;
        const CARD_HEIGHT = 300;
        const CARDS_PER_ROW = 10;
        const CARDS_PER_COL = 5;
        
        // 画像のスケール比率を計算
        const scaleX = img.width / FINAL_WIDTH;
        const scaleY = img.height / FINAL_HEIGHT;
        
        // グリッドの開始位置
        const gridStartX = Math.floor((FINAL_WIDTH - (CARD_WIDTH * CARDS_PER_ROW)) / 2);
        const gridStartY = UPPER_HEIGHT;
        
        // 単一QRを検出する関数
        const decodeQRFromRegion = (
          srcX: number,
          srcY: number,
          srcW: number,
          srcH: number,
          scale: number = 1
        ): string | null => {
          const w = Math.floor(srcW * scale);
          const h = Math.floor(srcH * scale);
          
          canvas.width = w;
          canvas.height = h;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h);
          
          const imageData = ctx.getImageData(0, 0, w, h);
          const code = jsQR(imageData.data, w, h, {
            inversionAttempts: 'attemptBoth',
          });
          
          return code?.data || null;
        };
        
        // 結果格納
        let deckQR: string | null = null;
        const blankCardQRs: string[] = [];
        
        // 1. メインQRコード（右上）を読み取り
        // QRは右上に400x400サイズで配置されている
        const qrX = (FINAL_WIDTH - 48 - 400) * scaleX;
        const qrY = ((UPPER_HEIGHT - 400) / 2) * scaleY;
        const qrW = 400 * scaleX;
        const qrH = 400 * scaleY;
        
        // 複数スケールで試行
        for (const scale of [1, 1.5, 2, 0.75]) {
          deckQR = decodeQRFromRegion(qrX, qrY, qrW, qrH, scale);
          if (deckQR && !deckQR.startsWith('B|')) break;
        }
        
        console.log('Deck QR:', deckQR ? 'found' : 'not found');
        
        // 2. 各カード位置のQRコードを読み取り（ブランクカード用）
        for (let row = 0; row < CARDS_PER_COL; row++) {
          for (let col = 0; col < CARDS_PER_ROW; col++) {
            // カードの位置（元画像のピクセル座標）
            const cardX = (gridStartX + col * CARD_WIDTH) * scaleX;
            const cardY = (gridStartY + row * CARD_HEIGHT) * scaleY;
            const cardW = CARD_WIDTH * scaleX;
            const cardH = CARD_HEIGHT * scaleY;
            
            // カード内のQRコード領域（イラストエリア内、約y=14%〜52%、中央70%幅）
            const qrAreaX = cardX + cardW * 0.15;
            const qrAreaY = cardY + cardH * 0.14;
            const qrAreaW = cardW * 0.70;
            const qrAreaH = cardH * 0.38;
            
            // QR読み取り試行
            let cardQR: string | null = null;
            for (const scale of [2, 3, 4, 1.5]) {
              cardQR = decodeQRFromRegion(qrAreaX, qrAreaY, qrAreaW, qrAreaH, scale);
              if (cardQR) break;
            }
            
            if (cardQR && cardQR.startsWith('B|') && !blankCardQRs.includes(cardQR)) {
              blankCardQRs.push(cardQR);
              console.log(`Found blank card QR at row=${row}, col=${col}`);
            }
          }
        }
        
        console.log(`Found ${blankCardQRs.length} blank card QRs`);
        
        // ブランクカードをデコード
        const blankCards: Card[] = [];
        for (const qr of blankCardQRs) {
          const card = decodeBlankCardFromQR(qr);
          if (card) {
            blankCards.push(card);
            console.log('Decoded blank card:', card.name);
          }
        }
        
        URL.revokeObjectURL(url);
        
        // 結果を処理
        if (deckQR || blankCards.length > 0) {
          // ブランクカードがあれば先にインポート
          if (blankCards.length > 0) {
            window.dispatchEvent(new CustomEvent('importBlankCards', { detail: blankCards }));
          }
          
          // デッキQRがあればインポート
          if (deckQR) {
            onImport(deckQR);
            
            if (blankCards.length > 0) {
              alert(`デッキをインポートしました。\nブランクカード ${blankCards.length} 種類も検出されました。`);
            }
          } else if (blankCards.length > 0) {
            alert(`ブランクカード ${blankCards.length} 種類をインポートしました。\n※ デッキのQRコードは検出されませんでした。`);
          }
        } else {
          alert('QRコードが検出されませんでした。\n画像が鮮明でない、またはQRコードが小さすぎる可能性があります。');
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        alert('画像の読み込みに失敗しました');
      };
      
      img.src = url;
    } catch (error) {
      console.error('QR decode error:', error);
      alert('QRコードの読み取りに失敗しました');
    }
  };
  
  // コンパクト表示判定
  const isCompact = colsCount >= 5;
  
  return (
    <div className="pb-20 lg:pb-4">
      <h2 className="text-xl font-bold mb-4">① リーダーを選択</h2>
      
      {/* インポートセクション */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">📥 デッキをインポート</h3>
          <button
            onClick={() => setShowImport(!showImport)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showImport ? '閉じる' : '開く'}
          </button>
        </div>
        
        {showImport && (
          <div className="space-y-3">
            {/* QRコードアップロード */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                QRコード画像からインポート
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleQrUpload(file);
                  }
                }}
                className="w-full text-sm"
              />
            </div>
            
            {/* テキストインポート */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                テキストからインポート
              </label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="1xOP03-040&#10;4xOP01-088&#10;..."
                className="w-full border rounded px-3 py-2 text-sm h-24"
              />
              <button
                onClick={() => {
                  if (importText.trim()) {
                    onImport(importText);
                  }
                }}
                disabled={!importText.trim()}
                className="mt-2 btn btn-primary btn-sm"
              >
                インポート実行
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* フィルター・表示設定 */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        {/* パラレルモード選択 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            リーダーバージョン
          </label>
          <div className="flex flex-wrap gap-2">
            {(['normal', 'parallel', 'both'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setParallelMode(mode)}
                className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                  parallelMode === mode
                    ? 'bg-yellow-500 text-white border-yellow-500'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                {mode === 'normal' ? '通常のみ' : mode === 'parallel' ? 'パラレルのみ' : '両方'}
              </button>
            ))}
          </div>
        </div>
        
        {/* 色フィルター */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            色で絞り込み
          </label>
          <div className="flex flex-wrap gap-2">
            {availableColors.map(color => (
              <button
                key={color}
                onClick={() => toggleColor(color)}
                className={`color-badge color-badge-${color} cursor-pointer transition-opacity ${
                  selectedColors.length === 0 || selectedColors.includes(color)
                    ? 'opacity-100'
                    : 'opacity-40'
                } ${selectedColors.includes(color) ? 'ring-2 ring-offset-1 ring-gray-800' : ''}`}
              >
                {color}
              </button>
            ))}
            {selectedColors.length > 0 && (
              <button
                onClick={() => setSelectedColors([])}
                className="text-xs text-gray-500 hover:text-gray-700 ml-2"
              >
                クリア
              </button>
            )}
          </div>
        </div>
        
        {/* 列数選択 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            表示列数
          </label>
          <select
            value={colsCount}
            onChange={(e) => setColsCount(Number(e.target.value))}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value={3}>3列</option>
            <option value={4}>4列</option>
            <option value={5}>5列（コンパクト）</option>
            <option value={6}>6列（コンパクト）</option>
          </select>
        </div>
      </div>
      
      {/* リーダー数表示 */}
      <div className="mb-3 text-sm text-gray-600">
        表示中: {filteredLeaders.length} / {leaders.length} 件
      </div>
      
      {/* リーダー一覧 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div 
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))` }}
        >
          {filteredLeaders.map((leader) => (
            <div
              key={leader.card_id}
              className="bg-white rounded-lg shadow overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => onSelect(leader)}
            >
              <div className="relative">
                <img
                  src={leader.image_url}
                  alt={leader.name}
                  className="w-full aspect-[400/560] object-cover"
                  loading="lazy"
                />
                {leader.is_parallel && (
                  <div className={`absolute top-0.5 left-0.5 bg-yellow-400 text-black font-bold rounded ${
                    isCompact ? 'text-[8px] px-0.5' : 'text-xs px-1.5 py-0.5'
                  }`}>
                    {isCompact ? 'P' : '✨P'}
                  </div>
                )}
              </div>
              {/* カード情報（コンパクト時は非表示） */}
              {!isCompact && (
                <div className="p-2">
                  <div className="text-sm font-medium truncate">{leader.name}</div>
                  <div className="text-xs text-gray-500">{leader.card_id}</div>
                  <div className="flex gap-1 mt-1">
                    {leader.color.map(c => (
                      <span key={c} className={`color-badge color-badge-${c}`}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}