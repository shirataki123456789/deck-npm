import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 動的ルートとして強制
export const dynamic = 'force-dynamic';

// GET /api/custom-csv - custom_cards.csvの内容を取得
export async function GET() {
  try {
    const csvPath = path.join(process.cwd(), 'data', 'custom_cards.csv');
    
    if (!fs.existsSync(csvPath)) {
      // ファイルがない場合はヘッダーのみ返す
      const header = 'カード名,カードID,カードコード,タイプ,レアリティ,コスト,属性,パワー,カウンター,色,ブロックアイコン,特徴,テキスト,トリガー,入手情報,画像URL';
      return NextResponse.json({ csv: header });
    }
    
    const content = fs.readFileSync(csvPath, 'utf-8');
    return NextResponse.json({ csv: content });
  } catch (error) {
    console.error('Custom CSV read error:', error);
    return NextResponse.json(
      { error: 'CSVの読み込みに失敗しました' },
      { status: 500 }
    );
  }
}
