import { apiClient } from './client'
import type { Item, ItemType } from '@/types/item'

export interface ItemsSummary {
  total_count: number
  pending_count: number
  processing_count: number
  failed_count: number
  boxes_count: number
  views_count: number
  spaces_count: number
  monthly_count: number
  monthly_limit: number
  monthly_remaining: number
}

export interface CreateItemOptions {
  style?: string
  /** 構図プリセット（'' = おまかせ） */
  framing?: string
  customPrompt?: string
  /** 各カードの意味・説明を AI で自動生成するか（未指定ならユーザー設定に従う） */
  generateMeaning?: boolean
  /** 説明の詳しさレベル（brief / simple / detailed） */
  generateMeaningLevel?: string
  /** 各カードのタグを AI で自動生成するか（未指定ならユーザー設定に従う） */
  generateTags?: boolean
  /** 画像への指示の作り方（word / brief / research）。未指定は brief */
  promptSource?: string
  /** 画像の縦横比（未指定ならユーザー設定の既定を使う） */
  aspectRatio?: string
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
      ...(options?.framing ? { framing: options.framing } : {}),
      ...(options?.customPrompt ? { custom_prompt: options.customPrompt } : {}),
      ...(options?.generateMeaning !== undefined ? { generate_meaning: options.generateMeaning } : {}),
      ...(options?.generateMeaningLevel ? { generate_meaning_level: options.generateMeaningLevel } : {}),
      ...(options?.generateTags !== undefined ? { generate_tags: options.generateTags } : {}),
      ...(options?.promptSource ? { prompt_source: options.promptSource } : {}),
      ...(options?.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
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

const MAX_ITEMS_PAGE_SIZE = 100

export async function getItems(opts: ItemsPageOptions = {}): Promise<Item[]> {
  const first = await getItemsPage(1, MAX_ITEMS_PAGE_SIZE, opts)
  const totalPages = first.meta.total_pages
  if (totalPages <= 1) return first.items

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => getItemsPage(index + 2, MAX_ITEMS_PAGE_SIZE, opts))
  )
  return [first, ...rest].flatMap((page) => page.items)
}

export async function getItemNavigationIds(opts: Pick<ItemsPageOptions, 'sort' | 'direction'> = {}): Promise<string[]> {
  const params: Record<string, string> = {}
  if (opts.sort) params.sort = opts.sort
  if (opts.direction) params.direction = opts.direction
  const res = await apiClient.get<{ ids: string[] }>('/api/v1/items/navigation', { params })
  return res.data.ids
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
  /** ① 画像を作る前の説明文。手で直すと以後の自動生成で上書きされない */
  image_description?: string
  /** ② 画像への指示。空文字を渡すと単語をそのまま使う状態に戻る */
  scene_prompt?: string
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

// 一括削除。自分のカードのみ削除され、実際に削除された ID の配列を返す。
export async function bulkDeleteItems(ids: string[]): Promise<string[]> {
  const res = await apiClient.delete<{ deleted_ids: string[] }>('/api/v1/items/bulk_destroy', {
    data: { ids },
  })
  return res.data.deleted_ids
}

export interface RegenerateOptions {
  /** 入力補足・ニュアンス調整の指示（プロンプトに追記される） */
  customPrompt?: string
  /** スタイルプリセット */
  style?: string
  /** 構図プリセット（'' = おまかせ） */
  framing?: string
  /** カードの意味・説明をプロンプトの補足に加えるか（既定オフ） */
  useMeaning?: boolean
}

// 再生成。failed・completed どちらからも呼べる。任意で指示を渡すとプロンプトに反映される。
export async function retryItem(id: string, options?: RegenerateOptions): Promise<Item> {
  const payload: Record<string, string | boolean> = {}
  if (options?.customPrompt !== undefined) payload.custom_prompt = options.customPrompt
  if (options?.style !== undefined) payload.style = options.style
  if (options?.framing !== undefined) payload.framing = options.framing
  if (options?.useMeaning !== undefined) payload.use_meaning = options.useMeaning
  const res = await apiClient.post<Item>(
    `/api/v1/items/${id}/retry`,
    Object.keys(payload).length ? { item: payload } : undefined
  )
  return res.data
}

// 一括AI操作でカードが対象外（既に設定済み・説明なし等）だった場合のスキップ結果。
export type ItemSkip = { status: 'skipped'; reason: string }
export type ItemOrSkip = Item | ItemSkip

export function isItemSkip(result: ItemOrSkip): result is ItemSkip {
  return (result as ItemSkip).status === 'skipped'
}

// AI による意味・説明の生成（同期）。level で詳しさを選べる。
// onlyIfEmpty=true なら既に説明があるカードはスキップ（未設定の穴埋め用）。
export async function generateMeaning(
  id: string,
  level?: string,
  opts?: { onlyIfEmpty?: boolean }
): Promise<ItemOrSkip> {
  const body: Record<string, unknown> = {}
  if (level) body.level = level
  if (opts?.onlyIfEmpty) body.only_if_empty = true
  const res = await apiClient.post<ItemOrSkip>(`/api/v1/items/${id}/meaning`, body)
  return res.data
}

// AI による分類タグの生成（同期）。
// replace=true で置き換え、false（既定）は既存タグへ union 追加。
// onlyIfEmpty=true なら既にタグがあるカードはスキップ（未設定の穴埋め用）。
export async function generateTags(
  id: string,
  opts?: { replace?: boolean; onlyIfEmpty?: boolean }
): Promise<ItemOrSkip> {
  const body: Record<string, unknown> = {}
  if (opts?.replace) body.replace = true
  if (opts?.onlyIfEmpty) body.only_if_empty = true
  const res = await apiClient.post<ItemOrSkip>(`/api/v1/items/${id}/tags`, body)
  return res.data
}

// 画像の下ごしらえ（説明文・画像への指示）を単語から作り直す（同期）。
// 手で直した内容も、明示的に呼ばれたときだけ作り直す。
export async function regenerateBrief(id: string): Promise<Item> {
  const res = await apiClient.post<Item>(`/api/v1/items/${id}/brief`)
  return res.data
}

// 同じものを保存せずに作るだけ（下書き）。作り直しパネルの「単語から書き直す」用。
// 押した瞬間に、手で書いた指示が消えないようにする。
export async function previewBrief(id: string): Promise<{ image_description: string; scene_prompt: string }> {
  const res = await apiClient.post<{ image_description: string; scene_prompt: string }>(
    `/api/v1/items/${id}/brief`,
    { preview: true }
  )
  return res.data
}

/** 書き直した情景の候補。label は「どの意味・ジャンルか」の見出し（1件のときは無いこともある） */
export interface SceneOption {
  label: string | null
  scene_prompt: string
}

// 意味・説明をもとに情景（画像への指示）を書き直す（同期）。
// 保存はしない。書き直した文だけを返すので、呼び出し側が入力欄に入れて確認させる。
// 絵がまるで変わるほど意味・ジャンルが分かれる語では候補が複数返る（最大3件）。
export async function rewriteScenePrompt(id: string): Promise<SceneOption[]> {
  const res = await apiClient.post<{ options: SceneOption[] }>(`/api/v1/items/${id}/scene_rewrite`)
  return res.data.options
}

// AI による説明（meaning）のファクトチェック（同期）。説明が無いカードはスキップ。
export async function factCheckItem(id: string): Promise<ItemOrSkip> {
  const res = await apiClient.post<ItemOrSkip>(`/api/v1/items/${id}/fact_check`)
  return res.data
}
