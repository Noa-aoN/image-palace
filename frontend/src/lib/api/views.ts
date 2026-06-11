import { apiClient } from './client'
import type { View } from '@/types/view'

export async function getViews(): Promise<View[]> {
  const res = await apiClient.get<{ views: View[] }>('/api/v1/views')
  return res.data.views
}

export async function getView(id: string): Promise<View> {
  const res = await apiClient.get<View>(`/api/v1/views/${id}`)
  return res.data
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
