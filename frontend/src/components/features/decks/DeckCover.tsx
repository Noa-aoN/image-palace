'use client'

import type { Deck } from '@/types/deck'
import { EntityCover } from '@/components/features/shared/EntityCover'

type CoverDeck = Pick<Deck, 'name' | 'cover_type' | 'cover_images' | 'cover_image' | 'cover'>

/**
 * デッキカバー。汎用 EntityCover に委譲する（コレクション/スペース/ビューと共通実装）。
 */
export function DeckCover({ deck }: { deck: CoverDeck }) {
  return <EntityCover cover={deck} />
}
