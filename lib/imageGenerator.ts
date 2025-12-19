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
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

/**
 * ブランクカードのプレースホルダーを描画
 * 座標比率は実際のカード画像から測定:
 * - コスト(red): x=0.02, y=0.014, w=0.147, h=0.103
 * - パワー(yellow): x=0.663~0.865, y=0.025~0.075
 * - 属性(green): x=0.873~0.962, y=0.019~0.075
 * - 効果テキスト(cyan): x=0.05~0.95, y=0.576~0.752
 * - タイプ(magenta): y=0.833~0.854
 * - カード名(blue): y=0.878~0.926
 * - 特徴(orange): y=0.927~0.957
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
  
  // === 背景 ===
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  
  // イラストエリア風オーバーレイ
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(x, y + height * 0.12, width, height * 0.42);
  
  // === 効果テキストエリア背景 (cyan: y=0.576~0.752) ===
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  const effectX = x + width * 0.05;
  const effectY = y + height * 0.576;
  const effectW = width * 0.90;
  const effectH = height * 0.176;
  ctx.fillRect(effectX, effectY, effectW, effectH);
  
  // === 下部バー (y=0.83~1.0) ===
  const bottomBarY = y + height * 0.83;
  const bottomBarH = height * 0.17;
  ctx.fillStyle = primaryColor;
  ctx.fillRect(x, bottomBarY, width, bottomBarH);
  ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(x, bottomBarY, width, bottomBarH);
  
  // === 枠線 ===
  ctx.strokeStyle = strokeOnColor;
  ctx.lineWidth = Math.max(1, width * 0.015);
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  
  // === 左上: コスト (red: x=0.02, y=0.014, w=0.147, h=0.103) ===
  const costX = x + width * 0.02;
  const costY = y + height * 0.014;
  const costW = width * 0.147;
  const costH = height * 0.103;
  const costCenterX = costX + costW / 2;
  const costCenterY = costY + costH / 2;
  const costRadius = Math.min(costW, costH) / 2;
  
  ctx.beginPath();
  ctx.arc(costCenterX, costCenterY, costRadius, 0, Math.PI * 2);
  ctx.fillStyle = primaryColor;
  ctx.fill();
  ctx.strokeStyle = strokeOnColor;
  ctx.lineWidth = Math.max(1, width * 0.012);
  ctx.stroke();
  
  ctx.fillStyle = textOnColor;
  ctx.font = `bold ${Math.round(costRadius * 1.1)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(card.cost >= 0 ? card.cost : '-'), costCenterX, costCenterY);
  
  // === 右上: パワー (yellow: x=0.663~0.865, y=0.025~0.075) ===
  ctx.fillStyle = textOnColor;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  const powerFontSize = Math.round(height * 0.042);
  ctx.font = `bold ${powerFontSize}px sans-serif`;
  const powerX = x + width * 0.86;
  const powerY = y + height * 0.028;
  const powerText = card.power > 0 ? String(card.power) : '-';
  ctx.fillText(powerText, powerX, powerY);
  
  // === 右上: 属性 (green: x=0.873~0.962, y=0.019~0.075) ===
  if (card.attribute) {
    const attrFontSize = Math.round(height * 0.032);
    ctx.font = `bold ${attrFontSize}px sans-serif`;
    ctx.fillStyle = textOnColor;
    ctx.fillText(card.attribute, x + width * 0.96, y + height * 0.022);
  }
  
  // === 左側: カウンター縦書き (black: x=0.02~0.05, y=0.26~0.50) ===
  if (card.counter > 0) {
    ctx.save();
    // 縦書き位置（左側、コストの下〜効果エリアの上）
    const counterX = x + width * 0.035;
    const counterY = y + height * 0.38; // y=0.26〜0.50の中央付近
    
    ctx.translate(counterX, counterY);
    ctx.rotate(-Math.PI / 2); // 90度回転（縦書き）
    
    ctx.fillStyle = textOnColor;
    ctx.font = `bold ${Math.round(height * 0.035)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${card.counter}`, 0, 0);
    ctx.restore();
  }
  
  // === 効果テキスト (cyan領域内) ===
  if (card.text) {
    ctx.fillStyle = 'white';
    const textFontSize = Math.round(height * 0.026);
    ctx.font = `${textFontSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const textX = effectX + width * 0.015;
    const textY = effectY + height * 0.008;
    const maxWidth = effectW - width * 0.03;
    const lineHeight = textFontSize * 1.25;
    const maxLines = Math.floor((effectH - height * 0.016) / lineHeight);
    
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
    
    if (allLines.length === maxLines && card.text.length > allLines.join('').length) {
      const lastLine = allLines[maxLines - 1];
      if (lastLine.length > 1) {
        allLines[maxLines - 1] = lastLine.slice(0, -1) + '…';
      }
    }
    
    allLines.forEach((l, i) => {
      ctx.fillText(l, textX, textY + i * lineHeight);
    });
  }
  
  // === トリガー (効果テキストエリアの下、下部バーの上) ===
  if (card.trigger) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    const triggerFontSize = Math.round(height * 0.022);
    ctx.font = `${triggerFontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const triggerY = y + height * 0.79;
    const triggerText = `【トリガー】${card.trigger.slice(0, 14)}`;
    ctx.fillText(triggerText, x + width / 2, triggerY);
  }
  
  // === 下部バー内 ===
  ctx.fillStyle = textOnColor;
  ctx.textAlign = 'center';
  
  // タイプ (magenta: y=0.833~0.854)
  const typeFontSize = Math.round(height * 0.020);
  ctx.font = `${typeFontSize}px sans-serif`;
  ctx.textBaseline = 'middle';
  const typeY = y + height * 0.844;
  const typeText = card.type === 'CHARACTER' ? 'CHARACTER' : card.type === 'EVENT' ? 'EVENT' : 'STAGE';
  ctx.fillText(typeText, x + width / 2, typeY);
  
  // カード名 (blue: y=0.878~0.926)
  const nameFontSize = Math.round(height * 0.036);
  ctx.font = `bold ${nameFontSize}px sans-serif`;
  const nameY = y + height * 0.902;
  const maxNameWidth = width * 0.9;
  let name = card.name;
  while (ctx.measureText(name).width > maxNameWidth && name.length > 1) {
    name = name.slice(0, -1);
  }
  if (name !== card.name) name += '…';
  ctx.fillText(name, x + width / 2, nameY);
  
  // 特徴 (orange: y=0.927~0.957)
  if (card.features.length > 0) {
    const featureFontSize = Math.round(height * 0.020);
    ctx.font = `${featureFontSize}px sans-serif`;
    const featureY = y + height * 0.942;
    const featuresText = card.features.join(' / ');
    const maxFeaturesWidth = width * 0.88;
    
    if (ctx.measureText(featuresText).width <= maxFeaturesWidth) {
      ctx.fillText(featuresText, x + width / 2, featureY);
    } else {
      // 2行に分割
      const midPoint = Math.ceil(card.features.length / 2);
      const line1 = card.features.slice(0, midPoint).join(' / ');
      const line2 = card.features.slice(midPoint).join(' / ');
      ctx.fillText(line1, x + width / 2, featureY - featureFontSize * 0.55);
      ctx.fillText(line2, x + width / 2, featureY + featureFontSize * 0.55);
    }
  }
  
  // カードID（左下）
  const idFontSize = Math.round(height * 0.016);
  ctx.font = `${idFontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(card.card_id, x + width * 0.02, y + height * 0.99);
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
