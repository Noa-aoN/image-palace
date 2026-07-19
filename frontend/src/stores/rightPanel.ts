import { create } from 'zustand'
import type { Item } from '@/types/item'

// 右パネル（統一インスペクタ）の表示モード。
// closed=非表示 / card=カード詳細 / board-cards=ボードのカード一覧 / add-cards=カード追加
export type RightPanelMode = 'closed' | 'card' | 'board-cards' | 'add-cards'

interface RightPanelState {
  mode: RightPanelMode
  itemId: string | null // card モードで表示するカード
  viewId: string | null // ボード文脈（一覧/追加/ボード由来のカード詳細）
  // ボード↔パネルの疎結合シグナル（ボード側が検知して消費する）
  focusItemId: string | null // 一覧クリック → ボードが該当カードへパン
  pendingAddItem: Item | null // 追加パネルのクリック → ボードが中央に配置

  openCard: (itemId: string, viewId?: string | null) => void
  openBoardCards: (viewId: string) => void
  openAddCards: (viewId: string) => void
  close: () => void
  requestFocus: (itemId: string) => void
  consumeFocus: () => void
  requestAdd: (item: Item) => void
  consumeAdd: () => void
}

export const useRightPanelStore = create<RightPanelState>()((set) => ({
  mode: 'closed',
  itemId: null,
  viewId: null,
  focusItemId: null,
  pendingAddItem: null,

  // viewId 省略時は既存のボード文脈を保持する（ボードから開いたカード詳細で往復できるように）
  openCard: (itemId, viewId) => set((s) => ({ mode: 'card', itemId, viewId: viewId ?? s.viewId })),
  openBoardCards: (viewId) => set({ mode: 'board-cards', viewId }),
  openAddCards: (viewId) => set({ mode: 'add-cards', viewId }),
  close: () => set({ mode: 'closed', itemId: null, focusItemId: null, pendingAddItem: null }),

  requestFocus: (itemId) => set({ focusItemId: itemId }),
  consumeFocus: () => set({ focusItemId: null }),
  requestAdd: (item) => set({ pendingAddItem: item }),
  consumeAdd: () => set({ pendingAddItem: null }),
}))
