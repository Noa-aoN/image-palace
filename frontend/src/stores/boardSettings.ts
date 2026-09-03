import { create } from 'zustand'
import type { BoardSettings } from '@/types/view'

// ボード全体の設定を、ボード⇔右パネルで共有する。
// edges と違い RF 状態に持たないため、共有 store が自然。views.settings で永続化。
interface BoardSettingsState {
  viewId: string | null
  settings: BoardSettings
  backgroundImageUrl: string | null
  init: (viewId: string, settings: BoardSettings | undefined, backgroundImageUrl: string | null) => void
  setSettings: (partial: Partial<BoardSettings>) => void
  setBackgroundImageUrl: (url: string | null) => void
}

export const useBoardSettingsStore = create<BoardSettingsState>()((set) => ({
  viewId: null,
  settings: {},
  backgroundImageUrl: null,
  init: (viewId, settings, backgroundImageUrl) => set({ viewId, settings: settings ?? {}, backgroundImageUrl }),
  setSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
  setBackgroundImageUrl: (url) => set({ backgroundImageUrl: url }),
}))
