import { apiClient } from './client'
import type { View, ViewDetail, ViewItemPlacement, SpaceMapPoint } from '@/types/view'
import type { CoverType } from '@/types/cover'

export async function getViews(): Promise<View[]> {
  const res = await apiClient.get<{ views: View[] }>('/api/v1/views')
  return res.data.views
}

export async function getView(id: string): Promise<View> {
  const res = await apiClient.get<View>(`/api/v1/views/${id}`)
  return res.data
}

// ビュー詳細（配置されたカード一覧を含む）
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

// 配置（座標・重なり順）を更新する
export async function updateViewItemPosition(
  viewId: string,
  itemId: string,
  payload: { x?: number; y?: number; z_index?: number }
): Promise<void> {
  await apiClient.patch(`/api/v1/views/${viewId}/items/${itemId}`, payload)
}

// フリーボードからカードを外す
export async function removeViewItem(viewId: string, itemId: string): Promise<void> {
  await apiClient.delete(`/api/v1/views/${viewId}/items/${itemId}`)
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
  payload: { name?: string; cover_item_id?: string | null; cover_type?: CoverType }
): Promise<View> {
  const res = await apiClient.patch<View>(`/api/v1/views/${id}`, { view: payload })
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
