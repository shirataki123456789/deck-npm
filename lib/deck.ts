import { Deck, Card, UNLIMITED_CARDS } from './types';
import { loadAllCards, getCardById, sortCards, computeSortKey } from './cards';

/**
 * デッキをテキスト形式でエクスポート
 * フォーマット:
 * # デッキ名
 * 1xOP01-001 (リーダー)
 * 4xOP01-002
 * ...
 */
export function exportDeckText(deck: Deck, cards?: Card[]): string {
  const allCards = cards || loadAllCards();
  const lines: string[] = [];
  
  // デッキ名
  if (deck.name) {
    lines.push(`# ${deck.name}`);
  }
  
  // リーダー
  lines.push(`1x${deck.leader}`);
  
  // カードをソートしてエクスポート
  const deckCards: { card_id: string; count: number; sortKey: any; cost: number }[] = [];
  
  Object.entries(deck.cards).forEach(([cardId, count]) => {
    const card = getCardById(allCards, cardId);
    if (card) {
      const sortKey = computeSortKey(card);
      deckCards.push({
        card_id: cardId,
        count,
        sortKey,
        cost: card.cost,
      });
    } else {
      // カードが見つからない場合は末尾に
      deckCards.push({
        card_id: cardId,
        count,
        sortKey: { base_priority: 999, type_rank: 999, sub_priority: 0, multi_flag: 0 },
        cost: 0,
      });
    }
  });
  
  // ソート
  deckCards.sort((a, b) => {
    if (a.sortKey.type_rank !== b.sortKey.type_rank) {
      return a.sortKey.type_rank - b.sortKey.type_rank;
    }
    if (a.cost !== b.cost) {
      return a.cost - b.cost;
    }
    if (a.sortKey.base_priority !== b.sortKey.base_priority) {
      return a.sortKey.base_priority - b.sortKey.base_priority;
    }
    return a.card_id.localeCompare(b.card_id);
  });
  
  // 出力
  deckCards.forEach(({ card_id, count }) => {
    lines.push(`${count}x${card_id}`);
  });
  
  return lines.join('\n');
}

/**
 * テキスト形式からデッキをインポート
 */
export function parseDeckText(text: string): Deck {
  const deck: Deck = {
    name: '',
    leader: '',
    cards: {},
  };
  
  const lines = text.trim().split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length === 0) {
    throw new Error('デッキテキストが空です');
  }
  
  let startIdx = 0;
  
  // デッキ名（オプション）
  if (lines[0].startsWith('#')) {
    deck.name = lines[0].substring(1).trim();
    startIdx = 1;
  }
  
  if (startIdx >= lines.length) {
    throw new Error('リーダーが指定されていません');
  }
  
  // リーダー行
  const leaderLine = lines[startIdx];
  if (!leaderLine.includes('x')) {
    throw new Error('リーダー行の形式が不正です（"x"がありません）');
  }
  
  const [, leaderId] = leaderLine.split('x');
  deck.leader = leaderId.trim();
  
  // カード行
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('x')) continue;
    
    const [countStr, cardId] = line.split('x');
    const count = parseInt(countStr.trim(), 10);
    
    if (!isNaN(count) && cardId) {
      deck.cards[cardId.trim()] = count;
    }
  }
  
  return deck;
}

/**
 * デッキの合計カード枚数を計算
 */
export function getDeckTotalCount(deck: Deck): number {
  return Object.values(deck.cards).reduce((sum, count) => sum + count, 0);
}

/**
 * カードを追加できるかチェック
 */
export function canAddCard(deck: Deck, cardId: string): boolean {
  const currentCount = deck.cards[cardId] || 0;
  
  // 無制限カードは制限なし
  if (UNLIMITED_CARDS.includes(cardId)) {
    return true;
  }
  
  // 通常は4枚まで
  return currentCount < 4;
}

/**
 * デッキにカードを追加
 */
export function addCardToDeck(deck: Deck, cardId: string): Deck {
  if (!canAddCard(deck, cardId)) {
    return deck;
  }
  
  return {
    ...deck,
    cards: {
      ...deck.cards,
      [cardId]: (deck.cards[cardId] || 0) + 1,
    },
  };
}

/**
 * デッキからカードを削除
 */
export function removeCardFromDeck(deck: Deck, cardId: string): Deck {
  const currentCount = deck.cards[cardId] || 0;
  
  if (currentCount <= 0) {
    return deck;
  }
  
  const newCards = { ...deck.cards };
  
  if (currentCount === 1) {
    delete newCards[cardId];
  } else {
    newCards[cardId] = currentCount - 1;
  }
  
  return {
    ...deck,
    cards: newCards,
  };
}

/**
 * デッキのカード一覧をソートして取得
 */
export function getSortedDeckCards(deck: Deck, allCards?: Card[]): { card: Card; count: number }[] {
  const cards = allCards || loadAllCards();
  const result: { card: Card; count: number; sortKey: any }[] = [];
  
  Object.entries(deck.cards).forEach(([cardId, count]) => {
    const card = getCardById(cards, cardId);
    if (card) {
      result.push({
        card,
        count,
        sortKey: computeSortKey(card),
      });
    }
  });
  
  // ソート
  result.sort((a, b) => {
    const keyA = a.sortKey;
    const keyB = b.sortKey;
    
    if (keyA.type_rank !== keyB.type_rank) {
      return keyA.type_rank - keyB.type_rank;
    }
    if (a.card.cost !== b.card.cost) {
      return a.card.cost - b.card.cost;
    }
    if (keyA.base_priority !== keyB.base_priority) {
      return keyA.base_priority - keyB.base_priority;
    }
    return a.card.card_id.localeCompare(b.card.card_id);
  });
  
  return result.map(({ card, count }) => ({ card, count }));
}

/**
 * デッキが有効かチェック（50枚ちょうど）
 */
export function isDeckValid(deck: Deck): { valid: boolean; message: string } {
  const total = getDeckTotalCount(deck);
  
  if (!deck.leader) {
    return { valid: false, message: 'リーダーが選択されていません' };
  }
  
  if (total < 50) {
    return { valid: false, message: `カードが${50 - total}枚不足しています` };
  }
  
  if (total > 50) {
    return { valid: false, message: `カードが${total - 50}枚超過しています` };
  }
  
  return { valid: true, message: 'デッキが完成しました！' };
}
