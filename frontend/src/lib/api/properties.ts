import { apiClient } from './client'

/**
 * カードが持つ項目の定義と、その値。
 *
 * 記憶したいものは分野で変わる（語学なら読み仮名、解剖なら部位）。
 * 作り付けの欄を足し続ける代わりに、項目そのものを利用者が定義する。
 *
 * 型はここに挙げた6つだけ。分野ごとに型を増やすのではなく、
 * 定義の組み合わせで表す。翻訳は意味・説明、関連カードは relations、
 * 画像は medias が既に持っているので、ここでは扱わない（二重管理を避ける）。
 */
export const PROPERTY_VALUE_TYPES = ['text', 'longtext', 'list', 'number', 'date', 'url'] as const

export type PropertyValueType = (typeof PROPERTY_VALUE_TYPES)[number]

export const PROPERTY_VALUE_TYPE_LABELS: Record<PropertyValueType, string> = {
  text: '短い文',
  longtext: '長い文',
  list: '複数の値',
  number: '数',
  date: '日付',
  url: 'リンク',
}

export interface PropertyDefinition {
  id: string
  item_type_id: string
  key: string
  label: string
  value_type: PropertyValueType
  description?: string | null
  position: number
}

/** カード詳細が返す、その種別の項目一覧（未入力の項目も含む） */
export interface ItemPropertyEntry {
  property_definition_id: string
  key: string
  label: string
  value_type: PropertyValueType
  description?: string | null
  value: string | number | string[] | null
}

export async function getPropertyDefinitions(itemTypeId?: string): Promise<PropertyDefinition[]> {
  const res = await apiClient.get<{ property_definitions: PropertyDefinition[] }>(
    '/api/v1/property_definitions',
    { params: itemTypeId ? { item_type_id: itemTypeId } : undefined }
  )
  return res.data.property_definitions
}

export async function createPropertyDefinition(payload: {
  item_type_id: string
  key: string
  label: string
  value_type: PropertyValueType
  description?: string
}): Promise<PropertyDefinition> {
  const res = await apiClient.post<PropertyDefinition>('/api/v1/property_definitions', {
    property_definition: payload,
  })
  return res.data
}

// key と種別は変えられない（既に入っている値がどの項目のものか辿れなくなるため）
export async function updatePropertyDefinition(
  id: string,
  payload: { label?: string; value_type?: PropertyValueType; description?: string }
): Promise<PropertyDefinition> {
  const res = await apiClient.patch<PropertyDefinition>(`/api/v1/property_definitions/${id}`, {
    property_definition: payload,
  })
  return res.data
}

export async function deletePropertyDefinition(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/property_definitions/${id}`)
}

export async function reorderPropertyDefinitions(ids: string[]): Promise<PropertyDefinition[]> {
  const res = await apiClient.patch<{ property_definitions: PropertyDefinition[] }>(
    '/api/v1/property_definitions/reorder',
    { ids }
  )
  return res.data.property_definitions
}

// 値の出し入れ。空を渡すと、その項目の行ごと消える（未設定に戻る）
export async function setItemProperty(
  itemId: string,
  definitionId: string,
  value: string | string[] | null
): Promise<ItemPropertyEntry> {
  const res = await apiClient.put<ItemPropertyEntry>(
    `/api/v1/items/${itemId}/properties/${definitionId}`,
    { value }
  )
  return res.data
}

/** AI でまとめて埋めた結果。埋まらなかった項目は skipped_keys に載る */
export interface FillPropertiesResult {
  filled_keys: string[]
  skipped_keys: string[]
  item: unknown
}

// 項目ごとではなく1回でまとめて埋める（項目数に費用と待ち時間を比例させない）。
// 既定は空いている項目だけ。手で書いたものは上書きしない。
export async function fillItemProperties(
  itemId: string,
  opts?: { overwrite?: boolean }
): Promise<FillPropertiesResult> {
  const res = await apiClient.post<FillPropertiesResult>(`/api/v1/items/${itemId}/fill_properties`, {
    overwrite: opts?.overwrite ?? false,
  })
  return res.data
}
