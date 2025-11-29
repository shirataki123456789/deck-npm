// カードの型定義
export interface Card {
  name: string;           // カード名
  card_id: string;        // カードID（例: ST01-001）
  card_code: string;      // カードコード
  type: string;           // LEADER / CHARACTER / EVENT / STAGE
  rarity: string;         // C / R / SR / L など
  cost: number;           // コスト（-は0として扱う）
  attribute: string;      // 属性（打/射/特/知など）
  power: number;          // パワー
  counter: number;        // カウンター
  color: string[];        // 色（複数可能）
  block_icon: string;     // ブロックアイコン
  features: string[];     // 特徴の配列
  text: string;           // 効果テキスト
  trigger: string;        // トリガー
  source: string;         // 入手情報
  image_url: string;      // 画像URL
  is_parallel: boolean;   // パラレルカードかどうか
  series_id: string;      // シリーズID（入手情報から抽出）
}

// フィルタオプションの型定義
export interface FilterOptions {
  colors: string[];
  types: string[];
  costs: number[];
  counters: number[];
  powers: number[];      // パワーフィルタ追加
  attributes: string[];
  blocks: string[];
  features: string[];
  series_ids: string[];
  free_words: string;
  leader_colors: string[];  // デッキ作成時のリーダー色制限
  parallel_mode: 'normal' | 'parallel' | 'both';
  has_trigger: boolean | null;  // トリガーフィルター（null=全て, true=あり, false=なし）
}

// デッキの型定義
export interface Deck {
  name: string;
  leader: string;           // リーダーのcard_id
  cards: Record<string, number>;  // card_id -> 枚数
}

// ソートキーの型定義
export interface SortKey {
  base_priority: number;
  type_rank: number;
  sub_priority: number;
  multi_flag: number;
}

// 色の順序
export const COLOR_ORDER = ['赤', '緑', '青', '紫', '黒', '黄'] as const;
export type CardColor = typeof COLOR_ORDER[number];

// 色の優先度マップ
export const COLOR_PRIORITY: Record<string, number> = {
  '赤': 0,
  '緑': 1,
  '青': 2,
  '紫': 3,
  '黒': 4,
  '黄': 5,
};

// タイプの優先度
export const TYPE_PRIORITY: Record<string, number> = {
  'LEADER': 0,
  'CHARACTER': 1,
  'EVENT': 2,
  'STAGE': 3,
};

// 色からHEXカラーコードへのマップ
export const COLOR_HEX: Record<string, string> = {
  '赤': '#AC1122',
  '緑': '#008866',
  '青': '#0084BD',
  '紫': '#93388B',
  '黒': '#211818',
  '黄': '#F7E731',
};

// 無制限カードのリスト
export const UNLIMITED_CARDS = ['OP01-075', 'OP08-072'];

// デフォルトのフィルタオプション
export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  colors: [],
  types: [],
  costs: [],
  counters: [],
  powers: [],
  attributes: [],
  blocks: [],
  features: [],
  series_ids: [],
  free_words: '',
  leader_colors: [],
  parallel_mode: 'normal',
  has_trigger: null,  // null = 全て表示
};