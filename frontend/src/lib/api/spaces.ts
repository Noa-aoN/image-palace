import { apiClient } from './client'
import type { Space } from '@/types/space'

export async function getSpaces(): Promise<Space[]> {
  const res = await apiClient.get<{ spaces: Space[] }>('/api/v1/spaces')
  return res.data.spaces
}

export async function getSpace(id: string): Promise<Space> {
  const res = await apiClient.get<Space>(`/api/v1/spaces/${id}`)
  return res.data
}

export async function createSpace(name: string, description?: string): Promise<Space> {
  const res = await apiClient.post<Space>('/api/v1/spaces', { space: { name, description } })
  return res.data
}

export async function updateSpace(
  id: string,
  payload: { name?: string; description?: string }
): Promise<Space> {
  const res = await apiClient.patch<Space>(`/api/v1/spaces/${id}`, { space: payload })
  return res.data
}

export async function deleteSpace(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/spaces/${id}`)
}
