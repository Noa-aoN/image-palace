import { apiClient } from './client'
import type { Item, ItemType } from '@/types/item'

export interface ItemsSummary {
  total_count: number
  pending_count: number
  processing_count: number
  failed_count: number
  monthly_count: number
  monthly_limit: number
  monthly_remaining: number
}

export async function createItem(title: string, forceGenerate = false, tags?: string[]): Promise<Item> {
  const res = await apiClient.post<Item>('/api/v1/items', {
    item: { title, force_generate: forceGenerate, ...(tags ? { tags } : {}) },
  })
  return res.data
}

export interface PaginationMeta {
  page: number
  per: number
  total_count: number
  total_pages: number
}

export interface ItemsPage {
  items: Item[]
  meta: PaginationMeta
}

export async function getItems(): Promise<Item[]> {
  const res = await apiClient.get<{ items: Item[] }>('/api/v1/items')
  return res.data.items
}

export async function getItemsPage(
  page: number,
  per: number,
  tagId?: string,
  query?: string
): Promise<ItemsPage> {
  const params: Record<string, string | number> = { page, per }
  if (tagId) params.tag_id = tagId
  if (query && query.trim()) params.q = query.trim()
  const res = await apiClient.get<ItemsPage>('/api/v1/items', { params })
  return res.data
}

export interface ItemSuggestion {
  id: string
  title: string
}

export async function getItemSuggestions(query: string): Promise<ItemSuggestion[]> {
  const q = query.trim()
  if (!q) return []
  const res = await apiClient.get<{ suggestions: ItemSuggestion[] }>('/api/v1/items/suggest', {
    params: { q },
  })
  return res.data.suggestions
}

export async function getItem(id: string): Promise<Item> {
  const res = await apiClient.get<Item>(`/api/v1/items/${id}`)
  return res.data
}

export interface ItemUpdatePayload {
  title?: string
  item_type_id?: string
  /** 空文字を渡すと意味は削除される */
  meaning?: string
  /** タグ名の配列で置き換える（未指定なら変更しない） */
  tags?: string[]
}

export async function updateItem(id: string, payload: ItemUpdatePayload): Promise<Item> {
  const res = await apiClient.patch<Item>(`/api/v1/items/${id}`, { item: payload })
  return res.data
}

export async function getItemTypes(): Promise<ItemType[]> {
  const res = await apiClient.get<{ item_types: ItemType[] }>('/api/v1/item_types')
  return res.data.item_types
}

export async function getItemsSummary(): Promise<ItemsSummary> {
  const res = await apiClient.get<ItemsSummary>('/api/v1/items/summary')
  return res.data
}

export async function deleteItem(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/items/${id}`)
}

export async function retryItem(id: string): Promise<Item> {
  const res = await apiClient.post<Item>(`/api/v1/items/${id}/retry`)
  return res.data
}
