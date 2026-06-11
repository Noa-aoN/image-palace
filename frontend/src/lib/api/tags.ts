import { apiClient } from './client'
import type { Tag } from '@/types/tag'

export async function getTags(): Promise<Tag[]> {
  const res = await apiClient.get<{ tags: Tag[] }>('/api/v1/tags')
  return res.data.tags
}

export async function updateTag(id: string, name: string): Promise<Tag> {
  const res = await apiClient.patch<Tag>(`/api/v1/tags/${id}`, { tag: { name } })
  return res.data
}

export async function deleteTag(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/tags/${id}`)
}
