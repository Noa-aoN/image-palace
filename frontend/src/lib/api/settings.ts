import { apiClient } from './client'
import type { UserSettings } from '@/types/settings'

export async function getSettings(): Promise<UserSettings> {
  const res = await apiClient.get<UserSettings>('/api/v1/settings')
  return res.data
}

export async function updateSettings(
  payload: Partial<
    Pick<
      UserSettings,
      | 'auto_generate_meanings'
      | 'auto_generate_tags'
      | 'default_image_style'
      | 'default_aspect_ratio'
      | 'display_style'
      | 'shelf_orientation'
      | 'onboarded'
      | 'regenerate_with_meaning'
      | 'image_safeguard'
      | 'image_safeguard_strength'
      | 'nav_hints'
      | 'share_generated_images'
      | 'card_detail_columns'
      | 'palace_name'
      | 'card_property_presets'
      | 'card_list_layout'
      | 'default_card_preset'
      | 'diagram_mode'
      | 'motion_mode'
    >
  >
): Promise<UserSettings> {
  const res = await apiClient.patch<UserSettings>('/api/v1/settings', { setting: payload })
  return res.data
}
