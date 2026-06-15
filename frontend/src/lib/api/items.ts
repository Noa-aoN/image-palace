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

export interface CreateItemOptions {
  style?: string
  customPrompt?: string
  /** 各カードの意味・説明を AI で自動生成するか（未指定ならユーザー設定に従う） */
  generateMeaning?: boolean
  /** 作成したカードを追加するデッキ ID の配列 */
  deckIds?: string[]
}

export async function createItem(
  title: string,
  forceGenerate = false,
  tags?: string[],
  options?: CreateItemOptions
): Promise<Item> {
  const res = await apiClient.post<Item>('/api/v1/items', {
    item: {
      title,
      force_generate: forceGenerate,
      ...(tags ? { tags } : {}),
      ...(options?.style ? { style: options.style } : {}),
      ...(options?.customPrompt ? { custom_prompt: options.customPrompt } : {}),
      ...(options?.generateMeaning !== undefined ? { generate_meaning: options.generateMeaning } : {}),
      ...(options?.deckIds && options.deckIds.length ? { deck_ids: options.deckIds } : {}),
    },
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

export interface ItemsPageOptions {
  tagId?: string
  query?: string
  sort?: string
  direction?: string
  status?: string
}

export async function getItemsPage(page: number, per: number, opts: ItemsPageOptions = {}): Promise<ItemsPage> {
  const params: Record<string, string | number> = { page, per }
  if (opts.tagId) params.tag_id = opts.tagId
  if (opts.query && opts.query.trim()) params.q = opts.query.trim()
  if (opts.sort) params.sort = opts.sort
  if (opts.direction) params.direction = opts.direction
  if (opts.status) params.status = opts.status
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

// AI による意味・説明の生成（同期）。生成済みの場合は再生成。
export async function generateMeaning(id: string): Promise<Item> {
  const res = await apiClient.post<Item>(`/api/v1/items/${id}/meaning`)
  return res.data
}

// AI による分類タグの生成（同期）。既存タグは消さず union で追加する。
export async function generateTags(id: string): Promise<Item> {
  const res = await apiClient.post<Item>(`/api/v1/items/${id}/tags`)
  return res.data
}
