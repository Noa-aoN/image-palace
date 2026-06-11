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

export async function createItem(title: string, forceGenerate = false): Promise<Item> {
  const res = await apiClient.post<Item>('/api/v1/items', { item: { title, force_generate: forceGenerate } })
  return res.data
}

export async function getItems(): Promise<Item[]> {
  const res = await apiClient.get<{ items: Item[] }>('/api/v1/items')
  return res.data.items
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
