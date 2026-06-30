import { apiClient } from './client'
import type { UserSettings } from '@/types/settings'

export async function getSettings(): Promise<UserSettings> {
  const res = await apiClient.get<UserSettings>('/api/v1/settings')
  return res.data
}

export async function updateSettings(
  payload: Partial<
    Pick<UserSettings, 'auto_generate_meanings' | 'auto_generate_tags' | 'default_image_style' | 'regenerate_with_meaning'>
  >
): Promise<UserSettings> {
  const res = await apiClient.patch<UserSettings>('/api/v1/settings', { setting: payload })
  return res.data
}
