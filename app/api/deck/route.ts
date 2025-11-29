import { NextRequest, NextResponse } from 'next/server';
import { exportDeckText, parseDeckText, getSortedDeckCards } from '@/lib/deck';
import { loadAllCards, getCardById, sortCards, computeSortKey } from '@/lib/cards';
import { Deck } from '@/lib/types';

// POST /api/deck - デッキ操作（export/import/sort）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as string;
    
    switch (action) {
      case 'export': {
        const deck: Deck = body.deck;
        const text = exportDeckText(deck);
        return NextResponse.json({ text });
      }
      
      case 'import': {
        const text = body.text as string;
        const deck = parseDeckText(text);
        
        // カード情報を付与
        const allCards = loadAllCards();
        const leaderCard = getCardById(allCards, deck.leader);
        const cardsInfo: Record<string, any> = {};
        
        Object.keys(deck.cards).forEach(cardId => {
          const card = getCardById(allCards, cardId);
          if (card) {
            cardsInfo[cardId] = {
              name: card.name,
              image_url: card.image_url,
              cost: card.cost,
              type: card.type,
              color: card.color,
            };
          }
        });
        
        return NextResponse.json({
          deck,
          leader_info: leaderCard ? {
            name: leaderCard.name,
            image_url: leaderCard.image_url,
            color: leaderCard.color,
          } : null,
          cards_info: cardsInfo,
        });
      }
      
      case 'sort': {
        const cardIds: string[] = body.card_ids;
        const allCards = loadAllCards();
        
        // カードIDリストからカード情報を取得してソート
        const cardsWithInfo = cardIds.map(id => {
          const card = getCardById(allCards, id);
          return {
            card_id: id,
            card,
            sortKey: card ? computeSortKey(card) : null,
          };
        });
        
        // ソート
        cardsWithInfo.sort((a, b) => {
          if (!a.sortKey || !b.sortKey) return 0;
          
          if (a.sortKey.type_rank !== b.sortKey.type_rank) {
            return a.sortKey.type_rank - b.sortKey.type_rank;
          }
          if (a.card && b.card && a.card.cost !== b.card.cost) {
            return a.card.cost - b.card.cost;
          }
          if (a.sortKey.base_priority !== b.sortKey.base_priority) {
            return a.sortKey.base_priority - b.sortKey.base_priority;
          }
          return a.card_id.localeCompare(b.card_id);
        });
        
        return NextResponse.json({
          card_ids_sorted: cardsWithInfo.map(c => c.card_id),
        });
      }
      
      default:
        return NextResponse.json(
          { error: '不明なアクションです' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Deck API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'デッキ操作中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
