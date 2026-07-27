import { apiClient } from './client'
import type { TagGroup } from '@/types/tag'

export async function getTagGroups(): Promise<TagGroup[]> {
  const res = await apiClient.get<{ tag_groups: TagGroup[] }>('/api/v1/tag_groups')
  return res.data.tag_groups
}

export async function createTagGroup(name: string): Promise<TagGroup> {
  const res = await apiClient.post<TagGroup>('/api/v1/tag_groups', { tag_group: { name } })
  return res.data
}

export async function updateTagGroup(id: string, patch: { name?: string; pinned?: boolean }): Promise<TagGroup> {
  const res = await apiClient.patch<TagGroup>(`/api/v1/tag_groups/${id}`, { tag_group: patch })
  return res.data
}

// deleteTags=true でグループ内のタグ実体ごと削除する（false はグループのみ削除しタグは残す）
export async function deleteTagGroup(id: string, deleteTags = false): Promise<void> {
  await apiClient.delete(`/api/v1/tag_groups/${id}`, {
    params: deleteTags ? { delete_tags: true } : undefined,
  })
}

// グループ全体の並び替え（ids を先頭から position 1.. に振り直す）
export async function reorderTagGroups(ids: string[]): Promise<void> {
  await apiClient.patch('/api/v1/tag_groups/reorder', { ids })
}

export async function addTagToGroup(groupId: string, tagId: string): Promise<TagGroup> {
  const res = await apiClient.post<TagGroup>(`/api/v1/tag_groups/${groupId}/items`, { tag_id: tagId })
  return res.data
}

export async function removeTagFromGroup(groupId: string, tagId: string): Promise<TagGroup> {
  const res = await apiClient.delete<TagGroup>(`/api/v1/tag_groups/${groupId}/items/${tagId}`)
  return res.data
}

// グループ内タグの並び替え
export async function reorderGroupItems(groupId: string, tagIds: string[]): Promise<TagGroup> {
  const res = await apiClient.patch<TagGroup>(`/api/v1/tag_groups/${groupId}/items/reorder`, { tag_ids: tagIds })
  return res.data
}
