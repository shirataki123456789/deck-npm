import { COLOR_HEX, Card } from './types';

// 定数
const FINAL_WIDTH = 2150;
const FINAL_HEIGHT = 2048;
const GRID_HEIGHT = 1500;
const UPPER_HEIGHT = FINAL_HEIGHT - GRID_HEIGHT;
const CARD_WIDTH = 215;
const CARD_HEIGHT = 300;
const CARDS_PER_ROW = 10;
const CARDS_PER_COL = 5;
const QR_SIZE = 400;
const GAP = 48;

/**
 * 画像をロード
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * プロキシURLを使って画像をロード（CORS対策）
 */
async function loadImageWithProxy(url: string): Promise<HTMLImageElement | null> {
  try {
    // 直接ロードを試みる
    return await loadImage(url);
  } catch {
    // CORSエラーの場合はプロキシを使用
    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      return await loadImage(proxyUrl);
    } catch {
      console.error('Failed to load image:', url);
      return null;
    }
  }
}

/**
 * グラデーション背景を描画
 */
function drawGradientBackground(
  ctx: CanvasRenderingContext2D,
  colors: string[]
) {
  if (colors.length === 0) {
    colors = ['#cccccc'];
  }
  
  const gradient = ctx.createLinearGradient(0, 0, FINAL_WIDTH, 0);
  
  if (colors.length === 1) {
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[0]);
  } else {
    colors.forEach((color, i) => {
      gradient.addColorStop(i / (colors.length - 1), color);
    });
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FINAL_WIDTH, FINAL_HEIGHT);
}

/**
 * デッキ名を描画
 */
function drawDeckName(
  ctx: CanvasRenderingContext2D,
  deckName: string,
  leaderCroppedWidth: number
) {
  const deckNameAreaStart = GAP + leaderCroppedWidth + GAP;
  const deckNameAreaWidth = FINAL_WIDTH - deckNameAreaStart - GAP - QR_SIZE - GAP;
  const textY = Math.floor(UPPER_HEIGHT / 2);
  
  // 半透明の背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  const rectHeight = 120;
  const rectY = textY - rectHeight / 2;
  ctx.beginPath();
  ctx.roundRect(deckNameAreaStart, rectY, deckNameAreaWidth, rectHeight, 10);
  ctx.fill();
  
  // テキスト
  ctx.fillStyle = 'white';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(deckName, deckNameAreaStart + deckNameAreaWidth / 2, textY, deckNameAreaWidth - 40);
}

/**
 * ブランクカードのプレースホルダーを描画
 */
function drawBlankCardPlaceholder(
  ctx: CanvasRenderingContext2D,
  card: Card,
  x: number,
  y: number,
  width: number,
  height: number
) {
  // 背景グラデーション（カードの色に基づく）
  const cardColors = card.color.map(c => COLOR_HEX[c] || '#888888');
  if (cardColors.length === 0) cardColors.push('#888888');
  
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  if (cardColors.length === 1) {
    gradient.addColorStop(0, cardColors[0]);
    gradient.addColorStop(1, cardColors[0]);
  } else {
    cardColors.forEach((color, i) => {
      gradient.addColorStop(i / (cardColors.length - 1), color);
    });
  }
  
  // 背景
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  
  // 枠線
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
  
  // 半透明オーバーレイ
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(x, y, width, height);
  
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  
  // カード名（上部）
  ctx.font = 'bold 14px sans-serif';
  const name = card.name.length > 10 ? card.name.slice(0, 10) + '...' : card.name;
  ctx.fillText(name, x + width / 2, y + 25, width - 10);
  
  // コスト（大きく中央）
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(String(card.cost >= 0 ? card.cost : '-'), x + width / 2, y + height / 2 - 20);
  
  // パワー
  if (card.power > 0) {
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${card.power}`, x + width / 2, y + height / 2 + 20);
  }
  
  // カウンター（下部）
  ctx.font = '12px sans-serif';
  const counterText = card.counter > 0 ? `+${card.counter}` : 'カウンターなし';
  ctx.fillText(counterText, x + width / 2, y + height - 40);
  
  // カードID（最下部）
  ctx.font = '10px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(card.card_id, x + width / 2, y + height - 15);
  
  // 「仮」マーク
  ctx.fillStyle = 'rgba(128, 0, 255, 0.8)';
  ctx.fillRect(x + 5, y + 5, 30, 18);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('仮', x + 20, y + 17);
}

export interface DeckImageCard {
  url: string;
  card?: Card; // ブランクカード用の情報
}

export interface DeckImageOptions {
  leaderUrl: string;
  cardUrls: string[];  // 後方互換性のため残す
  cards?: DeckImageCard[];  // 新しい形式（カード情報付き）
  deckName: string;
  qrDataUrl: string;
  leaderColors: string[];
  onProgress?: (progress: number, message: string) => void;
}

/**
 * デッキ画像を生成（クライアントサイド）
 */
export async function generateDeckImage(options: DeckImageOptions): Promise<Blob> {
  const {
    leaderUrl,
    cardUrls,
    cards,
    deckName,
    qrDataUrl,
    leaderColors,
    onProgress,
  } = options;
  
  // Canvas作成
  const canvas = document.createElement('canvas');
  canvas.width = FINAL_WIDTH;
  canvas.height = FINAL_HEIGHT;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas context not available');
  }
  
  onProgress?.(0, '背景を描画中...');
  
  // 背景色を決定
  const bgColors = leaderColors.length > 0
    ? leaderColors.map(c => COLOR_HEX[c] || c)
    : ['#cccccc'];
  
  // グラデーション背景を描画
  drawGradientBackground(ctx, bgColors);
  
  onProgress?.(10, 'リーダー画像を読み込み中...');
  
  // リーダー画像の配置
  const leaderCroppedHeight = UPPER_HEIGHT;
  const leaderCroppedWidth = Math.floor(leaderCroppedHeight * (400 / 280));
  
  if (leaderUrl) {
    const leaderImg = await loadImageWithProxy(leaderUrl);
    if (leaderImg) {
      // 上半分をクロップして描画
      const srcHeight = leaderImg.height / 2;
      ctx.drawImage(
        leaderImg,
        0, 0, leaderImg.width, srcHeight, // ソースの上半分
        GAP, 0, leaderCroppedWidth, leaderCroppedHeight // 描画先
      );
    }
  }
  
  onProgress?.(20, 'QRコードを配置中...');
  
  // QRコードの配置
  const qrX = FINAL_WIDTH - GAP - QR_SIZE;
  const qrY = Math.floor((UPPER_HEIGHT - QR_SIZE) / 2);
  
  if (qrDataUrl) {
    try {
      const qrImg = await loadImage(qrDataUrl);
      ctx.drawImage(qrImg, qrX, qrY, QR_SIZE, QR_SIZE);
    } catch (e) {
      console.error('QR code draw error:', e);
    }
  }
  
  // デッキ名の配置
  if (deckName) {
    drawDeckName(ctx, deckName, leaderCroppedWidth);
  }
  
  onProgress?.(30, 'カード画像を読み込み中...');
  
  // カードグリッドの配置
  const gridStartY = UPPER_HEIGHT;
  const gridStartX = Math.floor((FINAL_WIDTH - (CARD_WIDTH * CARDS_PER_ROW)) / 2);
  
  // 新しい形式（cards）があればそれを使う、なければ従来のcardUrls
  const cardsToRender: DeckImageCard[] = cards 
    ? cards.slice(0, CARDS_PER_ROW * CARDS_PER_COL)
    : cardUrls.slice(0, CARDS_PER_ROW * CARDS_PER_COL).map(url => ({ url }));
  
  const totalCards = cardsToRender.length;
  
  for (let idx = 0; idx < cardsToRender.length; idx++) {
    const cardData = cardsToRender[idx];
    onProgress?.(30 + Math.floor((idx / totalCards) * 60), `カード ${idx + 1}/${totalCards} を読み込み中...`);
    
    const row = Math.floor(idx / CARDS_PER_ROW);
    const col = idx % CARDS_PER_ROW;
    const x = gridStartX + col * CARD_WIDTH;
    const y = gridStartY + row * CARD_HEIGHT;
    
    // ブランクカード（URLが空でカード情報がある場合）
    if (!cardData.url && cardData.card) {
      drawBlankCardPlaceholder(ctx, cardData.card, x, y, CARD_WIDTH, CARD_HEIGHT);
      continue;
    }
    
    // 通常のカード画像
    if (cardData.url) {
      const cardImg = await loadImageWithProxy(cardData.url);
      if (cardImg) {
        ctx.drawImage(cardImg, x, y, CARD_WIDTH, CARD_HEIGHT);
      }
    }
  }
  
  onProgress?.(95, '画像を生成中...');
  
  // Blobとして出力
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onProgress?.(100, '完了');
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/png'
    );
  });
}
