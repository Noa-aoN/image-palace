'use client'

import { create } from 'zustand'
import { getSettings, updateSettings } from '@/lib/api/settings'
import type { UserSettings } from '@/types/settings'

interface SettingsState {
  settings: UserSettings | null
  fetchSettings: () => Promise<void>
  // 楽観更新して PATCH する。失敗したら元に戻す（設定ページと同じ流儀）。
  patchSettings: (payload: Partial<UserSettings>) => Promise<void>
}

// アカウントの設定（図の 2D/3D、アニメーション、生成オプションなど）の共有ストア。
// 図のコンポーネントからも参照するため、設定ページ専用の state ではなくここに置く。
// 取得失敗は握りつぶす（既定値で描画する）。
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,

  fetchSettings: async () => {
    try {
      set({ settings: await getSettings() })
    } catch {
      // 取得失敗は無視（既定値で描画する）
    }
  },

  patchSettings: async (payload) => {
    const previous = get().settings
    if (previous) set({ settings: { ...previous, ...payload } })
    try {
      set({ settings: await updateSettings(payload) })
    } catch (e) {
      if (previous) set({ settings: previous })
      throw e
    }
  },
}))
