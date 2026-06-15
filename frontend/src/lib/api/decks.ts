import { apiClient } from './client'
import type { Deck, DeckCoverType, DeckDetail } from '@/types/deck'

export async function getDecks(): Promise<Deck[]> {
  const res = await apiClient.get<{ decks: Deck[] }>('/api/v1/decks')
  return res.data.decks
}

export async function getDeck(id: string): Promise<DeckDetail> {
  const res = await apiClient.get<DeckDetail>(`/api/v1/decks/${id}`)
  return res.data
}

export async function createDeck(name: string): Promise<Deck> {
  const res = await apiClient.post<Deck>('/api/v1/decks', { deck: { name } })
  return res.data
}

export async function updateDeck(
  id: string,
  payload: { name?: string; cover_item_id?: string | null; cover_type?: DeckCoverType }
): Promise<Deck> {
  const res = await apiClient.patch<Deck>(`/api/v1/decks/${id}`, { deck: payload })
  return res.data
}

// custom カバー画像のアップロード（multipart）。成功時 cover_type は custom になる。
export async function uploadDeckCover(id: string, file: File): Promise<Deck> {
  const form = new FormData()
  form.append('cover_image', file)
  const res = await apiClient.post<Deck>(`/api/v1/decks/${id}/cover_image`, form)
  return res.data
}

// custom カバー画像を削除し first_card に戻す
export async function removeDeckCover(id: string): Promise<Deck> {
  const res = await apiClient.delete<Deck>(`/api/v1/decks/${id}/cover_image`)
  return res.data
}

export async function deleteDeck(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/decks/${id}`)
}

export async function addItemToDeck(deckId: string, itemId: string): Promise<void> {
  await apiClient.post(`/api/v1/decks/${deckId}/items`, { item_id: itemId })
}

export async function removeItemFromDeck(deckId: string, itemId: string): Promise<void> {
  await apiClient.delete(`/api/v1/decks/${deckId}/items/${itemId}`)
}
