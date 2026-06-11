import { apiClient } from './client'
import type { Collection, CollectionDetail } from '@/types/collection'

export async function getCollections(): Promise<Collection[]> {
  const res = await apiClient.get<{ collections: Collection[] }>('/api/v1/collections')
  return res.data.collections
}

export async function getCollection(id: string): Promise<CollectionDetail> {
  const res = await apiClient.get<CollectionDetail>(`/api/v1/collections/${id}`)
  return res.data
}

export async function createCollection(name: string, description?: string): Promise<Collection> {
  const res = await apiClient.post<Collection>('/api/v1/collections', {
    collection: { name, description },
  })
  return res.data
}

export async function updateCollection(
  id: string,
  payload: { name?: string; description?: string }
): Promise<Collection> {
  const res = await apiClient.patch<Collection>(`/api/v1/collections/${id}`, { collection: payload })
  return res.data
}

export async function deleteCollection(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/collections/${id}`)
}

export async function addDeckToCollection(collectionId: string, deckId: string): Promise<void> {
  await apiClient.post(`/api/v1/collections/${collectionId}/decks`, { deck_id: deckId })
}

export async function removeDeckFromCollection(collectionId: string, deckId: string): Promise<void> {
  await apiClient.delete(`/api/v1/collections/${collectionId}/decks/${deckId}`)
}
