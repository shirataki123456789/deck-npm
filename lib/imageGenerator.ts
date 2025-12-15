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
 * ブランクカードのプレースホルダーを描画（実際のカードレイアウトに準拠）
 * レイアウト:
 * - 左上: コスト（黄色丸）
 * - 右上: パワー + 属性
 * - 左側: カウンター（縦）
 * - 中央: 効果テキスト
 * - 下部: トリガー → タイプ → カード名 → 特徴 → ID
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
  
  // 半透明オーバーレイ（上部は薄く、中央は濃く）
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(x, y, width, height * 0.35);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(x, y + height * 0.35, width, height * 0.35);
  
  // 下部バー（黄色系・タイプ表示エリア）
  ctx.fillStyle = '#F7E731';
  ctx.fillRect(x, y + height * 0.78, width, height * 0.22);
  
  // 枠線
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  
  // === 左上: コスト（黄色丸） ===
  const costRadius = 14;
  const costX = x + 18;
  const costY = y + 20;
  
  ctx.beginPath();
  ctx.arc(costX, costY, costRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#F7E731';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.fillStyle = '#000';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(card.cost >= 0 ? card.cost : '-'), costX, costY);
  
  // === 右上: パワー + 属性 ===
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  
  // パワー
  ctx.fillStyle = 'white';
  ctx.font = 'bold 14px sans-serif';
  const powerText = card.power > 0 ? String(card.power) : '-';
  ctx.fillText(powerText, x + width - 8, y + 8);
  
  // 属性（パワーの下）
  if (card.attribute) {
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = 'white';
    ctx.fillText(card.attribute, x + width - 8, y + 24);
  }
  
  // === 左側: カウンター（縦書き風） ===
  if (card.counter > 0) {
    ctx.save();
    ctx.translate(x + 12, y + height * 0.45);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${card.counter}`, 0, 0);
    ctx.restore();
  }
  
  // === 中央: 効果テキスト ===
  if (card.text) {
    ctx.fillStyle = 'white';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const textX = x + 8;
    const textY = y + height * 0.40;
    const maxWidth = width - 16;
    const lineHeight = 10;
    const maxLines = 4;
    
    // テキストを折り返し
    const words = card.text.split('');
    let line = '';
    let lines: string[] = [];
    
    for (const char of words) {
      const testLine = line + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        lines.push(line);
        line = char;
        if (lines.length >= maxLines) break;
      } else {
        line = testLine;
      }
    }
    if (line && lines.length < maxLines) {
      lines.push(line);
    }
    if (lines.length === maxLines && line.length > 0) {
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, -3) + '...';
    }
    
    lines.forEach((l, i) => {
      ctx.fillText(l, textX, textY + i * lineHeight);
    });
  }
  
  // === トリガー（効果テキストの下） ===
  if (card.trigger) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'left';
    const triggerText = `トリガー ${card.trigger.slice(0, 15)}`;
    ctx.fillText(triggerText, x + 6, y + height * 0.72);
  }
  
  // === 下部黄色バー内 ===
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // タイプ
  ctx.font = '8px sans-serif';
  const typeText = card.type === 'CHARACTER' ? 'CHARACTER' : card.type === 'EVENT' ? 'EVENT' : 'STAGE';
  ctx.fillText(typeText, x + width / 2, y + height * 0.81);
  
  // カード名
  ctx.font = 'bold 11px sans-serif';
  const name = card.name.length > 12 ? card.name.slice(0, 12) + '...' : card.name;
  ctx.fillText(name, x + width / 2, y + height * 0.875);
  
  // 特徴
  if (card.features.length > 0) {
    ctx.font = '7px sans-serif';
    const featuresText = card.features.slice(0, 2).join('/');
    const displayFeatures = featuresText.length > 18 ? featuresText.slice(0, 18) + '...' : featuresText;
    ctx.fillText(displayFeatures, x + width / 2, y + height * 0.93);
  }
  
  // カードID（左下）
  ctx.font = '6px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(card.card_id, x + 4, y + height * 0.97);
  
  // 「仮」マーク（右下）
  ctx.fillStyle = 'rgba(128, 0, 255, 0.9)';
  const badgeW = 18;
  const badgeH = 12;
  ctx.fillRect(x + width - badgeW - 3, y + height * 0.78 - badgeH - 2, badgeW, badgeH);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('仮', x + width - badgeW / 2 - 3, y + height * 0.78 - badgeH / 2 - 2);
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
