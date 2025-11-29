import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { COLOR_HEX } from '@/lib/types';

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
 * URLから画像をダウンロード
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error('Image download error:', url, error);
    return null;
  }
}

/**
 * グラデーション背景を生成
 */
async function createGradientBackground(colors: string[]): Promise<Buffer> {
  if (colors.length === 0) {
    colors = ['#cccccc'];
  }
  
  // SVGでグラデーションを作成
  let gradientStops = '';
  
  if (colors.length === 1) {
    gradientStops = `<stop offset="0%" stop-color="${colors[0]}"/>
                     <stop offset="100%" stop-color="${colors[0]}"/>`;
  } else {
    colors.forEach((color, i) => {
      const offset = (i / (colors.length - 1)) * 100;
      gradientStops += `<stop offset="${offset}%" stop-color="${color}"/>`;
    });
  }
  
  const svg = `
    <svg width="${FINAL_WIDTH}" height="${FINAL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          ${gradientStops}
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
    </svg>
  `;
  
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * QRコード画像を生成
 */
async function generateQRImage(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    width: QR_SIZE,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// POST /api/image - デッキ画像を生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      leader_url,
      card_urls = [],
      deck_name = '',
      qr_text = '',
      leader_colors = [],
    } = body;
    
    // 背景色を決定
    const bgColors = leader_colors.length > 0
      ? leader_colors.map((c: string) => COLOR_HEX[c] || c)
      : ['#cccccc'];
    
    // 背景画像を生成
    let baseImage = await createGradientBackground(bgColors);
    let compositeOps: sharp.OverlayOptions[] = [];
    
    // リーダー画像の配置
    const leaderCroppedHeight = UPPER_HEIGHT;
    const leaderCroppedWidth = Math.floor(leaderCroppedHeight * (400 / 280));
    
    if (leader_url) {
      const leaderBuffer = await downloadImage(leader_url);
      if (leaderBuffer) {
        // リーダー画像をリサイズして上半分をクロップ
        const resized = await sharp(leaderBuffer)
          .resize(leaderCroppedWidth, leaderCroppedHeight * 2, { fit: 'cover' })
          .extract({ left: 0, top: 0, width: leaderCroppedWidth, height: leaderCroppedHeight })
          .toBuffer();
        
        compositeOps.push({
          input: resized,
          left: GAP,
          top: 0,
        });
      }
    }
    
    // QRコードの配置
    const qrX = FINAL_WIDTH - GAP - QR_SIZE;
    const qrY = Math.floor((UPPER_HEIGHT - QR_SIZE) / 2);
    
    if (qr_text) {
      const qrBuffer = await generateQRImage(qr_text);
      const qrResized = await sharp(qrBuffer)
        .resize(QR_SIZE, QR_SIZE)
        .toBuffer();
      
      compositeOps.push({
        input: qrResized,
        left: qrX,
        top: qrY,
      });
    }
    
    // デッキ名の配置（SVGで作成）
    if (deck_name) {
      const deckNameAreaStart = GAP + leaderCroppedWidth + GAP;
      const deckNameAreaWidth = FINAL_WIDTH - deckNameAreaStart - GAP - QR_SIZE - GAP;
      const textY = Math.floor(UPPER_HEIGHT / 2);
      
      // 半透明の背景とテキストをSVGで作成
      const textSvg = `
        <svg width="${deckNameAreaWidth}" height="120" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.5)" rx="10"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
                fill="white" font-size="48" font-family="sans-serif" font-weight="bold">
            ${deck_name.replace(/[<>&'"]/g, '')}
          </text>
        </svg>
      `;
      
      compositeOps.push({
        input: Buffer.from(textSvg),
        left: deckNameAreaStart,
        top: textY - 60,
      });
    }
    
    // カードグリッドの配置
    const gridStartY = UPPER_HEIGHT;
    const gridStartX = Math.floor((FINAL_WIDTH - (CARD_WIDTH * CARDS_PER_ROW)) / 2);
    
    // カード画像を並列でダウンロード（最大50枚）
    const cardUrls = card_urls.slice(0, CARDS_PER_ROW * CARDS_PER_COL);
    const cardBuffers = await Promise.all(
      cardUrls.map((url: string) => downloadImage(url))
    );
    
    for (let idx = 0; idx < cardBuffers.length; idx++) {
      const buffer = cardBuffers[idx];
      if (!buffer) continue;
      
      const row = Math.floor(idx / CARDS_PER_ROW);
      const col = idx % CARDS_PER_ROW;
      
      const x = gridStartX + col * CARD_WIDTH;
      const y = gridStartY + row * CARD_HEIGHT;
      
      const resized = await sharp(buffer)
        .resize(CARD_WIDTH, CARD_HEIGHT, { fit: 'cover' })
        .toBuffer();
      
      compositeOps.push({
        input: resized,
        left: x,
        top: y,
      });
    }
    
    // 全てを合成
    const finalImage = await sharp(baseImage)
      .composite(compositeOps)
      .png()
      .toBuffer();
    
    return new NextResponse(finalImage, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="deck_image.png"`,
      },
    });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: 'デッキ画像の生成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
