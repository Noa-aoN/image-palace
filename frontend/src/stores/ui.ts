import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiStore {
  sidebarExpanded: boolean
  toggleSidebar: () => void
  // サイドバーの開閉グループの折りたたみ状態（key=ラベル, true=折りたたみ）。既定は展開。
  collapsedGroups: Record<string, boolean>
  toggleGroup: (key: string) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      sidebarExpanded: true,
      toggleSidebar: () => set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
      collapsedGroups: {},
      toggleGroup: (key) =>
        set((state) => ({
          collapsedGroups: { ...state.collapsedGroups, [key]: !state.collapsedGroups[key] },
        })),
    }),
    { name: 'ip-ui' }
  )
)
