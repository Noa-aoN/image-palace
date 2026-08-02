import { apiClient } from './client'
import type { Box, BoxDetail, BoxEntryType } from '@/types/box'
import type { CoverType } from '@/types/cover'

export async function getBoxes(limit?: number): Promise<Box[]> {
  const res = await apiClient.get<{ boxes: Box[] }>('/api/v1/boxes', {
    params: limit ? { limit } : undefined,
  })
  return res.data.boxes
}

/**
 * ボックスの中身を取得する。
 *
 * 中身は際限なく増えるので全件は返らない。続きは next_cursor をそのまま渡す。
 * 位置の指定に offset を使わないのは、深いページほど DB 側が遅くなるため。
 */
export async function getBox(id: string, cursor?: string | null): Promise<BoxDetail> {
  const res = await apiClient.get<BoxDetail>(`/api/v1/boxes/${id}`, {
    params: cursor ? { cursor } : undefined,
  })
  return res.data
}

export async function createBox(name: string, description?: string): Promise<Box> {
  const res = await apiClient.post<Box>('/api/v1/boxes', {
    box: { name, description },
  })
  return res.data
}

export async function updateBox(
  id: string,
  payload: { name?: string; description?: string; cover_item_id?: string | null; cover_type?: CoverType }
): Promise<Box> {
  const res = await apiClient.patch<Box>(`/api/v1/boxes/${id}`, { box: payload })
  return res.data
}

// カバー画像のアップロード（cover_type は custom に切替）
export async function uploadBoxCover(id: string, file: File): Promise<Box> {
  const form = new FormData()
  form.append('cover_image', file)
  const res = await apiClient.post<Box>(`/api/v1/boxes/${id}/cover_image`, form)
  return res.data
}

// カバー画像の削除（cover_type は first_card に戻る）
export async function removeBoxCover(id: string): Promise<Box> {
  const res = await apiClient.delete<Box>(`/api/v1/boxes/${id}/cover_image`)
  return res.data
}

export async function deleteBox(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/boxes/${id}`)
}

export async function addEntryToBox(
  boxId: string,
  entryType: BoxEntryType,
  entryId: string
): Promise<void> {
  await apiClient.post(`/api/v1/boxes/${boxId}/entries`, {
    entry_type: entryType,
    entry_id: entryId,
  })
}

export async function removeEntryFromBox(
  boxId: string,
  entryType: BoxEntryType,
  entryId: string
): Promise<void> {
  await apiClient.delete(`/api/v1/boxes/${boxId}/entries/${entryType}/${entryId}`)
}
