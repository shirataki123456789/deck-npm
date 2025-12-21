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
    
    // 許可するドメインをチェック
    const allowedDomains = [
      'onepiece-cardgame.com',
      'www.onepiece-cardgame.com',
    ];
    
    const urlObj = new URL(url);
    const isAllowed = allowedDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );
    
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Domain not allowed' },
        { status: 403 }
      );
    }
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: response.status }
      );
    }
    
    const contentType = response.headers.get('content-type') || 'image/png';
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
