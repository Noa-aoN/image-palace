import { apiClient } from './client'
import type { View, ViewDetail, ViewItemPlacement } from '@/types/view'

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

export async function createView(name: string): Promise<View> {
  const res = await apiClient.post<View>('/api/v1/views', { view: { name } })
  return res.data
}

export async function updateView(id: string, payload: { name?: string }): Promise<View> {
  const res = await apiClient.patch<View>(`/api/v1/views/${id}`, { view: payload })
  return res.data
}

export async function deleteView(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/views/${id}`)
}
