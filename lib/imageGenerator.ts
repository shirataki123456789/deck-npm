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
 * テキストを指定幅で折り返す
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  
  for (const paragraph of paragraphs) {
    let line = '';
    for (const char of paragraph) {
      const testLine = line + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        lines.push(line);
        line = char;
      } else {
        line = testLine;
      }
    }
    if (line) {
      lines.push(line);
    }
  }
  
  return lines;
}

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
  const isLeader = card.type === 'LEADER';
  
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
  
  if (isLeader) {
    // === リーダーカード用レイアウト ===
    
    // 金色の枠線
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = Math.max(2, width * 0.02);
    ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
    
    // イラストエリア
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(x, y + height * 0.12, width, height * 0.40);
    
    // 上部バー（LEADER表示用）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y, width, height * 0.10);
    
    // LEADERテキスト（上部中央）
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold ${Math.round(height * 0.05)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LEADER', x + width / 2, y + height * 0.05);
    
    // ライフ（左上、金色の丸）
    const lifeX = x + width * 0.12;
    const lifeY = y + height * 0.18;
    const lifeRadius = Math.min(width, height) * 0.08;
    
    ctx.beginPath();
    ctx.arc(lifeX, lifeY, lifeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = Math.max(1, width * 0.01);
    ctx.stroke();
    
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.round(lifeRadius * 1.2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.block_icon || '5', lifeX, lifeY);
    
    // 「LIFE」ラベル
    ctx.fillStyle = textOnColor;
    ctx.font = `bold ${Math.round(height * 0.022)}px sans-serif`;
    ctx.fillText('LIFE', lifeX, lifeY + lifeRadius + height * 0.02);
    
    // パワー（右上）
    ctx.fillStyle = textOnColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${Math.round(height * 0.045)}px sans-serif`;
    ctx.fillText(String(card.power || 5000), x + width * 0.92, y + height * 0.12);
    
    // 属性（パワーの下）
    if (card.attribute) {
      ctx.font = `bold ${Math.round(height * 0.028)}px sans-serif`;
      ctx.fillText(card.attribute, x + width * 0.92, y + height * 0.17);
    }
    
    // 効果テキストエリア
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const effectX = x + width * 0.02;
    const effectY = y + height * 0.54;
    const effectW = width * 0.96;
    const effectH = height * 0.20;
    ctx.fillRect(effectX, effectY, effectW, effectH);
    
    // 効果テキスト
    if (card.text) {
      ctx.fillStyle = 'white';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const fontSize = Math.round(height * 0.022);
      ctx.font = `${fontSize}px sans-serif`;
      
      const textPadding = width * 0.02;
      const maxWidth = effectW - textPadding * 2;
      const lines = wrapText(ctx, card.text, maxWidth);
      const lineHeight = fontSize * 1.2;
      
      lines.slice(0, 4).forEach((line, i) => {
        ctx.fillText(line, effectX + textPadding, effectY + textPadding + i * lineHeight);
      });
    }
    
    // 下部バー
    ctx.fillStyle = primaryColor;
    ctx.fillRect(x, y + height * 0.76, width, height * 0.24);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(x, y + height * 0.76, width, height * 0.24);
    
    // カード名（下部）
    ctx.fillStyle = textOnColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const nameFontSize = Math.round(height * 0.038);
    ctx.font = `bold ${nameFontSize}px sans-serif`;
    ctx.fillText(card.name.slice(0, 15), x + width / 2, y + height * 0.82);
    
    // 特徴（最下部）
    if (card.features.length > 0) {
      ctx.font = `${Math.round(height * 0.022)}px sans-serif`;
      ctx.fillText(card.features.slice(0, 3).join(' / '), x + width / 2, y + height * 0.90);
    }
    
    // カードID
    ctx.font = `${Math.round(height * 0.018)}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(card.card_id, x + width / 2, y + height * 0.96);
    
  } else {
    // === 通常カード用レイアウト（既存のまま） ===
    
    // イラストエリア風オーバーレイ
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(x, y + height * 0.12, width, height * 0.42);
    
    // 効果テキストエリア背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    const effectX = x + width * 0.02;
    const effectY = y + height * 0.576;
    const effectW = width * 0.96;
    const effectH = height * 0.176;
    ctx.fillRect(effectX, effectY, effectW, effectH);
    
    // 下部バー
    const bottomBarY = y + height * 0.83;
    const bottomBarH = height * 0.17;
    ctx.fillStyle = primaryColor;
    ctx.fillRect(x, bottomBarY, width, bottomBarH);
    ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x, bottomBarY, width, bottomBarH);
    
    // 枠線
    ctx.strokeStyle = strokeOnColor;
    ctx.lineWidth = Math.max(1, width * 0.015);
    ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
    
    // 左上: コスト
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
    
    // 右上: パワー
    ctx.fillStyle = textOnColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const powerFontSize = Math.round(height * 0.042);
    ctx.font = `bold ${powerFontSize}px sans-serif`;
    const powerX = x + width * 0.86;
    const powerY = y + height * 0.028;
    const powerText = card.power > 0 ? String(card.power) : '-';
    ctx.fillText(powerText, powerX, powerY);
    
    // 右上: 属性
    if (card.attribute) {
      const attrFontSize = Math.round(height * 0.032);
      ctx.font = `bold ${attrFontSize}px sans-serif`;
      ctx.fillStyle = textOnColor;
      ctx.fillText(card.attribute, x + width * 0.96, y + height * 0.022);
    }
    
    // 左側: カウンター縦書き
    if (card.counter > 0) {
      ctx.save();
      const counterX = x + width * 0.035;
      const counterY = y + height * 0.38;
      
      ctx.translate(counterX, counterY);
      ctx.rotate(-Math.PI / 2);
      
      ctx.fillStyle = textOnColor;
      ctx.font = `bold ${Math.round(height * 0.035)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`+${card.counter}`, 0, 0);
      ctx.restore();
    }
  
    // === 効果テキスト (拡大されたcyan領域内、動的フォントサイズ) ===
    if (card.text) {
      ctx.fillStyle = 'white';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      
      const textPadding = width * 0.01;
      const textX = effectX + textPadding;
      const maxWidth = effectW - textPadding * 2;
      const availableHeight = effectH - height * 0.01;
      
      // テキストの長さに応じてフォントサイズを動的に調整
      const textLength = card.text.length;
      let baseFontSize: number;
      let lineHeightRatio: number;
      
      if (textLength <= 30) {
        baseFontSize = height * 0.024;
        lineHeightRatio = 1.3;
      } else if (textLength <= 60) {
        baseFontSize = height * 0.021;
        lineHeightRatio = 1.25;
      } else if (textLength <= 100) {
        baseFontSize = height * 0.018;
        lineHeightRatio = 1.2;
      } else if (textLength <= 150) {
        baseFontSize = height * 0.015;
        lineHeightRatio = 1.15;
      } else {
        baseFontSize = height * 0.013;
        lineHeightRatio = 1.1;
      }
      
      const textFontSize = Math.max(1, Math.round(baseFontSize));
      ctx.font = `${textFontSize}px sans-serif`;
      const lineHeight = textFontSize * lineHeightRatio;
      const maxLines = Math.floor(availableHeight / lineHeight);
      const textY = effectY + height * 0.005;
      
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
    
    // タイプ
    const typeFontSize = Math.round(height * 0.020);
    ctx.font = `${typeFontSize}px sans-serif`;
    ctx.textBaseline = 'middle';
    const typeY = y + height * 0.844;
    const typeText = card.type === 'CHARACTER' ? 'CHARACTER' : card.type === 'EVENT' ? 'EVENT' : 'STAGE';
    ctx.fillText(typeText, x + width / 2, typeY);
    
    // カード名
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
    
    // 特徴
    if (card.features.length > 0) {
      const featureFontSize = Math.round(height * 0.020);
      ctx.font = `${featureFontSize}px sans-serif`;
      const featureY = y + height * 0.942;
      const featuresText = card.features.join(' / ');
      const maxFeaturesWidth = width * 0.88;
      
      if (ctx.measureText(featuresText).width <= maxFeaturesWidth) {
        ctx.fillText(featuresText, x + width / 2, featureY);
      } else {
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
  } // end of else (通常カード)
}

/**
 * ブランクカードにQRコードを描画（イラストエリアに配置）
 * QRコードはブランクカード情報をエンコードしたもの
 */
export async function drawBlankCardWithQR(
  ctx: CanvasRenderingContext2D,
  card: Card,
  x: number,
  y: number,
  width: number,
  height: number,
  qrDataUrl: string
): Promise<void> {
  // まず通常のブランクカードを描画
  drawBlankCardPlaceholder(ctx, card, x, y, width, height);
  
  // QRコードをイラストエリアに描画
  // イラストエリア: y=12%〜54% (高さ42%)、中央配置
  const qrAreaY = y + height * 0.14;
  const qrAreaHeight = height * 0.38;
  const qrSize = Math.min(width * 0.7, qrAreaHeight * 0.9);
  const qrX = x + (width - qrSize) / 2;
  const qrY = qrAreaY + (qrAreaHeight - qrSize) / 2;
  
  try {
    const qrImg = new Image();
    await new Promise<void>((resolve, reject) => {
      qrImg.onload = () => resolve();
      qrImg.onerror = () => reject(new Error('QR load failed'));
      qrImg.src = qrDataUrl;
    });
    
    // 白背景を描画（QRの視認性向上）
    ctx.fillStyle = 'white';
    ctx.fillRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4);
    
    // QRコードを描画
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } catch (e) {
    // QR描画失敗時は何もしない（通常のブランクカードのまま）
    console.warn('Failed to draw QR on blank card:', e);
  }
}

// ブランクカード描画関数をエクスポート（CardGrid等で使用）
export { drawBlankCardPlaceholder, isLightColor };

export interface DeckImageCard {
  url: string;
  card?: Card; // ブランクカード用の情報
  qrDataUrl?: string; // ブランクカード用QRコード（data URL）
}

export interface DeckImageOptions {
  leaderUrl: string;
  leaderCard?: Card; // ブランクリーダー用
  leaderQrDataUrl?: string; // ブランクリーダー用QRコード
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
    leaderCard,
    leaderQrDataUrl,
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
  
  // ブランクリーダーかどうか
  const isBlankLeader = leaderCard && !leaderUrl;
  
  if (isBlankLeader && leaderCard) {
    // ブランクリーダーの場合、Canvas描画（全体表示＋QRコード）
    const tempCanvas = document.createElement('canvas');
    const tempWidth = 400;
    const tempHeight = 560;
    tempCanvas.width = tempWidth;
    tempCanvas.height = tempHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      drawBlankCardPlaceholder(tempCtx, leaderCard, 0, 0, tempWidth, tempHeight);
      
      // QRコードを右下に追加
      if (leaderQrDataUrl) {
        try {
          const qrImg = await loadImage(leaderQrDataUrl);
          const qrSize = tempWidth * 0.32;
          const qrX = tempWidth - qrSize - tempWidth * 0.02;
          const qrY = tempHeight - qrSize - tempHeight * 0.02;
          
          // 白い背景
          tempCtx.fillStyle = 'white';
          tempCtx.fillRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6);
          tempCtx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
        } catch (e) {
          console.warn('Failed to draw QR on blank leader:', e);
        }
      }
      
      // メインCanvasに全体を描画（上部エリアにフィット）
      // アスペクト比を維持して配置
      const targetHeight = leaderCroppedHeight;
      const targetWidth = Math.floor(targetHeight * (tempWidth / tempHeight));
      
      ctx.drawImage(
        tempCanvas,
        0, 0, tempWidth, tempHeight,
        GAP, 0, targetWidth, targetHeight
      );
    }
  } else if (leaderUrl) {
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
      // QRコードがあれば付きで描画、なければ通常描画
      if (cardData.qrDataUrl) {
        await drawBlankCardWithQR(ctx, cardData.card, x, y, CARD_WIDTH, CARD_HEIGHT, cardData.qrDataUrl);
      } else {
        drawBlankCardPlaceholder(ctx, cardData.card, x, y, CARD_WIDTH, CARD_HEIGHT);
      }
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
