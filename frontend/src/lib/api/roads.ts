import { apiClient } from './client'
import type { Road, RoadDetail, RoadPoint } from '@/types/road'

export async function getRoads(spaceId: string): Promise<Road[]> {
  const res = await apiClient.get<{ roads: Road[] }>(`/api/v1/spaces/${spaceId}/roads`)
  return res.data.roads
}

export async function getRoad(spaceId: string, roadId: string): Promise<RoadDetail> {
  const res = await apiClient.get<RoadDetail>(`/api/v1/spaces/${spaceId}/roads/${roadId}`)
  return res.data
}

export async function createRoad(spaceId: string, name: string): Promise<Road> {
  const res = await apiClient.post<Road>(`/api/v1/spaces/${spaceId}/roads`, { road: { name } })
  return res.data
}

export async function updateRoad(
  spaceId: string,
  roadId: string,
  payload: { name?: string; position?: number }
): Promise<Road> {
  const res = await apiClient.patch<Road>(`/api/v1/spaces/${spaceId}/roads/${roadId}`, { road: payload })
  return res.data
}

export async function deleteRoad(spaceId: string, roadId: string): Promise<void> {
  await apiClient.delete(`/api/v1/spaces/${spaceId}/roads/${roadId}`)
}

// 末尾に空ポイントを追加
export async function addRoadPoint(spaceId: string, roadId: string): Promise<RoadPoint> {
  const res = await apiClient.post<RoadPoint>(`/api/v1/spaces/${spaceId}/roads/${roadId}/points`, {})
  return res.data
}

// カードの割当（item_id）/クリア（null）・序数の変更（position）
export async function updateRoadPoint(
  spaceId: string,
  roadId: string,
  pointId: string,
  payload: { item_id?: string | null; position?: number }
): Promise<RoadPoint> {
  const res = await apiClient.patch<RoadPoint>(
    `/api/v1/spaces/${spaceId}/roads/${roadId}/points/${pointId}`,
    payload
  )
  return res.data
}

export async function removeRoadPoint(spaceId: string, roadId: string, pointId: string): Promise<void> {
  await apiClient.delete(`/api/v1/spaces/${spaceId}/roads/${roadId}/points/${pointId}`)
}

// 並び替え（ordered_ids の順に序数を振り直す）
export async function reorderRoadPoints(
  spaceId: string,
  roadId: string,
  orderedIds: string[]
): Promise<void> {
  await apiClient.patch(`/api/v1/spaces/${spaceId}/roads/${roadId}/points/reorder`, {
    ordered_ids: orderedIds,
  })
}
