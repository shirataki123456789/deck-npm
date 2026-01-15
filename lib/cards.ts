import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import {
  Card,
  FilterOptions,
  SortKey,
  COLOR_ORDER,
  COLOR_PRIORITY,
  TYPE_PRIORITY,
} from './types';

// CSVファイルのパス
const DATA_DIR = path.join(process.cwd(), 'data');
const MAIN_CSV = path.join(DATA_DIR, 'cardlist_filtered.csv');
const PARALLEL_CSV = path.join(DATA_DIR, 'cardlist_p_only.csv');
const CUSTOM_CSV = path.join(DATA_DIR, 'custom_cards.csv');

// カードデータのキャッシュ
let cardsCache: Card[] | null = null;

/**
 * 入手情報からシリーズIDを抽出
 */
function extractSeriesId(source: string): string {
  if (!source || source === '-') return '-';
  
  const match = source.match(/【(.*?)】/);
  if (match) {
    return match[1].trim();
  }
  
  const trimmed = source.trim();
  if (trimmed === '' || trimmed === '-') return '-';
  
  return 'その他';
}

/**
 * 文字列を配列に分割（/や／で区切る）
 */
function splitAndTrim(str: string): string[] {
  if (!str || str === '-') return [];
  return str
    .split(/[/／,]/)
    .map(s => s.trim())
    .filter(s => s && s !== '-');
}

/**
 * 数値に変換（-や空文字は0）
 */
function parseIntOrZero(str: string): number {
  if (!str || str === '-') return 0;
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * CSVファイルを読み込んでカード配列に変換
 */
function loadCSV(filePath: string, isParallel: boolean = false): Card[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true, // BOMを自動処理
  });
  
  // custom_cards.csvかどうかを判定
  const isCustomCSV = filePath.includes('custom_cards.csv');
  
  return records.map((row: any) => {
    const cardId = row['カードID'] || '';
    const colors = splitAndTrim(row['色'] || '');
    const features = splitAndTrim(row['特徴'] || '');
    
    // 画像URLの決定
    let imageUrl = row['画像URL'] || '';
    if (imageUrl === '-') {
      imageUrl = '';
    }
    // custom_cards.csvの場合は画像URLが空ならそのまま空（ブランク風表示）
    // それ以外のCSVは画像URLが空ならデフォルトURLを設定
    if (!imageUrl && cardId && !isCustomCSV) {
      imageUrl = `https://www.onepiece-cardgame.com/images/cardlist/card/${cardId}.png`;
    }
    
    const card: Card = {
      name: row['カード名'] || '',
      card_id: cardId,
      card_code: row['カードコード'] || '',
      type: (row['タイプ'] || '').toUpperCase().trim(),
      rarity: row['レアリティ'] || '',
      cost: parseIntOrZero(row['コスト']),
      attribute: row['属性'] || '',
      power: parseIntOrZero(row['パワー']),
      counter: parseIntOrZero(row['カウンター']),
      color: colors,
      block_icon: row['ブロックアイコン'] || '',
      features: features,
      text: row['テキスト'] || '',
      trigger: row['トリガー'] || '',
      source: row['入手情報'] || '',
      image_url: imageUrl,
      is_parallel: isParallel || cardId.includes('_p'),
      series_id: extractSeriesId(row['入手情報'] || ''),
    };
    
    return card;
  });
}

/**
 * 全カードデータを読み込む
 */
export function loadAllCards(): Card[] {
  if (cardsCache) {
    return cardsCache;
  }
  
  const mainCards = loadCSV(MAIN_CSV, false);
  const parallelCards = loadCSV(PARALLEL_CSV, true);
  const customCards = loadCSV(CUSTOM_CSV, false);
  
  cardsCache = [...mainCards, ...parallelCards, ...customCards];
  return cardsCache;
}

/**
 * キャッシュをクリア
 */
export function clearCache(): void {
  cardsCache = null;
}

/**
 * ソートキーを計算
 */
export function computeSortKey(card: Card): SortKey {
  let basePriority = 999;
  let subPriority = 0;
  let multiFlag = 0;
  
  if (card.color.length === 0) {
    basePriority = 999;
  } else {
    // 最初に見つかった色の優先度を使用
    for (const color of COLOR_ORDER) {
      if (card.color.includes(color)) {
        basePriority = COLOR_PRIORITY[color];
        break;
      }
    }
    
    // 複数色の場合
    if (card.color.length > 1) {
      multiFlag = 1;
      for (const color of COLOR_ORDER) {
        if (card.color.includes(color) && COLOR_PRIORITY[color] !== basePriority) {
          subPriority = COLOR_PRIORITY[color] + 1;
          break;
        }
      }
    }
  }
  
  const typeRank = TYPE_PRIORITY[card.type] ?? 9;
  
  return {
    base_priority: basePriority,
    type_rank: typeRank,
    sub_priority: subPriority,
    multi_flag: multiFlag,
  };
}

/**
 * カードをソート
 */
export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const keyA = computeSortKey(a);
    const keyB = computeSortKey(b);
    
    // 1) ベース優先度
    if (keyA.base_priority !== keyB.base_priority) {
      return keyA.base_priority - keyB.base_priority;
    }
    // 2) タイプランク
    if (keyA.type_rank !== keyB.type_rank) {
      return keyA.type_rank - keyB.type_rank;
    }
    // 3) サブ優先度
    if (keyA.sub_priority !== keyB.sub_priority) {
      return keyA.sub_priority - keyB.sub_priority;
    }
    // 4) マルチフラグ
    if (keyA.multi_flag !== keyB.multi_flag) {
      return keyA.multi_flag - keyB.multi_flag;
    }
    // 5) コスト
    if (a.cost !== b.cost) {
      return a.cost - b.cost;
    }
    // 6) カードID
    if (a.card_id !== b.card_id) {
      return a.card_id.localeCompare(b.card_id);
    }
    // 7) パラレル（通常が先）
    if (a.is_parallel !== b.is_parallel) {
      return a.is_parallel ? 1 : -1;
    }
    
    return a.name.localeCompare(b.name);
  });
}

/**
 * カードをフィルタリング
 */
export function filterCards(cards: Card[], options: FilterOptions): Card[] {
  let result = [...cards];
  
  // 1) パラレルモードフィルタ
  if (options.parallel_mode === 'parallel') {
    result = result.filter(c => c.is_parallel);
  } else if (options.parallel_mode === 'normal') {
    result = result.filter(c => !c.is_parallel);
  }
  
  // 2) リーダー色制限（デッキ作成時）
  if (options.leader_colors.length > 0) {
    result = result.filter(c => {
      if (c.type === 'LEADER') return false;
      return c.color.some(color => options.leader_colors.includes(color));
    });
  }
  
  // 3) 色フィルタ
  if (options.colors.length > 0) {
    result = result.filter(c =>
      c.color.some(color => options.colors.includes(color))
    );
  }
  
  // 4) タイプフィルタ
  if (options.types.length > 0) {
    result = result.filter(c =>
      options.types.includes(c.type)
    );
  }
  
  // 5) コストフィルタ
  if (options.costs.length > 0) {
    result = result.filter(c =>
      options.costs.includes(c.cost)
    );
  }
  
  // 6) カウンターフィルタ
  if (options.counters.length > 0) {
    result = result.filter(c =>
      options.counters.includes(c.counter)
    );
  }
  
  // 6.5) パワーフィルタ
  if (options.powers.length > 0) {
    result = result.filter(c =>
      options.powers.includes(c.power)
    );
  }
  
  // 7) 属性フィルタ
  if (options.attributes.length > 0) {
    result = result.filter(c =>
      options.attributes.some(attr => c.attribute.includes(attr))
    );
  }
  
  // 8) ブロックアイコンフィルタ
  if (options.blocks.length > 0) {
    result = result.filter(c =>
      options.blocks.includes(c.block_icon)
    );
  }
  
  // 9) 特徴フィルタ
  if (options.features.length > 0) {
    result = result.filter(c =>
      c.features.some(f => options.features.some(of => f.includes(of) || of.includes(f)))
    );
  }
  
  // 10) シリーズIDフィルタ
  if (options.series_ids.length > 0) {
    result = result.filter(c =>
      options.series_ids.includes(c.series_id)
    );
  }
  
  // 11) フリーワードフィルタ（スペース区切りでAND検索）
  if (options.free_words.trim()) {
    const words = options.free_words.trim().toLowerCase().split(/\s+/);
    result = result.filter(c => {
      // カード名、カードID、特徴、効果テキスト、トリガーを検索対象に
      const searchText = `${c.name} ${c.card_id} ${c.features.join(' ')} ${c.text} ${c.trigger}`.toLowerCase();
      return words.every(word => searchText.includes(word));
    });
  }
  
  // 12) トリガーフィルタ
  if (options.has_trigger === true) {
    result = result.filter(c => c.trigger && c.trigger.trim() !== '' && c.trigger !== '-');
  } else if (options.has_trigger === false) {
    result = result.filter(c => !c.trigger || c.trigger.trim() === '' || c.trigger === '-');
  }
  
  // 13) レアリティフィルタ
  if (options.rarities && options.rarities.length > 0) {
    result = result.filter(c =>
      options.rarities.includes(c.rarity)
    );
  }
  
  // ソートして返す
  return sortCards(result);
}

/**
 * 全ての一意な値を取得するヘルパー関数
 */
export function getUniqueValues(cards: Card[]) {
  const colors = new Set<string>();
  const types = new Set<string>();
  const costs = new Set<number>();
  const counters = new Set<number>();
  const powers = new Set<number>();
  const attributes = new Set<string>();
  const blocks = new Set<string>();
  const features = new Set<string>();
  const seriesIds = new Set<string>();
  const rarities = new Set<string>();
  
  // レアリティの表示順序
  const RARITY_ORDER: Record<string, number> = {
    'L': 0, 'SEC': 1, 'SP': 2, 'SR': 3, 'R': 4, 'UC': 5, 'C': 6, 'P': 7,
  };
  
  cards.forEach(card => {
    card.color.forEach(c => colors.add(c));
    if (card.type) types.add(card.type);
    costs.add(card.cost);
    counters.add(card.counter);
    if (card.power >= 0) powers.add(card.power);
    if (card.attribute && card.attribute !== '-') {
      splitAndTrim(card.attribute).forEach(a => attributes.add(a));
    }
    if (card.block_icon && card.block_icon !== '-') blocks.add(card.block_icon);
    card.features.forEach(f => features.add(f));
    if (card.series_id && card.series_id !== '-') seriesIds.add(card.series_id);
    if (card.rarity && card.rarity !== '-') rarities.add(card.rarity);
  });
  
  return {
    colors: Array.from(colors).sort((a, b) => (COLOR_PRIORITY[a] ?? 999) - (COLOR_PRIORITY[b] ?? 999)),
    types: Array.from(types).sort((a, b) => (TYPE_PRIORITY[a] ?? 999) - (TYPE_PRIORITY[b] ?? 999)),
    costs: Array.from(costs).sort((a, b) => a - b),
    counters: Array.from(counters).sort((a, b) => a - b),
    powers: Array.from(powers).sort((a, b) => a - b),
    attributes: Array.from(attributes).sort(),
    blocks: Array.from(blocks).sort(),
    features: Array.from(features).sort(),
    seriesIds: Array.from(seriesIds).sort(),
    rarities: Array.from(rarities).sort((a, b) => (RARITY_ORDER[a] ?? 999) - (RARITY_ORDER[b] ?? 999)),
  };
}

/**
 * カードIDからカードを取得（通常版優先）
 */
export function getCardById(cards: Card[], cardId: string): Card | undefined {
  // 通常版を優先
  const normalCard = cards.find(c => c.card_id === cardId && !c.is_parallel);
  if (normalCard) return normalCard;
  
  // なければパラレルも含めて検索
  return cards.find(c => c.card_id === cardId);
}