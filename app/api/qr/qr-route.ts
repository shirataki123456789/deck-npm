import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

// GET /api/qr?text=...&size=400 - QRコード画像を生成
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text') || 'deck:example';
    const size = parseInt(searchParams.get('size') || '400', 10);
    
    // Data URLとして生成
    const dataUrl = await QRCode.toDataURL(text, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    
    // Data URLからBase64部分を抽出してBufferに変換
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
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

// Note: QRコードのデコードはクライアントサイドで行う（jsQR + Canvas API）
// サーバーサイドでのsharp依存を避けるため
