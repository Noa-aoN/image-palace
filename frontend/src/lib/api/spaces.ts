import { apiClient } from './client'
import type { Space, SpaceDetail, SpacePoint, RoomSurface, RoomStyleOverrides } from '@/types/space'
import type { CoverType } from '@/types/cover'

export async function getSpaces(limit?: number): Promise<Space[]> {
  const res = await apiClient.get<{ spaces: Space[] }>('/api/v1/spaces', {
    params: limit ? { limit } : undefined,
  })
  return res.data.spaces
}

// 名前で絞りつつ、少しずつ読む（選ぶための一覧に使う）
export async function getSpacesPage(params: {
  q?: string
  limit?: number
  cursor?: string | null
}): Promise<{ spaces: Space[]; next_cursor: string | null }> {
  const res = await apiClient.get<{ spaces: Space[]; next_cursor: string | null }>('/api/v1/spaces', {
    params: {
      ...(params.q ? { q: params.q } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
      ...(params.cursor ? { cursor: params.cursor } : {}),
    },
  })
  return res.data
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
  payload: {
    name?: string
    description?: string
    cover_space_point_id?: string | null
    cover_type?: CoverType
    width?: number
    depth?: number
    height?: number
    point_scale?: number
    room_style?: string
    style_overrides?: RoomStyleOverrides
  }
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
  // surface/u/v = 多面ルームの面と面内正規化座標（0..1）。x/y は旧・間取り座標（当面併存）。
  payload: {
    item_id?: string | null
    position?: number
    name?: string
    x?: number
    y?: number
    surface?: RoomSurface
    u?: number
    v?: number
    scale?: number
    rotation_x?: number
    rotation_y?: number
    rotation_z?: number
    generate?: boolean
  }
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

// カバー画像を AI で作る（非同期・1クレジット）。cover_generation_status を見て完了を待つ
export async function generateSpaceCover(id: string, prompt: string, style?: string): Promise<Space> {
  const res = await apiClient.post<Space>(`/api/v1/spaces/${id}/cover_image/generate`, {
    cover: { prompt, ...(style ? { style } : {}) },
  })
  return res.data
}
