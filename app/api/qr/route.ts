import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

// GET /api/qr?text=...&size=400 - QRコード画像を生成
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text') || 'deck:example';
    const size = parseInt(searchParams.get('size') || '400', 10);
    
    const buffer = await QRCode.toBuffer(text, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('QR generation error:', error);
    return NextResponse.json(
      { error: 'QRコード生成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// POST /api/qr - QRコード画像をデコード
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが指定されていません' },
        { status: 400 }
      );
    }
    
    // ファイルをArrayBufferとして読み込み
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // sharp を使って画像をRGBAデータに変換
    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // jsQRでデコード
    const code = jsQR(
      new Uint8ClampedArray(data),
      info.width,
      info.height
    );
    
    if (!code) {
      return NextResponse.json(
        { error: 'QRコードが検出されませんでした' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ text: code.data });
  } catch (error) {
    console.error('QR decode error:', error);
    return NextResponse.json(
      { error: 'QRコードの読み取り中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
