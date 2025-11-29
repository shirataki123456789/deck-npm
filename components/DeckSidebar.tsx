'use client';

import { useState, useEffect } from 'react';
import { Card, Deck, UNLIMITED_CARDS } from '@/lib/types';

interface DeckSidebarProps {
  deck: Deck;
  setDeck: (deck: Deck) => void;
  leaderCard: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onRemoveCard: (cardId: string) => void;
  onAddCard: (card: Card) => void;
  onPreview: () => void;
}

interface DeckCardInfo {
  card_id: string;
  name: string;
  count: number;
  image_url?: string;
}

export default function DeckSidebar({
  deck,
  setDeck,
  leaderCard,
  isOpen,
  onClose,
  onRemoveCard,
  onAddCard,
  onPreview,
}: DeckSidebarProps) {
  const [deckCardInfos, setDeckCardInfos] = useState<DeckCardInfo[]>([]);
  const [exportText, setExportText] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const totalCards = Object.values(deck.cards).reduce((sum, count) => sum + count, 0);
  
  // デッキカード情報を取得
  useEffect(() => {
    const fetchCardInfos = async () => {
      const cardIds = Object.keys(deck.cards);
      if (cardIds.length === 0) {
        setDeckCardInfos([]);
        return;
      }
      
      try {
        // カード情報を取得してソート
        const res = await fetch('/api/deck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sort',
            card_ids: cardIds,
          }),
        });
        const data = await res.json();
        
        if (data.cards) {
          const infos: DeckCardInfo[] = data.cards.map((c: any) => ({
            card_id: c.card_id,
            name: c.name,
            count: deck.cards[c.card_id] || 0,
            image_url: c.image_url,
          }));
          setDeckCardInfos(infos);
        }
      } catch (error) {
        console.error('Fetch card infos error:', error);
        // フォールバック：IDのみで表示
        const infos = cardIds.map(id => ({
          card_id: id,
          name: id,
          count: deck.cards[id] || 0,
        }));
        setDeckCardInfos(infos);
      }
    };
    
    fetchCardInfos();
  }, [deck.cards]);
  
  // デッキエクスポート
  const handleExport = async () => {
    try {
      const res = await fetch('/api/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          deck: deck,
        }),
      });
      const data = await res.json();
      setExportText(data.text || '');
      setShowExport(true);
    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポートに失敗しました');
    }
  };
  
  // デッキ画像生成
  const handleGenerateImage = async () => {
    if (!leaderCard) return;
    
    setGenerating(true);
    try {
      // エクスポートテキストを取得
      const exportRes = await fetch('/api/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          deck: deck,
        }),
      });
      const exportData = await exportRes.json();
      const qrText = exportData.text || '';
      
      // カード画像URLリストを作成
      const cardUrls: string[] = [];
      deckCardInfos.forEach(info => {
        for (let i = 0; i < info.count; i++) {
          cardUrls.push(info.image_url || `https://www.onepiece-cardgame.com/images/cardlist/card/${info.card_id}.png`);
        }
      });
      
      // 画像生成
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leader_url: leaderCard.image_url,
          card_urls: cardUrls.slice(0, 50),
          deck_name: deck.name,
          qr_text: qrText,
          leader_colors: leaderCard.color,
        }),
      });
      
      if (!res.ok) {
        throw new Error('画像生成に失敗しました');
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      // ダウンロード
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deck.name || 'deck'}_image.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Generate image error:', error);
      alert('画像生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };
  
  return (
    <aside
      className={`
        fixed lg:sticky top-0 right-0
        w-80 h-screen overflow-y-auto
        bg-white shadow-lg z-50
        transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}
    >
      <div className="p-4">
        {/* モバイル用閉じるボタン */}
        <div className="flex items-center justify-between mb-4 lg:hidden">
          <h2 className="font-bold text-lg">🧾 現在のデッキ</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded"
          >
            ✕
          </button>
        </div>
        
        <h2 className="font-bold text-lg mb-4 hidden lg:block">🧾 現在のデッキ</h2>
        
        {/* リーダー情報 */}
        {leaderCard && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium">リーダー:</div>
            <div className="text-sm">{leaderCard.name}</div>
            <div className="text-xs text-gray-500">{leaderCard.card_id}</div>
          </div>
        )}
        
        {/* デッキ名 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            デッキ名
          </label>
          <input
            type="text"
            value={deck.name}
            onChange={(e) => setDeck({ ...deck, name: e.target.value })}
            placeholder="デッキ名を入力"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        
        {/* カード枚数 */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="font-medium">合計カード:</span>
            <span className={`font-bold ${
              totalCards === 50 ? 'text-green-600' : 
              totalCards > 50 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {totalCards}/50
            </span>
          </div>
          
          {totalCards > 50 && (
            <p className="text-red-600 text-sm mt-1">⚠️ 50枚を超えています！</p>
          )}
          {totalCards < 50 && (
            <p className="text-gray-600 text-sm mt-1">残り {50 - totalCards} 枚を追加できます</p>
          )}
          {totalCards === 50 && (
            <p className="text-green-600 text-sm mt-1">✅ デッキが完成しました！</p>
          )}
        </div>
        
        {/* カードリスト */}
        <div className="mb-4 max-h-64 overflow-y-auto">
          <h3 className="font-medium text-sm mb-2">カードリスト</h3>
          {deckCardInfos.length === 0 ? (
            <p className="text-gray-500 text-sm">カードがありません</p>
          ) : (
            <div className="space-y-2">
              {deckCardInfos.map(info => (
                <div
                  key={info.card_id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{info.name}</div>
                    <div className="text-xs text-gray-500">
                      {info.card_id} × {info.count}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => {
                        const card: Card = {
                          card_id: info.card_id,
                          name: info.name,
                          image_url: info.image_url || '',
                          card_code: '',
                          type: '',
                          rarity: '',
                          cost: 0,
                          attribute: '',
                          power: 0,
                          counter: 0,
                          color: [],
                          block_icon: '',
                          features: [],
                          text: '',
                          trigger: '',
                          source: '',
                          is_parallel: false,
                          series_id: '',
                        };
                        onAddCard(card);
                      }}
                      disabled={!UNLIMITED_CARDS.includes(info.card_id) && info.count >= 4}
                      className="w-6 h-6 flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-xs"
                    >
                      ＋
                    </button>
                    <button
                      onClick={() => onRemoveCard(info.card_id)}
                      className="w-6 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                    >
                      −
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* デッキ管理ボタン */}
        <div className="space-y-2">
          <button
            onClick={onPreview}
            className="w-full btn btn-secondary btn-sm"
          >
            👁️ デッキプレビュー
          </button>
          
          <button
            onClick={handleExport}
            className="w-full btn btn-secondary btn-sm"
          >
            📤 デッキをエクスポート
          </button>
          
          <button
            onClick={handleGenerateImage}
            disabled={generating || !leaderCard}
            className="w-full btn btn-success btn-sm"
          >
            {generating ? '生成中...' : '🖼️ デッキ画像を生成'}
          </button>
        </div>
        
        {/* エクスポートテキスト表示 */}
        {showExport && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">エクスポート</h4>
              <button
                onClick={() => setShowExport(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <textarea
              readOnly
              value={exportText}
              className="w-full border rounded px-2 py-1 text-xs h-32"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportText);
                  alert('コピーしました');
                }}
                className="flex-1 btn btn-sm btn-secondary"
              >
                コピー
              </button>
              <a
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(exportText)}`}
                download={`${deck.name || 'deck'}_export.txt`}
                className="flex-1 btn btn-sm btn-secondary text-center"
              >
                保存
              </a>
            </div>
            
            {/* QRコード */}
            {exportText && (
              <div className="mt-3">
                <h5 className="font-medium text-xs mb-1">QRコード</h5>
                <img
                  src={`/api/qr?text=${encodeURIComponent(exportText)}&size=200`}
                  alt="QR Code"
                  className="w-full max-w-[200px] mx-auto"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
