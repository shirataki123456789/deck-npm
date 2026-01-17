'use client';

import { useState, useEffect } from 'react';
import { Card, Deck, UNLIMITED_CARDS } from '@/lib/types';
import { generateDeckImage, DeckImageCard } from '@/lib/imageGenerator';
import { encodeBlankCardForQR } from '@/lib/blankCardQR';
import QRCode from 'qrcode';

interface DeckSidebarProps {
  deck: Deck;
  setDeck: (deck: Deck) => void;
  leaderCard: Card | null;
  donCard?: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onRemoveCard: (cardId: string) => void;
  onAddCard: (card: Card) => void;
  onPreview: () => void;
  allCards?: Card[];
  blankCards?: Card[];
  onEditBlankCard?: (card: Card) => void;
  onOpenCsvEditor?: () => void;
}

interface DeckCardInfo {
  card_id: string;
  name: string;
  count: number;
  image_url?: string;
  card?: Card;
}

export default function DeckSidebar({
  deck,
  setDeck,
  leaderCard,
  donCard,
  isOpen,
  onClose,
  onRemoveCard,
  onAddCard,
  onPreview,
  allCards = [],
  blankCards = [],
  onEditBlankCard,
  onOpenCsvEditor,
}: DeckSidebarProps) {
  const [deckCardInfos, setDeckCardInfos] = useState<DeckCardInfo[]>([]);
  const [exportText, setExportText] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState('');
  
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
        // APIから取得できるカードIDとブランクカードIDを分離
        const blankCardIds = cardIds.filter(id => id.startsWith('BLANK-'));
        const normalCardIds = cardIds.filter(id => !id.startsWith('BLANK-'));
        
        const infos: DeckCardInfo[] = [];
        
        // ブランクカードはallCardsから取得
        blankCardIds.forEach(id => {
          const card = allCards.find(c => c.card_id === id);
          if (card) {
            infos.push({
              card_id: card.card_id,
              name: card.name,
              count: deck.cards[id] || 0,
              image_url: card.image_url || '',
              card: card, // ブランクカード情報を保持
            });
          }
        });
        
        // 通常カードはAPIから取得
        if (normalCardIds.length > 0) {
          const res = await fetch('/api/deck', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'sort',
              card_ids: normalCardIds,
            }),
          });
          const data = await res.json();
          
          if (data.cards) {
            data.cards.forEach((c: any) => {
              infos.push({
                card_id: c.card_id,
                name: c.name,
                count: deck.cards[c.card_id] || 0,
                image_url: c.image_url,
              });
            });
          }
        }
        
        setDeckCardInfos(infos);
      } catch (error) {
        console.error('Fetch card infos error:', error);
        // フォールバック：IDのみで表示
        const infos = cardIds.map(id => {
          const blankCard = allCards.find(c => c.card_id === id);
          return {
            card_id: id,
            name: blankCard?.name || id,
            count: deck.cards[id] || 0,
            card: blankCard,
          };
        });
        setDeckCardInfos(infos);
      }
    };
    
    fetchCardInfos();
  }, [deck.cards, allCards]);
  
  // デッキエクスポート（通常）
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
      let text = data.text || '';
      
      // ドンカード情報を追加
      if (donCard) {
        text += `\n#DON:${donCard.card_id}`;
      }
      
      setExportText(text);
      setShowExport(true);
    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポートに失敗しました');
    }
  };
  
  // デッキ画像生成（クライアントサイド）
  const handleGenerateImage = async () => {
    if (!leaderCard) return;
    
    setGenerating(true);
    setGenerateProgress('準備中...');
    
    try {
      // エクスポートテキストを取得（ブランクカードは除外してQR生成）
      const normalCardIds = Object.keys(deck.cards).filter(id => !id.startsWith('BLANK-'));
      const blankCardEntries = Object.entries(deck.cards).filter(([id]) => id.startsWith('BLANK-'));
      const normalDeck = {
        ...deck,
        cards: Object.fromEntries(
          Object.entries(deck.cards).filter(([id]) => !id.startsWith('BLANK-'))
        ),
      };
      
      const exportRes = await fetch('/api/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          deck: normalDeck,
        }),
      });
      const exportData = await exportRes.json();
      let qrText = exportData.text || '';
      
      // ブランクカードの枚数情報を追加
      // フォーマット: #BLANK:ID=枚数,ID=枚数
      if (blankCardEntries.length > 0) {
        const blankInfo = blankCardEntries.map(([id, count]) => `${id}=${count}`).join(',');
        qrText += `\n#BLANK:${blankInfo}`;
      }
      
      // ブランクリーダーの場合、リーダー情報もQRに追加
      const isBlankLeader = !leaderCard.image_url;
      if (isBlankLeader) {
        const leaderEncoded = encodeBlankCardForQR(leaderCard);
        qrText += `\n#LEADER:${leaderEncoded}`;
      }
      
      // ドンカード情報を追加
      if (donCard) {
        qrText += `\n#DON:${donCard.card_id}`;
      }
      
      // QRコードをData URLとして生成
      const qrDataUrl = qrText ? await QRCode.toDataURL(qrText, {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }) : '';
      
      // カード情報リストを作成（ブランクカード対応）
      const cards: DeckImageCard[] = [];
      
      // ブランクカード用のQRコードを事前生成（重複を避けるためキャッシュ）
      const blankCardQRCache: Record<string, string> = {};
      for (const info of deckCardInfos) {
        // 画像URLがないカードはすべてブランクカードとしてQR生成
        if (info.card && !info.image_url) {
          if (!blankCardQRCache[info.card.card_id]) {
            try {
              const encoded = encodeBlankCardForQR(info.card);
              console.log(`Blank card QR data length: ${encoded.length} chars`);
              
              // QRコードを高解像度で生成（読み取り精度向上のため）
              blankCardQRCache[info.card.card_id] = await QRCode.toDataURL(encoded, {
                width: 400, // 大きめに生成
                margin: 2,  // マージンを少し大きく
                errorCorrectionLevel: 'M', // 中程度のエラー訂正（読み取り精度とサイズのバランス）
                color: { dark: '#000000', light: '#ffffff' },
              });
            } catch (e) {
              console.warn('Failed to generate QR for blank card:', info.card.card_id, e);
            }
          }
        }
      }
      
      deckCardInfos.forEach(info => {
        for (let i = 0; i < info.count; i++) {
          if (info.card && !info.image_url) {
            // ブランクカード（QRコード付き）
            cards.push({
              url: '',
              card: info.card,
              qrDataUrl: blankCardQRCache[info.card.card_id] || undefined,
            });
          } else {
            // 通常カード
            cards.push({
              url: info.image_url || `https://www.onepiece-cardgame.com/images/cardlist/card/${info.card_id}.png`,
            });
          }
        }
      });
      
      // クライアントサイドで画像生成（isBlankLeaderは上で定義済み）
      const blob = await generateDeckImage({
        leaderUrl: leaderCard.image_url,
        leaderCard: isBlankLeader ? leaderCard : undefined,
        leaderQrDataUrl: undefined, // ブランクリーダー情報はメインQRに含まれる
        donCard: donCard || undefined,
        donUrl: donCard?.image_url || undefined,
        cardUrls: [], // 後方互換性のため空配列
        cards: cards.slice(0, 50),
        deckName: deck.name,
        qrDataUrl,
        leaderColors: leaderCard.color,
        onProgress: (progress, message) => {
          setGenerateProgress(message);
        },
      });
      
      // ファイル名: デッキ名_シリーズ名（リーダーIDから取得）
      const seriesMatch = leaderCard.card_id.match(/^([A-Z]+\d+)/);
      const seriesName = seriesMatch ? seriesMatch[1] : '';
      const deckNameForFile = deck.name || 'deck';
      const safeDeckName = deckNameForFile.replace(/[\\/:*?"<>|]/g, '_');
      const fileName = seriesName ? `${safeDeckName}_${seriesName}.png` : `${safeDeckName}.png`;
      
      // ダウンロード
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Generate image error:', error);
      alert('画像生成に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
    } finally {
      setGenerating(false);
      setGenerateProgress('');
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
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="p-4 pb-32 lg:pb-4">
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
            📤 エクスポート
          </button>
          
          <button
            onClick={handleGenerateImage}
            disabled={generating || !leaderCard}
            className="w-full btn btn-success btn-sm"
          >
            {generating ? generateProgress || '生成中...' : '🖼️ デッキ画像を生成'}
          </button>
        </div>
        
        {/* ブランクカード管理 */}
        {blankCards.length > 0 && (
          <div className="mt-4 p-3 bg-purple-50 rounded-lg">
            <h4 className="font-medium text-sm mb-2 text-purple-800">
              📝 ブランクカード ({blankCards.length}種)
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {blankCards.map(card => (
                <div
                  key={card.card_id}
                  className="flex items-center justify-between p-1.5 bg-white rounded text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{card.name}</div>
                    <div className="text-gray-500">{card.card_id}</div>
                  </div>
                  {onEditBlankCard && (
                    <button
                      onClick={() => onEditBlankCard(card)}
                      className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
                    >
                      編集
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {/* CSV編集ボタン */}
            {onOpenCsvEditor && (
              <button
                onClick={onOpenCsvEditor}
                className="w-full mt-2 btn btn-sm bg-purple-600 hover:bg-purple-700 text-white"
              >
                📄 CSVにエクスポート
              </button>
            )}
          </div>
        )}
        
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
                {exportText.length > 2000 ? (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                    ⚠️ データ量が多すぎるため、QRコードでの読み取りができない可能性があります。
                    テキストをコピーまたは保存してご利用ください。
                  </div>
                ) : (
                  <>
                    <img
                      src={`/api/qr?text=${encodeURIComponent(exportText)}&size=200`}
                      alt="QR Code"
                      className="w-full max-w-[200px] mx-auto"
                    />
                    {exportText.length > 1000 && (
                      <p className="text-xs text-yellow-600 mt-1">
                        ⚠️ データ量が多いため、読み取りに失敗する場合があります
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
