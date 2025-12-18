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
 * 色の明度を計算して、明るい色かどうかを判定
 */
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // 相対輝度を計算（人間の目の感度を考慮）
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

/**
 * ブランクカードのプレースホルダーを描画（実際のカードレイアウトに準拠）
 * レイアウト:
 * - 左上: コスト（カード色背景）
 * - 右上: パワー + 属性
 * - 左側: カウンター（縦・効果エリアの左外）
 * - 中央: 効果テキスト（改行対応）
 * - 下部: トリガー → タイプ → カード名 → 特徴 → ID（カード色背景）
 * 
 * ※ 全てのサイズはwidthに比例してスケール
 */
function drawBlankCardPlaceholder(
  ctx: CanvasRenderingContext2D,
  card: Card,
  x: number,
  y: number,
  width: number,
  height: number
) {
  // 基準サイズ（デッキ画像生成時の標準幅）に対するスケール比率
  const baseWidth = 100;
  const scale = width / baseWidth;
  
  // スケール対応のフォントサイズ
  const fontSize = (size: number) => `${Math.round(size * scale)}px`;
  const fontSizeBold = (size: number) => `bold ${Math.round(size * scale)}px sans-serif`;
  const fontSizeNormal = (size: number) => `${Math.round(size * scale)}px sans-serif`;
  
  // 背景グラデーション（カードの色に基づく）
  const cardColors = card.color.map(c => COLOR_HEX[c] || '#888888');
  if (cardColors.length === 0) cardColors.push('#888888');
  
  const primaryColor = cardColors[0];
  
  // 明るい色（黄色など）かどうかを判定
  const isLight = isLightColor(primaryColor);
  const textOnColor = isLight ? '#000000' : '#FFFFFF';
  const strokeOnColor = isLight ? '#333333' : '#FFFFFF';
  
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
  
  // 半透明オーバーレイ（イラストエリア風）
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(x, y + height * 0.08, width, height * 0.32);
  
  // 効果テキストエリア背景（少し暗く）
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(x + width * 0.18, y + height * 0.42, width * 0.78, height * 0.30);
  
  // 下部バー（カード色）
  ctx.fillStyle = primaryColor;
  ctx.fillRect(x, y + height * 0.75, width, height * 0.25);
  
  // 下部バーに半透明オーバーレイ
  ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(x, y + height * 0.75, width, height * 0.25);
  
  // 枠線
  ctx.strokeStyle = strokeOnColor;
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  
  // === 左上: コスト（カード色背景） ===
  const costRadius = 12 * scale;
  const costX = x + 14 * scale;
  const costY = y + 16 * scale;
  
  ctx.beginPath();
  ctx.arc(costX, costY, costRadius, 0, Math.PI * 2);
  ctx.fillStyle = primaryColor;
  ctx.fill();
  ctx.strokeStyle = strokeOnColor;
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.stroke();
  
  ctx.fillStyle = textOnColor;
  ctx.font = fontSizeBold(16);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(card.cost >= 0 ? card.cost : '-'), costX, costY);
  
  // === 右上: パワー + 属性 ===
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  
  // パワー
  ctx.fillStyle = textOnColor;
  ctx.font = fontSizeBold(14);
  const powerText = card.power > 0 ? String(card.power) : '-';
  ctx.fillText(powerText, x + width - 5 * scale, y + 5 * scale);
  
  // 属性（パワーの下）
  if (card.attribute) {
    ctx.font = fontSizeBold(12);
    ctx.fillStyle = textOnColor;
    ctx.fillText(card.attribute, x + width - 5 * scale, y + 21 * scale);
  }
  
  // === 左側: カウンター（効果エリアの左外に縦書き） ===
  if (card.counter > 0) {
    ctx.save();
    ctx.translate(x + 10 * scale, y + height * 0.57);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = textOnColor;
    ctx.font = fontSizeBold(10);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${card.counter}`, 0, 0);
    ctx.restore();
  }
  
  // === 中央: 効果テキスト（改行対応） ===
  if (card.text) {
    ctx.fillStyle = 'white';
    ctx.font = fontSizeNormal(8);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const textX = x + 20 * scale;
    const textY = y + height * 0.44;
    const maxWidth = width - 26 * scale;
    const lineHeight = 10 * scale;
    const maxLines = 4;
    
    // 改行で分割し、各行を幅に合わせて折り返し
    const paragraphs = card.text.split('\n');
    const allLines: string[] = [];
    
    for (const paragraph of paragraphs) {
      if (allLines.length >= maxLines) break;
      
      let line = '';
      for (const char of paragraph) {
        const testLine = line + char;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== '') {
          allLines.push(line);
          line = char;
          if (allLines.length >= maxLines) break;
        } else {
          line = testLine;
        }
      }
      if (line && allLines.length < maxLines) {
        allLines.push(line);
      }
    }
    
    // 最終行が途中で切れた場合
    if (allLines.length === maxLines) {
      const lastLine = allLines[maxLines - 1];
      if (lastLine.length > 0) {
        allLines[maxLines - 1] = lastLine.slice(0, -2) + '…';
      }
    }
    
    allLines.forEach((l, i) => {
      ctx.fillText(l, textX, textY + i * lineHeight);
    });
  }
  
  // === トリガー（効果テキストの下） ===
  if (card.trigger) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = fontSizeNormal(7);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const triggerText = `【トリガー】${card.trigger.slice(0, 18)}`;
    ctx.fillText(triggerText, x + 20 * scale, y + height * 0.70);
  }
  
  // === 下部バー内（カード色に応じた文字色） ===
  ctx.fillStyle = textOnColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // タイプ
  ctx.font = fontSizeNormal(7);
  const typeText = card.type === 'CHARACTER' ? 'CHARACTER' : card.type === 'EVENT' ? 'EVENT' : 'STAGE';
  ctx.fillText(typeText, x + width / 2, y + height * 0.79);
  
  // カード名
  ctx.font = fontSizeBold(10);
  const name = card.name.length > 14 ? card.name.slice(0, 14) + '…' : card.name;
  ctx.fillText(name, x + width / 2, y + height * 0.86);
  
  // 特徴（全て表示、複数行対応）
  if (card.features.length > 0) {
    ctx.font = fontSizeNormal(6);
    const featuresText = card.features.join(' / ');
    
    // 幅に収まるか確認
    const maxFeaturesWidth = width - 10 * scale;
    const metrics = ctx.measureText(featuresText);
    
    if (metrics.width <= maxFeaturesWidth) {
      ctx.fillText(featuresText, x + width / 2, y + height * 0.92);
    } else {
      // 2行に分割
      const midPoint = Math.ceil(card.features.length / 2);
      const line1 = card.features.slice(0, midPoint).join(' / ');
      const line2 = card.features.slice(midPoint).join(' / ');
      ctx.fillText(line1, x + width / 2, y + height * 0.90);
      ctx.fillText(line2, x + width / 2, y + height * 0.95);
    }
  }
  
  // カードID（左下）
  ctx.font = fontSizeNormal(5);
  ctx.textAlign = 'left';
  ctx.fillText(card.card_id, x + 3 * scale, y + height * 0.98);
}

// ブランクカード描画関数をエクスポート（CardGrid等で使用）
export { drawBlankCardPlaceholder, isLightColor };

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
