import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiStore {
  sidebarExpanded: boolean
  toggleSidebar: () => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      sidebarExpanded: true,
      toggleSidebar: () => set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
    }),
    { name: 'ip-ui' }
  )
)
