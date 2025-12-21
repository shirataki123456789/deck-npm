'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, FilterOptions, DEFAULT_FILTER_OPTIONS, COLOR_ORDER } from '@/lib/types';
import { decodeBlankCardFromQR } from '@/lib/blankCardQR';
import { drawBlankCardPlaceholder } from '@/lib/imageGenerator';
import jsQR from 'jsqr';

// ブランクリーダー表示用Canvas
function BlankLeaderCanvas({ card, onClick }: { card: Card; onClick?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) return;
    
    const containerHeight = Math.round(containerWidth * (560 / 400));
    
    const scale = window.devicePixelRatio || 1;
    canvas.width = containerWidth * scale;
    canvas.height = containerHeight * scale;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    
    ctx.scale(scale, scale);
    drawBlankCardPlaceholder(ctx, card, 0, 0, containerWidth, containerHeight);
  }, [card]);
  
  return (
    <div 
      ref={containerRef} 
      className="w-full aspect-[400/560] cursor-pointer"
      onClick={onClick}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

interface LeaderSelectProps {
  onSelect: (card: Card) => void;
  onImport: (text: string) => void;
  blankLeaders?: Card[]; // ブランクカードのリーダー
  onCreateBlankLeader?: (card: Card) => void; // ブランクリーダー作成
  onEditBlankLeader?: (card: Card) => void; // ブランクリーダー編集
  onDeleteBlankLeader?: (cardId: string) => void; // ブランクリーダー削除
  existingCardIds?: string[]; // 既存のカードID（重複チェック用）
}

export default function LeaderSelect({ 
  onSelect, 
  onImport, 
  blankLeaders = [],
  onCreateBlankLeader,
  onEditBlankLeader,
  onDeleteBlankLeader,
  existingCardIds = [],
}: LeaderSelectProps) {
  const [leaders, setLeaders] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [parallelMode, setParallelMode] = useState<'normal' | 'parallel' | 'both'>('normal');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [colsCount, setColsCount] = useState(4);
  const [showBlankLeaderModal, setShowBlankLeaderModal] = useState(false);
  const [editingLeader, setEditingLeader] = useState<Card | null>(null);
  
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
  
  // ブランクリーダーを含む全リーダー
  const allLeaders = useMemo(() => {
    return [...blankLeaders, ...leaders];
  }, [blankLeaders, leaders]);
  
  // 色フィルター適用
  const filteredLeaders = useMemo(() => {
    if (selectedColors.length === 0) return allLeaders;
    return allLeaders.filter(leader => 
      leader.color.some(c => selectedColors.includes(c))
    );
  }, [allLeaders, selectedColors]);
  
  // 利用可能な色一覧
  const availableColors = useMemo(() => {
    const colors = new Set<string>();
    allLeaders.forEach(leader => leader.color.forEach(c => colors.add(c)));
    return COLOR_ORDER.filter(c => colors.has(c));
  }, [allLeaders]);
  
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
        
        // 二値化処理付きQR検出
        const decodeQRFromRegionWithThreshold = (
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
          const data = imageData.data;
          
          // 二値化処理
          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const val = avg > 128 ? 255 : 0;
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
          }
          
          const code = jsQR(data, w, h, {
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
        
        // 1.5. リーダーエリア（左上）のブランクリーダーQRを読み取り
        // ブランクリーダーはリーダーエリア全体に表示され、右下にQRがある
        const leaderAreaW = UPPER_HEIGHT * (400 / 560); // アスペクト比維持
        const leaderAreaH = UPPER_HEIGHT;
        const leaderQrAreaX = 48 * scaleX + leaderAreaW * scaleX * 0.55; // リーダー右半分
        const leaderQrAreaY = leaderAreaH * scaleY * 0.55; // 下半分
        const leaderQrAreaW = leaderAreaW * scaleX * 0.42;
        const leaderQrAreaH = leaderAreaH * scaleY * 0.42;
        
        let leaderBlankQR: string | null = null;
        const leaderScales = [2, 2.5, 3, 3.5, 4, 1.5, 1];
        
        for (const scale of leaderScales) {
          leaderBlankQR = decodeQRFromRegion(leaderQrAreaX, leaderQrAreaY, leaderQrAreaW, leaderQrAreaH, scale);
          if (leaderBlankQR && leaderBlankQR.startsWith('B|')) {
            console.log(`Blank leader QR found at scale=${scale}`);
            break;
          }
          
          // 二値化も試す
          leaderBlankQR = decodeQRFromRegionWithThreshold(leaderQrAreaX, leaderQrAreaY, leaderQrAreaW, leaderQrAreaH, scale);
          if (leaderBlankQR && leaderBlankQR.startsWith('B|')) {
            console.log(`Blank leader QR found at scale=${scale} (threshold)`);
            break;
          }
          
          leaderBlankQR = null;
        }
        
        if (leaderBlankQR && leaderBlankQR.startsWith('B|') && !blankCardQRs.includes(leaderBlankQR)) {
          blankCardQRs.push(leaderBlankQR);
          console.log('Added blank leader QR:', leaderBlankQR.substring(0, 50));
        }
        
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
            
            // 様々なスケールで試行（より多くのスケールを試す）
            const scales = [3, 4, 5, 6, 2, 2.5, 3.5, 4.5, 1.5, 7, 8];
            
            for (const scale of scales) {
              // 通常の読み取り
              cardQR = decodeQRFromRegion(qrAreaX, qrAreaY, qrAreaW, qrAreaH, scale);
              if (cardQR && cardQR.startsWith('B|')) {
                console.log(`[row=${row}, col=${col}] scale=${scale} found`);
                break;
              }
              
              // 二値化処理を試す
              cardQR = decodeQRFromRegionWithThreshold(qrAreaX, qrAreaY, qrAreaW, qrAreaH, scale);
              if (cardQR && cardQR.startsWith('B|')) {
                console.log(`[row=${row}, col=${col}] scale=${scale} (threshold) found`);
                break;
              }
              
              cardQR = null;
            }
            
            // 見つからない場合、少し広い領域で試す
            if (!cardQR) {
              const qrAreaX2 = cardX + cardW * 0.10;
              const qrAreaY2 = cardY + cardH * 0.12;
              const qrAreaW2 = cardW * 0.80;
              const qrAreaH2 = cardH * 0.42;
              
              for (const scale of [3, 4, 5, 6]) {
                cardQR = decodeQRFromRegion(qrAreaX2, qrAreaY2, qrAreaW2, qrAreaH2, scale);
                if (cardQR && cardQR.startsWith('B|')) {
                  console.log(`[row=${row}, col=${col}] scale=${scale} (wider area) found`);
                  break;
                }
                cardQR = null;
              }
            }
            
            if (cardQR && cardQR.startsWith('B|') && !blankCardQRs.includes(cardQR)) {
              blankCardQRs.push(cardQR);
              console.log(`Added blank card QR from row=${row}, col=${col}: ${cardQR.substring(0, 40)}...`);
            }
          }
        }
        
        console.log(`Found ${blankCardQRs.length} blank card QRs`);
        
        // ブランクカードをデコード
        const blankCards: Card[] = [];
        const blankLeadersFromQR: Card[] = [];
        for (const qr of blankCardQRs) {
          const card = decodeBlankCardFromQR(qr);
          if (card) {
            if (card.type === 'LEADER') {
              blankLeadersFromQR.push(card);
              console.log('Decoded blank leader:', card.name);
            } else {
              blankCards.push(card);
              console.log('Decoded blank card:', card.name);
            }
          }
        }
        
        URL.revokeObjectURL(url);
        
        // 結果を処理
        if (deckQR || blankCards.length > 0 || blankLeadersFromQR.length > 0) {
          // ブランクカード（リーダー以外）があれば先にインポート
          if (blankCards.length > 0) {
            window.dispatchEvent(new CustomEvent('importBlankCards', { detail: blankCards }));
          }
          
          // ブランクリーダーがあればインポート
          if (blankLeadersFromQR.length > 0) {
            window.dispatchEvent(new CustomEvent('importBlankCards', { detail: blankLeadersFromQR }));
          }
          
          // デッキQRがあればインポート
          if (deckQR) {
            onImport(deckQR);
            
            const importedParts: string[] = [];
            if (blankLeadersFromQR.length > 0) {
              importedParts.push(`ブランクリーダー ${blankLeadersFromQR.length} 種類`);
            }
            if (blankCards.length > 0) {
              importedParts.push(`ブランクカード ${blankCards.length} 種類`);
            }
            
            if (importedParts.length > 0) {
              alert(`デッキをインポートしました。\n${importedParts.join('、')}も検出されました。`);
            }
          } else {
            const importedParts: string[] = [];
            if (blankLeadersFromQR.length > 0) {
              importedParts.push(`ブランクリーダー ${blankLeadersFromQR.length} 種類`);
            }
            if (blankCards.length > 0) {
              importedParts.push(`ブランクカード ${blankCards.length} 種類`);
            }
            
            if (importedParts.length > 0) {
              alert(`${importedParts.join('、')}をインポートしました。\n※ デッキのQRコードは検出されませんでした。`);
            }
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
      
      {/* ブランクリーダー作成セクション */}
      {onCreateBlankLeader && (
        <div className="bg-purple-50 rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-purple-800">📝 ブランクリーダー</h3>
              <p className="text-sm text-purple-600">未発表カードやオリジナルリーダーを作成</p>
            </div>
            <button
              onClick={() => {
                setEditingLeader(null);
                setShowBlankLeaderModal(true);
              }}
              className="btn bg-purple-600 hover:bg-purple-700 text-white"
            >
              ➕ 作成
            </button>
          </div>
          
          {/* 作成済みブランクリーダー一覧 */}
          {blankLeaders.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-purple-700">作成済み ({blankLeaders.length}件)</p>
              <div className="flex flex-wrap gap-2">
                {blankLeaders.map(leader => (
                  <div
                    key={leader.card_id}
                    className="flex items-center gap-2 bg-white rounded px-2 py-1 text-sm"
                  >
                    <span className="font-medium">{leader.name}</span>
                    <div className="flex gap-0.5">
                      {leader.color.map(c => (
                        <span key={c} className={`color-badge color-badge-${c} text-xs`}>{c}</span>
                      ))}
                    </div>
                    {onEditBlankLeader && (
                      <button
                        onClick={() => {
                          setEditingLeader(leader);
                          setShowBlankLeaderModal(true);
                        }}
                        className="text-purple-600 hover:text-purple-800"
                      >
                        ✏️
                      </button>
                    )}
                    {onDeleteBlankLeader && (
                      <button
                        onClick={() => {
                          if (confirm(`「${leader.name}」を削除しますか？`)) {
                            onDeleteBlankLeader(leader.card_id);
                          }
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
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
          {filteredLeaders.map((leader) => {
            const isBlankLeader = !leader.image_url;
            
            return (
              <div
                key={leader.card_id}
                className="bg-white rounded-lg shadow overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => onSelect(leader)}
              >
                <div className="relative">
                  {isBlankLeader ? (
                    <BlankLeaderCanvas card={leader} />
                  ) : (
                    <img
                      src={leader.image_url}
                      alt={leader.name}
                      className="w-full aspect-[400/560] object-cover"
                      loading="lazy"
                    />
                  )}
                  {leader.is_parallel && (
                    <div className={`absolute top-0.5 left-0.5 bg-yellow-400 text-black font-bold rounded ${
                      isCompact ? 'text-[8px] px-0.5' : 'text-xs px-1.5 py-0.5'
                    }`}>
                      {isCompact ? 'P' : '✨P'}
                    </div>
                  )}
                  {isBlankLeader && (
                    <div className={`absolute top-0.5 right-0.5 bg-purple-600 text-white font-bold rounded ${
                      isCompact ? 'text-[8px] px-0.5' : 'text-xs px-1.5 py-0.5'
                    }`}>
                      {isCompact ? '📝' : '📝 BLANK'}
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
            );
          })}
        </div>
      )}
      
      {/* ブランクリーダー作成/編集モーダル */}
      {showBlankLeaderModal && onCreateBlankLeader && (
        <BlankLeaderModal
          isOpen={showBlankLeaderModal}
          onClose={() => {
            setShowBlankLeaderModal(false);
            setEditingLeader(null);
          }}
          onSubmit={(card) => {
            if (editingLeader && onEditBlankLeader) {
              onEditBlankLeader(card);
            } else {
              onCreateBlankLeader(card);
            }
            setShowBlankLeaderModal(false);
            setEditingLeader(null);
          }}
          editCard={editingLeader}
          existingIds={existingCardIds}
        />
      )}
    </div>
  );
}

// ブランクリーダー作成モーダル
export interface BlankLeaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (card: Card) => void;
  editCard?: Card | null;
  existingIds: string[];
  availableAttributes?: string[]; // 属性リスト
}

let blankLeaderCounter = Date.now() % 10000;
const generateBlankLeaderId = () => {
  blankLeaderCounter++;
  return `BLANK-L${String(blankLeaderCounter).padStart(3, '0')}`;
};

export function BlankLeaderModal({ isOpen, onClose, onSubmit, editCard, existingIds, availableAttributes = [] }: BlankLeaderModalProps) {
  const [cardId, setCardId] = useState('');
  const [name, setName] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [life, setLife] = useState(5);
  const [power, setPower] = useState(5000);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [features, setFeatures] = useState('');
  const [effectText, setEffectText] = useState('');
  const [error, setError] = useState('');
  
  const isEditMode = !!editCard;
  
  // デフォルトの属性リスト
  const defaultAttributes = ['斬', '打', '射', '知', '特'];
  const attrs = availableAttributes.length > 0 ? availableAttributes : defaultAttributes;
  
  useEffect(() => {
    if (editCard) {
      setCardId(editCard.card_id);
      setName(editCard.name);
      setSelectedColors(editCard.color);
      setLife(editCard.block_icon ? parseInt(editCard.block_icon) || 5 : 5);
      setPower(editCard.power);
      setSelectedAttributes(editCard.attribute ? editCard.attribute.split('/') : []);
      setFeatures(editCard.features.join('/'));
      setEffectText(editCard.text || '');
      setError('');
    } else {
      resetForm();
    }
  }, [editCard, isOpen]);
  
  const resetForm = () => {
    setCardId('');
    setName('');
    setSelectedColors([]);
    setLife(5);
    setPower(5000);
    setSelectedAttributes([]);
    setFeatures('');
    setEffectText('');
    setError('');
  };
  
  const toggleColor = (color: string) => {
    setSelectedColors(prev =>
      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
    );
  };
  
  const toggleAttribute = (attr: string) => {
    setSelectedAttributes(prev =>
      prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]
    );
  };
  
  const handleSubmit = () => {
    if (!name.trim()) {
      setError('カード名を入力してください');
      return;
    }
    if (selectedColors.length === 0) {
      setError('色を1つ以上選択してください');
      return;
    }
    
    let finalId = isEditMode ? editCard!.card_id : (cardId.trim() || generateBlankLeaderId());
    
    if (!isEditMode && cardId.trim() && existingIds.includes(finalId)) {
      setError('このカードIDは既に存在します');
      return;
    }
    
    const card: Card = {
      name: name.trim(),
      card_id: finalId,
      card_code: '',
      type: 'LEADER',
      rarity: 'L',
      cost: -1,
      attribute: selectedAttributes.join('/'),
      power: power,
      counter: 0,
      color: selectedColors,
      block_icon: String(life),
      features: features.split(/[\/,]/).map(f => f.trim()).filter(f => f),
      text: effectText,
      trigger: '',
      source: 'ブランクリーダー（手動追加）',
      image_url: '',
      is_parallel: false,
      series_id: 'BLANK',
    };
    
    onSubmit(card);
    resetForm();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">
              {isEditMode ? '📝 ブランクリーダー編集' : '📝 ブランクリーダー作成'}
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          
          {error && (
            <div className="mb-4 p-2 bg-red-100 text-red-700 rounded text-sm">{error}</div>
          )}
          
          <div className="space-y-4">
            {/* カードID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                カードID（空欄で自動生成）
              </label>
              <input
                type="text"
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                disabled={isEditMode}
                placeholder="例: OP10-001"
                className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100"
              />
            </div>
            
            {/* カード名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                カード名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="リーダー名"
                className="w-full border rounded px-3 py-2 text-sm"
              />
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
            
            {/* ライフ・パワー */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ライフ</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={life}
                  onChange={(e) => setLife(Number(e.target.value))}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">パワー</label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="1000"
                  value={power}
                  onChange={(e) => setPower(Number(e.target.value))}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            
            {/* 属性 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">属性（複数選択可）</label>
              <div className="flex flex-wrap gap-2">
                {attrs.map(attr => (
                  <button
                    key={attr}
                    type="button"
                    onClick={() => toggleAttribute(attr)}
                    className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                      selectedAttributes.includes(attr)
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {attr}
                  </button>
                ))}
              </div>
              {selectedAttributes.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">選択中: {selectedAttributes.join('/')}</p>
              )}
            </div>
            
            {/* 特徴 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">特徴（/区切り）</label>
              <input
                type="text"
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                placeholder="麦わらの一味/超新星 など"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            
            {/* 効果テキスト */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">効果テキスト</label>
              <textarea
                value={effectText}
                onChange={(e) => setEffectText(e.target.value)}
                placeholder="効果テキスト"
                rows={3}
                className="w-full border rounded px-3 py-2 text-sm resize-y"
              />
            </div>
          </div>
          
          <div className="flex gap-2 mt-6">
            <button onClick={onClose} className="flex-1 btn btn-secondary">
              キャンセル
            </button>
            <button onClick={handleSubmit} className="flex-1 btn bg-purple-600 hover:bg-purple-700 text-white">
              {isEditMode ? '更新' : '作成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}