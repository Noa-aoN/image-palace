import { apiClient } from './client'
import type { Item, ItemMeaning, ItemType } from '@/types/item'

export interface ItemsSummary {
  total_count: number
  pending_count: number
  processing_count: number
  failed_count: number
  boxes_count: number
  views_count: number
  spaces_count: number
  /** 当月の生成実績（上限ではない）。カードと名前付きスペースポイントの合算 */
  monthly_count: number
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
  /** 項目（読み仮名・別名など）を自動で埋めるか */
  generateProperties?: boolean
  /** 埋める項目の識別名。渡したぶんだけを1回でまとめて埋める */
  generatePropertyKeys?: string[]
  /** 画像への指示の作り方（word / brief / research）。未指定は brief */
  promptSource?: string
  /** 画像の縦横比（未指定ならユーザー設定の既定を使う） */
  aspectRatio?: string
  /** 絵を作るモデル（未指定はおまかせ＝そのときの既定） */
  imageModel?: string
  /** 種別（単語・人物・出来事…）を AI に決めさせるか（未指定ならユーザー設定に従う） */
  detectItemType?: boolean
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
      ...(options?.generateProperties !== undefined
        ? { generate_properties: options.generateProperties }
        : {}),
      ...(options?.generatePropertyKeys?.length
        ? { generate_property_keys: options.generatePropertyKeys }
        : {}),
      ...(options?.promptSource ? { prompt_source: options.promptSource } : {}),
      ...(options?.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
      ...(options?.imageModel ? { image_model: options.imageModel } : {}),
      ...(options?.detectItemType !== undefined ? { detect_item_type: options.detectItemType } : {}),
    },
  })
  return res.data
}

export interface PaginationMeta {
  page: number
  per: number
  total_count: number
  total_pages: number
  /**
   * 一覧の並べ方。カードごとではなく一覧に1回だけ付く（全カードで同じ設定のため）。
   * blocks の順にそのまま積む。'image' は絵、それ以外は list_fields の項目。
   */
  card_list?: { blocks: string[]; image: boolean; type_mark: boolean }
}

export interface ItemsPage {
  items: Item[]
  meta: PaginationMeta
}

export interface ItemsPageOptions {
  tagId?: string
  /** 複数のタグ。指定したものを**すべて**持つカードだけに絞る */
  tagIds?: string[]
  query?: string
  sort?: string
  direction?: string
  status?: string
  /** 種別で絞る（複数可）。空なら絞らない */
  itemTypeIds?: string[]
}

export async function getItemsPage(page: number, per: number, opts: ItemsPageOptions = {}): Promise<ItemsPage> {
  const params: Record<string, string | number | string[]> = { page, per }
  // 複数のタグは「すべてを持つもの」に絞られる（サーバー側で AND）
  if (opts.tagIds?.length) params.tag_ids = opts.tagIds
  else if (opts.tagId) params.tag_id = opts.tagId
  if (opts.query && opts.query.trim()) params.q = opts.query.trim()
  if (opts.sort) params.sort = opts.sort
  if (opts.direction) params.direction = opts.direction
  if (opts.status) params.status = opts.status
  // 種別は複数選べる（「単語 と 概念」を並べて見たい）
  if (opts.itemTypeIds?.length) params.item_type_ids = opts.itemTypeIds
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
  /** 絵を作るモデル（作り直しのついでに変えられる） */
  imageModel?: string
}

// 再生成。failed・completed どちらからも呼べる。任意で指示を渡すとプロンプトに反映される。
/** 絵を作るときに選べるモデル。鍵の入っているものだけ返る */
export interface ImageModelChoice {
  key: string
  label: string
  description: string
  /** 選ばなかったときに使われるもの。**画面側で当てない**（登録簿と環境変数で動く） */
  default?: boolean
}

export async function getImageModels(): Promise<ImageModelChoice[]> {
  const res = await apiClient.get<{ models: ImageModelChoice[] }>('/api/v1/image_models')
  return res.data.models
}

/**
 * 関連カード。つながりに向きは無いので、相手の id だけで足し引きする。
 * どの操作も、そのカードから見た関連カードの一覧を返す。
 */
export async function getItemRelations(id: string): Promise<Item[]> {
  const res = await apiClient.get<{ relations: Item[] }>(`/api/v1/items/${id}/relations`)
  return res.data.relations
}

export async function addItemRelation(id: string, toItemId: string): Promise<Item[]> {
  const res = await apiClient.post<{ relations: Item[] }>(`/api/v1/items/${id}/relations`, {
    to_item_id: toItemId,
  })
  return res.data.relations
}

export async function removeItemRelation(id: string, relatedItemId: string): Promise<Item[]> {
  const res = await apiClient.delete<{ relations: Item[] }>(`/api/v1/items/${id}/relations/${relatedItemId}`)
  return res.data.relations
}

/**
 * 例文を AI で書く。説明はそのままで、例文だけ書き直せる。
 * meaningId を渡すとその1件だけ、渡さなければ例文の無いものすべて。
 */
export async function generateExamples(id: string, meaningId?: string): Promise<Item> {
  const res = await apiClient.post<{ item: Item }>(
    `/api/v1/items/${id}/examples`,
    meaningId ? { meaning_id: meaningId } : {}
  )
  return res.data.item
}

/** セーフガードの承認。覆いを外して普通に見られる状態にする */
export async function approveItemImage(id: string): Promise<Item> {
  const res = await apiClient.post<Item>(`/api/v1/items/${id}/approve_image`)
  return res.data
}

export async function retryItem(id: string, options?: RegenerateOptions): Promise<Item> {
  const payload: Record<string, string | boolean> = {}
  if (options?.customPrompt !== undefined) payload.custom_prompt = options.customPrompt
  if (options?.style !== undefined) payload.style = options.style
  if (options?.framing !== undefined) payload.framing = options.framing
  if (options?.useMeaning !== undefined) payload.use_meaning = options.useMeaning
  if (options?.imageModel !== undefined) payload.image_model = options.imageModel
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
// 意味・説明から指示を書き直す。
// description は書き直しの根拠にした説明文で、画面はこれも一緒に保存する
// （根拠と「プロンプト情報」の表示がずれると、なぜこの絵になったのかを辿れない）
export async function rewriteScenePrompt(
  id: string,
  /** 根拠にする項目。渡さなければ意味・説明を根拠にする */
  propertyKeys?: string[]
): Promise<{ options: SceneOption[]; description: string | null }> {
  const res = await apiClient.post<{ options: SceneOption[]; description: string | null }>(
    `/api/v1/items/${id}/scene_rewrite`,
    propertyKeys?.length ? { property_keys: propertyKeys } : undefined
  )
  return res.data
}

/**
 * このカードに持たせるとよい項目を AI に選ばせる。
 *
 * 選ぶだけで保存はしない。当てるかどうかは画面が決める
 * （押した瞬間に並びが変わると、元に戻せない）。
 * availableKeys に無い識別名は、サーバー側で落とされる。
 */
export async function suggestItemProperties(id: string, availableKeys: string[]): Promise<string[]> {
  const res = await apiClient.post<{ keys: string[] }>(`/api/v1/items/${id}/suggest_properties`, {
    available_keys: availableKeys,
  })
  return res.data.keys
}

// AI による説明（meaning）のファクトチェック（同期）。説明が無いカードはスキップ。
/**
 * 説明が事実として正しいかを AI に確かめさせる。
 *
 * scope='all' にすると、説明だけでなく**書いてある項目もまとめて**見る。
 * 見るものが増えるぶん、時間と AI の利用量は増える。
 */
/**
 * 絵が語と噛み合っているかを見る。
 *
 * 運営が段階を開けるまでは 503 が返る（絵を送るぶん、1回が高いため）。
 */
export async function imageCheckItem(id: string): Promise<ItemOrSkip> {
  const res = await apiClient.post<ItemOrSkip>(`/api/v1/items/${id}/image_check`)
  return res.data
}

export async function factCheckItem(id: string, scope: 'meaning' | 'all' = 'meaning'): Promise<ItemOrSkip> {
  const res = await apiClient.post<ItemOrSkip>(`/api/v1/items/${id}/fact_check`, { scope })
  return res.data
}

// --- 意味・説明（カード1枚に複数） ---------------------------------------
//
// 代表の1件は Item.meaning に残るので、既にそれを読んでいる画面は変わらない。
// 複数を扱う画面だけがこちらを使う。

export interface MeaningPayload {
  definition?: string
  example_sentence?: string | null
  detail_level?: string
  /** 何を書いた文か（意味 / 説明 / 解説 / 翻訳 / 原義） */
  kind?: string
  language_code?: string
}

export async function createMeaning(itemId: string, payload: MeaningPayload): Promise<ItemMeaning> {
  const res = await apiClient.post<ItemMeaning>(`/api/v1/items/${itemId}/meanings`, { meaning: payload })
  return res.data
}

export async function updateMeaning(
  itemId: string,
  meaningId: string,
  payload: MeaningPayload
): Promise<ItemMeaning> {
  const res = await apiClient.patch<ItemMeaning>(`/api/v1/items/${itemId}/meanings/${meaningId}`, {
    meaning: payload,
  })
  return res.data
}

export async function deleteMeaning(itemId: string, meaningId: string): Promise<void> {
  await apiClient.delete(`/api/v1/items/${itemId}/meanings/${meaningId}`)
}

// ファクトチェックの指摘を「読んで判断した」と記録する。判定そのものは消さない
// （何を見て決めたのかが辿れなくなるため）。一覧の警告色だけが引っ込む。
export async function acknowledgeFactCheck(
  itemId: string,
  meaningId: string,
  acknowledged = true
): Promise<ItemMeaning> {
  const res = await apiClient.patch<ItemMeaning>(
    `/api/v1/items/${itemId}/meanings/${meaningId}/acknowledge`,
    { acknowledged }
  )
  return res.data
}

// 並び替えは渡した順に position を振り直す。1件ずつ送ると途中で失敗したとき順序が壊れる
export async function reorderMeanings(itemId: string, ids: string[]): Promise<ItemMeaning[]> {
  const res = await apiClient.patch<{ meanings: ItemMeaning[] }>(
    `/api/v1/items/${itemId}/meanings/reorder`,
    { ids }
  )
  return res.data.meanings
}

/** このカードがどこで使われているか。配置はそれぞれの表が正なので、見るときに引く */
export interface ItemUsages {
  views: { id: string; name: string; view_type: string }[]
  spaces: { id: string; name: string }[]
  boxes: { id: string; name: string }[]
}

export async function getItemUsages(id: string): Promise<ItemUsages> {
  const res = await apiClient.get<ItemUsages>(`/api/v1/items/${id}/usages`)
  return res.data
}

/** カード1枚ごとの見え方。key はブロックの識別子（作り付けは固定名、項目は prop:<id>） */
export interface BlockView {
  hidden: string[]
  order: string[]
  /** そのカードでは持たない項目（− のエリア） */
  omitted: string[]
  /** 札ごとの幅（何列ぶん）。1 は書かない（既定なので、書くと項目の数だけ肥る） */
  spans?: Record<string, number>
  /** 列への振り分けを自動にするか。送らなければ、いまの値が残る */
  auto_flow?: boolean
  /** 自分で決めるときの、列ごとの個数（左から順）。送らなければ、いまの値が残る */
  column_counts?: number[]
}

// 種別の設定（どの項目を持つか）とは効く範囲が違う。これはこの1枚だけ
export async function updateBlockView(id: string, view: BlockView): Promise<Item> {
  const res = await apiClient.patch<Item>(`/api/v1/items/${id}/block_view`, view)
  return res.data
}

/**
 * そのカードで、これまでに使った絵。
 *
 * **絵そのものは増やさない。** 生成した絵は共有の置き場に残っているので、
 * ここは「いつ、どれを使ったか」の記録だけを持つ。
 */
export interface MediaGeneration {
  id: string
  used_at: string
  model?: string | null
  quality?: string | null
  prompt?: string | null
  url: string | null
  /** いま使っている絵か */
  current: boolean
}

export async function getMediaGenerations(itemId: string): Promise<MediaGeneration[]> {
  const res = await apiClient.get<{ generations: MediaGeneration[] }>(
    `/api/v1/items/${itemId}/media_generations`
  )
  return res.data.generations
}

/** 過去の絵に戻す。**生成しない**ので、クレジットは減らない */
export async function applyMediaGeneration(itemId: string, id: string): Promise<void> {
  await apiClient.post(`/api/v1/items/${itemId}/media_generations/${id}/apply`)
}

/** 記録だけ消す。絵そのものは消さない（同じ絵をほかの人が使っている） */
export async function deleteMediaGeneration(itemId: string, id: string): Promise<void> {
  await apiClient.delete(`/api/v1/items/${itemId}/media_generations/${id}`)
}
