import { Card } from './types';

/**
 * ブランクカードをQRコード用に圧縮エンコード
 * フォーマット: B|id|name|type|colors|cost|power|counter|attr|features|text|trigger
 * - 区切り: |
 * - 配列は,区切り
 * - 特殊文字は最小限のエスケープ
 */
export function encodeBlankCardForQR(card: Card): string {
  const parts = [
    'B', // ブランクカードマーカー
    card.card_id,
    card.name,
    card.type.charAt(0), // C=CHARACTER, E=EVENT, S=STAGE
    card.color.join(','),
    String(card.cost),
    String(card.power || 0),
    String(card.counter || 0),
    card.attribute || '',
    card.features.join(','),
    (card.text || '').replace(/\|/g, '¦').replace(/\n/g, '↵'), // |と改行をエスケープ
    (card.trigger || '').replace(/\|/g, '¦'),
  ];
  return parts.join('|');
}

/**
 * QRコードからブランクカードをデコード
 */
export function decodeBlankCardFromQR(encoded: string): Card | null {
  try {
    if (!encoded.startsWith('B|')) return null;
    
    const parts = encoded.split('|');
    if (parts.length < 12) return null;
    
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
      text: (parts[10] || '').replace(/¦/g, '|').replace(/↵/g, '\n'),
      trigger: (parts[11] || '').replace(/¦/g, '|'),
      image_url: '', // ブランクカードは画像なし
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
