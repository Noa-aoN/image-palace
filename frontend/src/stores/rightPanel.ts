import { create } from 'zustand'
import type { Item } from '@/types/item'
import type { ViewEdge } from '@/types/view'

// 右パネル（統一インスペクタ）の表示モード。
// closed=非表示 / card=カード詳細 / board-cards=配置カード一覧 / add-cards=カード追加
// board-objects=オブジェクト（接続線・図形）一覧 / edge=接続線編集 / board-settings=ボード設定
export type RightPanelMode =
  | 'closed'
  | 'card'
  | 'board-cards'
  | 'add-cards'
  | 'board-objects'
  | 'edge'
  | 'board-settings'

interface RightPanelState {
  mode: RightPanelMode
  itemId: string | null // card モードで表示するカード
  viewId: string | null // ボード文脈（一覧/追加/ボード由来のカード詳細/接続線）
  edge: ViewEdge | null // edge モードで編集する接続線のスナップショット
  // ボード↔パネルの疎結合シグナル（ボード側が検知して消費する）
  focusItemId: string | null // カード一覧クリック → ボードが該当カードへパン
  focusEdgeId: string | null // オブジェクト一覧クリック → ボードが該当接続線へパン
  pendingAddItem: Item | null // 追加パネルのクリック → ボードが中央に配置
  edgePatch: { id: string; changes: Partial<ViewEdge> } | null // edge 編集 → ボードが線を更新
  edgeRemoveId: string | null // edge 削除 → ボードが線を除去

  openCard: (itemId: string, viewId?: string | null) => void
  openBoardCards: (viewId: string) => void
  openAddCards: (viewId: string) => void
  openBoardObjects: (viewId: string) => void
  openBoardSettings: (viewId: string) => void
  openEdge: (viewId: string, edge: ViewEdge) => void
  close: () => void
  requestFocus: (itemId: string) => void
  consumeFocus: () => void
  requestFocusEdge: (edgeId: string) => void
  consumeFocusEdge: () => void
  requestAdd: (item: Item) => void
  consumeAdd: () => void
  requestEdgePatch: (id: string, changes: Partial<ViewEdge>) => void
  consumeEdgePatch: () => void
  requestEdgeRemove: (id: string) => void
  consumeEdgeRemove: () => void
}

export const useRightPanelStore = create<RightPanelState>()((set) => ({
  mode: 'closed',
  itemId: null,
  viewId: null,
  edge: null,
  focusItemId: null,
  focusEdgeId: null,
  pendingAddItem: null,
  edgePatch: null,
  edgeRemoveId: null,

  // viewId 省略時は既存のボード文脈を保持する（ボードから開いたカード詳細で往復できるように）
  openCard: (itemId, viewId) => set((s) => ({ mode: 'card', itemId, viewId: viewId ?? s.viewId })),
  openBoardCards: (viewId) => set({ mode: 'board-cards', viewId }),
  openAddCards: (viewId) => set({ mode: 'add-cards', viewId }),
  openBoardObjects: (viewId) => set({ mode: 'board-objects', viewId }),
  openBoardSettings: (viewId) => set({ mode: 'board-settings', viewId }),
  openEdge: (viewId, edge) => set({ mode: 'edge', viewId, edge }),
  close: () =>
    set({ mode: 'closed', itemId: null, edge: null, focusItemId: null, focusEdgeId: null, pendingAddItem: null }),

  requestFocus: (itemId) => set({ focusItemId: itemId }),
  consumeFocus: () => set({ focusItemId: null }),
  requestFocusEdge: (edgeId) => set({ focusEdgeId: edgeId }),
  consumeFocusEdge: () => set({ focusEdgeId: null }),
  requestAdd: (item) => set({ pendingAddItem: item }),
  consumeAdd: () => set({ pendingAddItem: null }),
  requestEdgePatch: (id, changes) => set({ edgePatch: { id, changes } }),
  consumeEdgePatch: () => set({ edgePatch: null }),
  requestEdgeRemove: (id) => set({ edgeRemoveId: id }),
  consumeEdgeRemove: () => set({ edgeRemoveId: null }),
}))
