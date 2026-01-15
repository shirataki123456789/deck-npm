import { NextRequest, NextResponse } from 'next/server';

// 動的ルートとして強制
export const dynamic = 'force-dynamic';

// GET /api/proxy?url=... - 画像をプロキシ
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }
    
    // URLの形式をチェック
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }
    
    // httpまたはhttpsのみ許可
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return NextResponse.json(
        { error: 'Invalid protocol' },
        { status: 400 }
      );
    }
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: response.status }
      );
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    // 画像のみ許可
    if (!contentType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Not an image' },
        { status: 403 }
      );
    }
    
    const buffer = await response.arrayBuffer();
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy error' },
      { status: 500 }
    );
  }
}
