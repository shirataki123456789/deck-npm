import { NextRequest, NextResponse } from 'next/server';
import { loadAllCards, filterCards, getUniqueValues } from '@/lib/cards';
import { FilterOptions, DEFAULT_FILTER_OPTIONS } from '@/lib/types';

// 動的ルートとして強制
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const options: FilterOptions = {
      ...DEFAULT_FILTER_OPTIONS,
      ...body,
    };
    
    const allCards = loadAllCards();
    const filtered = filterCards(allCards, options);
    
    return NextResponse.json({
      count: filtered.length,
      cards: filtered,
    });
  } catch (error) {
    console.error('Filter error:', error);
    return NextResponse.json(
      { error: 'フィルタリング中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const allCards = loadAllCards();
    const uniqueValues = getUniqueValues(allCards);
    
    return NextResponse.json({
      total: allCards.length,
      ...uniqueValues,
    });
  } catch (error) {
    console.error('Load error:', error);
    return NextResponse.json(
      { error: 'カードデータの読み込み中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
