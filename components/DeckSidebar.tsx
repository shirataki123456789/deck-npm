'use client';

import { useState, useEffect } from 'react';
import { Card, Deck, UNLIMITED_CARDS } from '@/lib/types';
import { generateDeckImage, DeckImageCard } from '@/lib/imageGenerator';
import QRCode from 'qrcode';

interface DeckSidebarProps {
  deck: Deck;
  setDeck: (deck: Deck) => void;
  leaderCard: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onRemoveCard: (cardId: string) => void;
  onAddCard: (card: Card) => void;
  onPreview: () => void;
  allCards?: Card[];
  blankCards?: Card[];
  onEditBlankCard?: (card: Card) => void;
  onImportBlankCards?: (cards: Card[], counts: Record<string, number>) => void;
}

interface DeckCardInfo {
  card_id: string;
  name: string;
  count: number;
  image_url?: string;
  card?: Card;
}

// ブランクカードをJSON形式でシリアライズ（特徴と効果テキストも含む）
const serializeBlankCards = (cards: Card[]): string => {
  return JSON.stringify(cards.map(c => ({
    id: c.card_id,
    name: c.name,
    type: c.type,
    color: c.color,
    cost: c.cost,
    power: c.power,
    counter: c.counter,
    attribute: c.attribute,
    features: c.features,
    text: c.text,
    trigger: c.trigger,
  })));
};

// ブランクカードをJSONからデシリアライズ
const deserializeBlankCards = (json: string): Card[] => {
  try {
    const data = JSON.parse(json);
    return data.map((c: any) => ({
      name: c.name || '不明カード',
      card_id: c.id || `BLANK-${Date.now()}`,
      card_code: '',
      type: c.type || 'CHARACTER',
      rarity: '?',
      cost: c.cost ?? 0,
      attribute: c.attribute || '',
      power: c.power ?? 0,
      counter: c.counter ?? 0,
      color: c.color || [],
      block_icon: '',
      features: c.features || [],
      text: c.text || '',
      trigger: c.trigger || '',
      source: 'ブランクカード（インポート）',
      image_url: '',
      is_parallel: false,
      series_id: 'BLANK',
    }));
  } catch {
    return [];
  }
};

export default function DeckSidebar({
  deck,
  setDeck,
  leaderCard,
  isOpen,
  onClose,
  onRemoveCard,
  onAddCard,
  onPreview,
  allCards = [],
  blankCards = [],
  onEditBlankCard,
  onImportBlankCards,
}: DeckSidebarProps) {
  const [deckCardInfos, setDeckCardInfos] = useState<DeckCardInfo[]>([]);
  const [exportText, setExportText] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState('');
  const [showBlankExport, setShowBlankExport] = useState(false);
  const [blankExportText, setBlankExportText] = useState('');
  const [showBlankImport, setShowBlankImport] = useState(false);
  const [blankImportText, setBlankImportText] = useState('');
  
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
      setExportText(data.text || '');
      setShowExport(true);
    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポートに失敗しました');
    }
  };
  
  // ブランクカードを圧縮形式でエンコード（QRコード用）
  // 形式: B|連番|名前|タイプ|色|コスト|パワー|カウンター|枚数
  const encodeBlankCardsForQR = (cards: Card[], counts: Record<string, number>): string => {
    // 極力短縮: B|連番|名前(最大8文字)|T|色|C|P|CT|枚数
    return cards.map((c, idx) => {
      const typeCode = c.type === 'CHARACTER' ? 'C' : c.type === 'EVENT' ? 'E' : 'S';
      // 色は頭文字のみ（赤→R, 青→B, 緑→G, 紫→P, 黒→K, 黄→Y）
      const colorMap: Record<string, string> = { '赤': 'R', '青': 'B', '緑': 'G', '紫': 'P', '黒': 'K', '黄': 'Y' };
      const colors = c.color.map(col => colorMap[col] || col[0]).join('');
      const count = counts[c.card_id] || 1;
      const name = c.name.slice(0, 8); // 名前は最大8文字
      const power = Math.floor(c.power / 1000); // パワーは1000単位
      const counter = Math.floor(c.counter / 1000); // カウンターも1000単位
      return `B|${idx}|${name}|${typeCode}|${colors}|${c.cost}|${power}|${counter}|${count}`;
    }).join('\n');
  };
  
  // 圧縮形式からブランクカードをデコード
  const decodeBlankCardsFromQR = (encoded: string): { cards: Card[]; counts: Record<string, number> } => {
    const cards: Card[] = [];
    const counts: Record<string, number> = {};
    
    // 色の逆変換マップ
    const colorRevMap: Record<string, string> = { 'R': '赤', 'B': '青', 'G': '緑', 'P': '紫', 'K': '黒', 'Y': '黄' };
    
    const lines = encoded.split('\n').filter(l => l.startsWith('B|'));
    lines.forEach((line, lineIdx) => {
      const parts = line.split('|');
      if (parts.length >= 9) {
        const [, idx, name, typeCode, colors, cost, power, counter, count] = parts;
        const type = typeCode === 'C' ? 'CHARACTER' : typeCode === 'E' ? 'EVENT' : 'STAGE';
        const cardId = `BLANK-${String(lineIdx + 1).padStart(4, '0')}`;
        
        // 色を復元
        const colorArray = colors.split('').map(c => colorRevMap[c] || c).filter(Boolean);
        
        cards.push({
          name: name || '不明カード',
          card_id: cardId,
          card_code: '',
          type,
          rarity: '?',
          cost: parseInt(cost) || 0,
          attribute: '',
          power: (parseInt(power) || 0) * 1000,
          counter: (parseInt(counter) || 0) * 1000,
          color: colorArray,
          block_icon: '',
          features: [],
          text: '',
          trigger: '',
          source: 'ブランクカード（QRインポート）',
          image_url: '',
          is_parallel: false,
          series_id: 'BLANK',
        });
        counts[cardId] = parseInt(count) || 1;
      }
    });
    
    return { cards, counts };
  };
  
  // ブランクカード込みエクスポート（QR対応形式）
  const handleExportWithBlankCards = async () => {
    try {
      // 通常カードのエクスポート
      const normalDeck = {
        ...deck,
        cards: Object.fromEntries(
          Object.entries(deck.cards).filter(([id]) => !id.startsWith('BLANK-'))
        ),
      };
      
      const res = await fetch('/api/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          deck: normalDeck,
        }),
      });
      const data = await res.json();
      const normalText = data.text || '';
      
      // ブランクカード部分（QR対応圧縮形式）
      const blankCardsInDeck = blankCards.filter(c => deck.cards[c.card_id]);
      const blankCounts: Record<string, number> = {};
      blankCardsInDeck.forEach(c => { blankCounts[c.card_id] = deck.cards[c.card_id]; });
      
      const blankEncoded = encodeBlankCardsForQR(blankCardsInDeck, blankCounts);
      
      // 拡張形式：通常テキスト + ブランクカード（QR形式）
      const extendedText = blankEncoded
        ? `${normalText}\n${blankEncoded}`
        : normalText;
      
      setExportText(extendedText);
      setShowExport(true);
    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポートに失敗しました');
    }
  };
  
  // 拡張形式のインポート処理（QR形式対応）
  const parseExtendedDeckText = (text: string): { normalText: string; blankCards: Card[]; blankCounts: Record<string, number> } => {
    // QR形式（B|で始まる行）をチェック
    const lines = text.split('\n');
    const blankLines = lines.filter(l => l.startsWith('B|'));
    const normalLines = lines.filter(l => !l.startsWith('B|'));
    
    if (blankLines.length > 0) {
      const { cards, counts } = decodeBlankCardsFromQR(blankLines.join('\n'));
      return { normalText: normalLines.join('\n').trim(), blankCards: cards, blankCounts: counts };
    }
    
    // 旧形式（---BLANK_CARDS---）も対応
    const separator = '---BLANK_CARDS---';
    if (text.includes(separator)) {
      const [normalText, blankJson] = text.split(separator);
      try {
        const blankData = JSON.parse(blankJson.trim());
        const cards: Card[] = [];
        const counts: Record<string, number> = {};
        
        blankData.forEach((c: any) => {
          cards.push({
            name: c.name || '不明カード',
            card_id: c.card_id || `BLANK-${Date.now()}`,
            card_code: '',
            type: c.type || 'CHARACTER',
            rarity: '?',
            cost: c.cost ?? 0,
            attribute: c.attribute || '',
            power: c.power ?? 0,
            counter: c.counter ?? 0,
            color: c.color || [],
            block_icon: '',
            features: c.features || [],
            text: c.text || '',
            trigger: c.trigger || '',
            source: 'ブランクカード（インポート）',
            image_url: '',
            is_parallel: false,
            series_id: 'BLANK',
          });
          counts[c.card_id] = c.count || 1;
        });
        
        return { normalText: normalText.trim(), blankCards: cards, blankCounts: counts };
      } catch {
        return { normalText: text, blankCards: [], blankCounts: {} };
      }
    }
    return { normalText: text, blankCards: [], blankCounts: {} };
  };
  
  // デッキ画像生成（クライアントサイド）
  const handleGenerateImage = async () => {
    if (!leaderCard) return;
    
    setGenerating(true);
    setGenerateProgress('準備中...');
    
    try {
      // エクスポートテキストを取得（ブランクカードは除外してQR生成）
      const normalCardIds = Object.keys(deck.cards).filter(id => !id.startsWith('BLANK-'));
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
      const qrText = exportData.text || '';
      
      // QRコードをData URLとして生成
      const qrDataUrl = qrText ? await QRCode.toDataURL(qrText, {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }) : '';
      
      // カード情報リストを作成（ブランクカード対応）
      const cards: DeckImageCard[] = [];
      deckCardInfos.forEach(info => {
        for (let i = 0; i < info.count; i++) {
          if (info.card && !info.image_url) {
            // ブランクカード
            cards.push({
              url: '',
              card: info.card,
            });
          } else {
            // 通常カード
            cards.push({
              url: info.image_url || `https://www.onepiece-cardgame.com/images/cardlist/card/${info.card_id}.png`,
            });
          }
        }
      });
      
      // クライアントサイドで画像生成
      const blob = await generateDeckImage({
        leaderUrl: leaderCard.image_url,
        cardUrls: [], // 後方互換性のため空配列
        cards: cards.slice(0, 50),
        deckName: deck.name,
        qrDataUrl,
        leaderColors: leaderCard.color,
        onProgress: (progress, message) => {
          setGenerateProgress(message);
        },
      });
      
      // ダウンロード
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deck.name || 'deck'}_image.png`;
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
          
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex-1 btn btn-secondary btn-sm"
            >
              📤 エクスポート
            </button>
            {blankCards.some(c => deck.cards[c.card_id]) && (
              <button
                onClick={handleExportWithBlankCards}
                className="flex-1 btn bg-purple-600 text-white hover:bg-purple-700 btn-sm text-xs"
                title="ブランクカード込みでエクスポート"
              >
                📤 全込み
              </button>
            )}
          </div>
          
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
              📝 ブランクカード ({blankCards.length}枚)
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
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  setBlankExportText(serializeBlankCards(blankCards));
                  setShowBlankExport(true);
                }}
                className="flex-1 btn btn-sm bg-purple-600 text-white hover:bg-purple-700"
              >
                エクスポート
              </button>
            </div>
          </div>
        )}
        
        {/* ブランクカードインポートボタン */}
        <div className="mt-2">
          <button
            onClick={() => setShowBlankImport(true)}
            className="w-full btn btn-sm btn-secondary text-xs"
          >
            📥 ブランクカードをインポート
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
        
        {/* ブランクカードエクスポート */}
        {showBlankExport && (
          <div className="mt-4 p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm text-purple-800">ブランクカードエクスポート</h4>
              <button
                onClick={() => setShowBlankExport(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <textarea
              readOnly
              value={blankExportText}
              className="w-full border rounded px-2 py-1 text-xs h-24 font-mono"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(blankExportText);
                  alert('コピーしました');
                }}
                className="flex-1 btn btn-sm bg-purple-600 text-white hover:bg-purple-700"
              >
                コピー
              </button>
            </div>
            <p className="text-xs text-purple-600 mt-2">
              ※ このテキストを保存しておくと、後でインポートできます
            </p>
          </div>
        )}
        
        {/* ブランクカードインポート */}
        {showBlankImport && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm text-blue-800">ブランクカードインポート</h4>
              <button
                onClick={() => {
                  setShowBlankImport(false);
                  setBlankImportText('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <textarea
              value={blankImportText}
              onChange={(e) => setBlankImportText(e.target.value)}
              placeholder="ブランクカードのJSONを貼り付け..."
              className="w-full border rounded px-2 py-1 text-xs h-24 font-mono"
            />
            <button
              onClick={() => {
                const cards = deserializeBlankCards(blankImportText);
                if (cards.length > 0 && onImportBlankCards) {
                  // 枚数を1としてインポート
                  const counts: Record<string, number> = {};
                  cards.forEach(c => { counts[c.card_id] = 1; });
                  onImportBlankCards(cards, counts);
                  alert(`${cards.length}枚のブランクカードをインポートしました`);
                  setShowBlankImport(false);
                  setBlankImportText('');
                } else if (cards.length === 0) {
                  alert('インポートに失敗しました。JSONの形式を確認してください。');
                }
              }}
              className="w-full mt-2 btn btn-sm bg-blue-600 text-white hover:bg-blue-700"
            >
              インポート
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
