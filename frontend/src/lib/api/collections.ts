import { apiClient } from './client'
import type { Collection, CollectionDetail, CollectionEntryType } from '@/types/collection'
import type { CoverType } from '@/types/cover'

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
  payload: { name?: string; description?: string; cover_item_id?: string | null; cover_type?: CoverType }
): Promise<Collection> {
  const res = await apiClient.patch<Collection>(`/api/v1/collections/${id}`, { collection: payload })
  return res.data
}

// カバー画像のアップロード（cover_type は custom に切替）
export async function uploadCollectionCover(id: string, file: File): Promise<Collection> {
  const form = new FormData()
  form.append('cover_image', file)
  const res = await apiClient.post<Collection>(`/api/v1/collections/${id}/cover_image`, form)
  return res.data
}

// カバー画像の削除（cover_type は first_card に戻る）
export async function removeCollectionCover(id: string): Promise<Collection> {
  const res = await apiClient.delete<Collection>(`/api/v1/collections/${id}/cover_image`)
  return res.data
}

export async function deleteCollection(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/collections/${id}`)
}

export async function addEntryToCollection(
  collectionId: string,
  entryType: CollectionEntryType,
  entryId: string
): Promise<void> {
  await apiClient.post(`/api/v1/collections/${collectionId}/entries`, {
    entry_type: entryType,
    entry_id: entryId,
  })
}

export async function removeEntryFromCollection(
  collectionId: string,
  entryType: CollectionEntryType,
  entryId: string
): Promise<void> {
  await apiClient.delete(`/api/v1/collections/${collectionId}/entries/${entryType}/${entryId}`)
}
