import { apiClient } from './client'
import type { Space, SpaceDetail, SpacePoint } from '@/types/space'
import type { CoverType } from '@/types/cover'

export async function getSpaces(): Promise<Space[]> {
  const res = await apiClient.get<{ spaces: Space[] }>('/api/v1/spaces')
  return res.data.spaces
}

export async function getSpace(id: string): Promise<SpaceDetail> {
  const res = await apiClient.get<SpaceDetail>(`/api/v1/spaces/${id}`)
  return res.data
}

export async function createSpace(
  name: string,
  spaceType: string = 'room',
  description?: string
): Promise<Space> {
  const res = await apiClient.post<Space>('/api/v1/spaces', {
    space: { name, space_type: spaceType, description },
  })
  return res.data
}

export async function updateSpace(
  id: string,
  payload: { name?: string; description?: string; cover_space_point_id?: string | null; cover_type?: CoverType }
): Promise<Space> {
  const res = await apiClient.patch<Space>(`/api/v1/spaces/${id}`, { space: payload })
  return res.data
}

export async function uploadSpaceCover(id: string, file: File): Promise<Space> {
  const form = new FormData()
  form.append('cover_image', file)
  const res = await apiClient.post<Space>(`/api/v1/spaces/${id}/cover_image`, form)
  return res.data
}

export async function removeSpaceCover(id: string): Promise<Space> {
  const res = await apiClient.delete<Space>(`/api/v1/spaces/${id}/cover_image`)
  return res.data
}

export async function deleteSpace(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/spaces/${id}`)
}

// room 種別: ボックスの配置
export async function addBoxToSpace(spaceId: string, boxId: string): Promise<void> {
  await apiClient.post(`/api/v1/spaces/${spaceId}/boxes`, { box_id: boxId })
}

export async function removeBoxFromSpace(spaceId: string, boxId: string): Promise<void> {
  await apiClient.delete(`/api/v1/spaces/${spaceId}/boxes/${boxId}`)
}

// road 種別: 序数ポイント
export async function addSpacePoint(spaceId: string): Promise<SpacePoint> {
  const res = await apiClient.post<SpacePoint>(`/api/v1/spaces/${spaceId}/points`, {})
  return res.data
}

export async function updateSpacePoint(
  spaceId: string,
  pointId: string,
  // generate:false=名前だけ保存（生成しない）、true=必ず生成。省略時は名前変更で生成。
  payload: { item_id?: string | null; position?: number; name?: string; x?: number; y?: number; generate?: boolean }
): Promise<SpacePoint> {
  const res = await apiClient.patch<SpacePoint>(`/api/v1/spaces/${spaceId}/points/${pointId}`, payload)
  return res.data
}

export async function removeSpacePoint(spaceId: string, pointId: string): Promise<void> {
  await apiClient.delete(`/api/v1/spaces/${spaceId}/points/${pointId}`)
}

export async function reorderSpacePoints(spaceId: string, orderedIds: string[]): Promise<void> {
  await apiClient.patch(`/api/v1/spaces/${spaceId}/points/reorder`, { ordered_ids: orderedIds })
}
