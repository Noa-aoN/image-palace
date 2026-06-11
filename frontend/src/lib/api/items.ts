import { apiClient } from './client'
import type { Item } from '@/types/item'

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

export async function getItemsPage(page: number, per: number): Promise<ItemsPage> {
  const res = await apiClient.get<ItemsPage>('/api/v1/items', { params: { page, per } })
  return res.data
}

export async function getItem(id: string): Promise<Item> {
  const res = await apiClient.get<Item>(`/api/v1/items/${id}`)
  return res.data
}

export async function updateItem(id: string, title: string): Promise<Item> {
  const res = await apiClient.patch<Item>(`/api/v1/items/${id}`, { item: { title } })
  return res.data
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
