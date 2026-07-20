import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DiagramMode } from '@/types/settings'

interface UiStore {
  sidebarExpanded: boolean
  toggleSidebar: () => void
  // サイドバーの開閉グループの折りたたみ状態（key=ラベル, true=折りたたみ）。既定は展開。
  collapsedGroups: Record<string, boolean>
  toggleGroup: (key: string) => void
  // カードの生成ステータスバッジを表示するか（既定 true）。完了バッジは別途常に非表示。
  showStatusBadges: boolean
  toggleStatusBadges: () => void
  // 図ごとの 2D/3D の個別指定（key=図の識別子）。未設定ならアカウントの環境設定に従う。
  diagramOverrides: Record<string, DiagramMode>
  setDiagramOverride: (key: string, mode: DiagramMode) => void
  // 右パネルの幅（px）。ユーザーがドラッグで調整でき、記憶する。
  rightPanelWidth: number
  setRightPanelWidth: (width: number) => void
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
      showStatusBadges: true,
      toggleStatusBadges: () => set((state) => ({ showStatusBadges: !state.showStatusBadges })),
      diagramOverrides: {},
      setDiagramOverride: (key, mode) =>
        set((state) => ({ diagramOverrides: { ...state.diagramOverrides, [key]: mode } })),
      rightPanelWidth: 360,
      setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
    }),
    { name: 'ip-ui' }
  )
)
