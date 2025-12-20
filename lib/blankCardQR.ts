import { Card } from './types';

/**
 * ブランクカードをQRコード用に圧縮エンコード
 * フォーマット: B|id|name|type|colors|cost|power|counter|attr|features
 * - 効果テキストは含めない（QRサイズ制限のため）
 * - 区切り: |
 * - 配列は,区切り
 */
export function encodeBlankCardForQR(card: Card): string {
  const parts = [
    'B', // ブランクカードマーカー
    card.card_id,
    card.name.slice(0, 30), // カード名は30文字まで
    card.type.charAt(0), // C=CHARACTER, E=EVENT, S=STAGE
    card.color.join(','),
    String(card.cost),
    String(card.power || 0),
    String(card.counter || 0),
    card.attribute || '',
    card.features.slice(0, 5).join(','), // 特徴は最大5つ
    // 効果テキストとトリガーは含めない（手動で追加してもらう）
  ];
  return parts.join('|');
}

/**
 * QRコードからブランクカードをデコード
 * 効果テキストは空で返す（手動で追加が必要）
 */
export function decodeBlankCardFromQR(encoded: string): Card | null {
  try {
    if (!encoded.startsWith('B|')) return null;
    
    const parts = encoded.split('|');
    if (parts.length < 10) return null;
    
    const typeMap: { [key: string]: string } = {
      'C': 'CHARACTER',
      'E': 'EVENT',
      'S': 'STAGE',
    };
    
    return {
      card_id: parts[1],
      name: parts[2],
      type: typeMap[parts[3]] || 'CHARACTER',
      color: parts[4] ? parts[4].split(',') : [],
      cost: parseInt(parts[5], 10) || 0,
      power: parseInt(parts[6], 10) || 0,
      counter: parseInt(parts[7], 10) || 0,
      attribute: parts[8] || '',
      features: parts[9] ? parts[9].split(',').filter(f => f) : [],
      text: '', // 効果テキストは空（手動で追加）
      trigger: '', // トリガーも空
      image_url: '',
      is_parallel: false,
      card_code: '',
      rarity: '',
      block_icon: '',
      source: '',
      series_id: '',
    };
  } catch (e) {
    console.error('Failed to decode blank card:', e);
    return null;
  }
}
