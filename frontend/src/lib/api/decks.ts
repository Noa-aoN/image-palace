import { apiClient } from './client'
import type { Deck, DeckDetail } from '@/types/deck'

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
  payload: { name?: string; cover_item_id?: string | null }
): Promise<Deck> {
  const res = await apiClient.patch<Deck>(`/api/v1/decks/${id}`, { deck: payload })
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
