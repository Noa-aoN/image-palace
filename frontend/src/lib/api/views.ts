import { apiClient } from './client'
import type { AiEditMode, CardEdge, CardProposalResult, View, ViewDetail, ViewItemPlacement, ViewEdge, SpaceMapPoint, BoardSettings } from '@/types/view'
import type { CoverType } from '@/types/cover'

// freeboard の接続線 API の入力
export type ViewEdgeInput = {
  source_node_id?: string
  target_node_id?: string
  source_handle?: string | null
  target_handle?: string | null
  label?: string | null
  style?: {
    color?: string
    dashed?: boolean
    width?: number
    opacity?: number
    marker_start?: string
    marker_end?: string
    label_color?: string
    label_size?: number
    label_bg?: string
    label_opacity?: number
    label_vertical?: boolean
  }
  points?: { x: number; y: number }[]
}

export async function getViews(limit?: number): Promise<View[]> {
  const res = await apiClient.get<{ views: View[] }>('/api/v1/views', {
    params: limit ? { limit } : undefined,
  })
  return res.data.views
}

// 名前・種別で絞りつつ、少しずつ読む（選ぶための一覧に使う）
export async function getViewsPage(params: {
  q?: string
  type?: string
  limit?: number
  cursor?: string | null
}): Promise<{ views: View[]; next_cursor: string | null }> {
  const res = await apiClient.get<{ views: View[]; next_cursor: string | null }>('/api/v1/views', {
    params: {
      ...(params.q ? { q: params.q } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
      ...(params.cursor ? { cursor: params.cursor } : {}),
    },
  })
  return res.data
}

export async function getView(id: string): Promise<View> {
  const res = await apiClient.get<View>(`/api/v1/views/${id}`)
  return res.data
}

// キャンバス詳細（配置されたカード一覧を含む）
export async function getViewDetail(id: string): Promise<ViewDetail> {
  const res = await apiClient.get<ViewDetail>(`/api/v1/views/${id}`)
  return res.data
}

// フリーボードにカードを配置する
export async function addViewItem(
  viewId: string,
  itemId: string,
  x: number,
  y: number
): Promise<ViewItemPlacement> {
  const res = await apiClient.post<ViewItemPlacement>(`/api/v1/views/${viewId}/items`, {
    item_id: itemId,
    x,
    y,
  })
  return res.data
}

// 配置（座標・重なり順・サイズ）を更新する
export async function updateViewItemPosition(
  viewId: string,
  itemId: string,
  payload: { x?: number; y?: number; z_index?: number; width?: number; height?: number }
): Promise<void> {
  await apiClient.patch(`/api/v1/views/${viewId}/items/${itemId}`, payload)
}

// フリーボードからカードを外す
export async function removeViewItem(viewId: string, itemId: string): Promise<void> {
  await apiClient.delete(`/api/v1/views/${viewId}/items/${itemId}`)
}

// deck: カードを末尾に追加する（position はサーバ側で採番、座標不要）
export async function addDeckCard(viewId: string, itemId: string): Promise<void> {
  await apiClient.post(`/api/v1/views/${viewId}/items`, { item_id: itemId })
}

// deck: カードの並び替え（ordered_item_ids の順に position を振り直す）
export async function reorderDeckCards(viewId: string, orderedItemIds: string[]): Promise<void> {
  await apiClient.patch(`/api/v1/views/${viewId}/reorder`, { ordered_item_ids: orderedItemIds })
}

// freeboard: レイヤー順の並び替え（先頭=手前。サーバが z_index を振り直す）
export async function reorderBoardLayers(viewId: string, frontToBackItemIds: string[]): Promise<void> {
  await apiClient.patch(`/api/v1/views/${viewId}/reorder`, { ordered_item_ids: frontToBackItemIds })
}

// freeboard: 接続線のレイヤー順を並び替える（先頭=手前。サーバが z_index を振り直す）
export async function reorderViewEdges(viewId: string, frontToBackEdgeIds: string[]): Promise<void> {
  await apiClient.patch(`/api/v1/views/${viewId}/edges/reorder`, { ordered_edge_ids: frontToBackEdgeIds })
}

// freeboard: 接続線を作成する
export async function addViewEdge(viewId: string, payload: ViewEdgeInput): Promise<ViewEdge> {
  const res = await apiClient.post<ViewEdge>(`/api/v1/views/${viewId}/edges`, payload)
  return res.data
}

// freeboard: 接続線を更新する（ラベル・スタイル・向き反転）
export async function updateViewEdge(viewId: string, edgeId: string, patch: ViewEdgeInput): Promise<ViewEdge> {
  const res = await apiClient.patch<ViewEdge>(`/api/v1/views/${viewId}/edges/${edgeId}`, patch)
  return res.data
}

// freeboard: 接続線を削除する
export async function removeViewEdge(viewId: string, edgeId: string): Promise<void> {
  await apiClient.delete(`/api/v1/views/${viewId}/edges/${edgeId}`)
}

export async function createView(
  name: string,
  viewType: string = 'freeboard',
  spaceId?: string
): Promise<View> {
  const res = await apiClient.post<View>('/api/v1/views', {
    view: { name, view_type: viewType, space_id: spaceId },
  })
  return res.data
}

// space_map: スペースのポイントにカードを配置する
export async function placeCardOnPoint(
  viewId: string,
  spacePointId: string,
  itemId: string
): Promise<SpaceMapPoint> {
  const res = await apiClient.post<SpaceMapPoint>(
    `/api/v1/views/${viewId}/points/${spacePointId}`,
    { item_id: itemId }
  )
  return res.data
}

// space_map: ポイントの配置を外す
export async function clearPointPlacement(viewId: string, spacePointId: string): Promise<void> {
  await apiClient.delete(`/api/v1/views/${viewId}/points/${spacePointId}`)
}

export async function updateView(
  id: string,
  payload: { name?: string; cover_item_id?: string | null; cover_type?: CoverType; settings?: BoardSettings }
): Promise<View> {
  const res = await apiClient.patch<View>(`/api/v1/views/${id}`, { view: payload })
  return res.data
}

// freeboard: ボード背景画像をアップロード / 削除
export async function uploadBoardBackground(id: string, file: File): Promise<View> {
  const form = new FormData()
  form.append('background_image', file)
  const res = await apiClient.post<View>(`/api/v1/views/${id}/background_image`, form)
  return res.data
}

export async function removeBoardBackground(id: string): Promise<View> {
  const res = await apiClient.delete<View>(`/api/v1/views/${id}/background_image`)
  return res.data
}

export async function uploadViewCover(id: string, file: File): Promise<View> {
  const form = new FormData()
  form.append('cover_image', file)
  const res = await apiClient.post<View>(`/api/v1/views/${id}/cover_image`, form)
  return res.data
}

export async function removeViewCover(id: string): Promise<View> {
  const res = await apiClient.delete<View>(`/api/v1/views/${id}/cover_image`)
  return res.data
}

export async function deleteView(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/views/${id}`)
}

// カバー画像を AI で作る（非同期・1クレジット）。cover_generation_status を見て完了を待つ
export async function generateViewCover(id: string, prompt: string, style?: string): Promise<View> {
  const res = await apiClient.post<View>(`/api/v1/views/${id}/cover_image/generate`, {
    cover: { prompt, ...(style ? { style } : {}) },
  })
  return res.data
}

// ことばの指示でキャンバスを組み立て直す（デッキ / フリーボード）。
// mode=placed_only はいまある札だけ、select は手持ちから探して足す。
export async function aiEditView(id: string, instruction: string, mode: AiEditMode): Promise<ViewDetail> {
  const res = await apiClient.post<ViewDetail>(`/api/v1/views/${id}/ai_edit`, {
    edit: { instruction, mode },
  })
  return res.data
}

// 「カードから作る」の第1段階。案を出すだけで、まだ作らない
// （作ると1枚1クレジット出ていくので、枚数を見てから決められるようにしている）
export async function proposeCards(
  id: string,
  instruction: string,
  count?: number
): Promise<CardProposalResult> {
  const res = await apiClient.post<CardProposalResult>(`/api/v1/views/${id}/card_proposal`, {
    proposal: { instruction, ...(count ? { count } : {}) },
  })
  return res.data
}

// 承認された案だけを実際に作り、キャンバスに載せる
// instruction を渡すと、作ったあと図として配置・線つなぎまで行う
export async function createCardsOnView(
  id: string,
  titles: string[],
  options?: { instruction?: string; reuseIds?: string[]; plan?: string | null; edges?: CardEdge[] }
): Promise<ViewDetail> {
  const res = await apiClient.post<ViewDetail>(`/api/v1/views/${id}/create_cards`, {
    titles,
    ...(options?.reuseIds?.length ? { reuse_ids: options.reuseIds } : {}),
    ...(options?.instruction ? { instruction: options.instruction } : {}),
    ...(options?.plan ? { plan: options.plan } : {}),
    ...(options?.edges?.length ? { edges: options.edges } : {}),
  })
  return res.data
}

// AI調整などの前後を行き来する（戻る／進む）
export async function undoView(id: string): Promise<ViewDetail> {
  const res = await apiClient.post<ViewDetail>(`/api/v1/views/${id}/undo`)
  return res.data
}

export async function redoView(id: string): Promise<ViewDetail> {
  const res = await apiClient.post<ViewDetail>(`/api/v1/views/${id}/redo`)
  return res.data
}
