import { create } from 'zustand'
import type { Item } from '@/types/item'
import type { BoardShape, ViewEdge, ViewEdgeStyle } from '@/types/view'

// 右パネル（統一インスペクタ）の表示モード。
// closed=非表示 / card=カード詳細 / board-cards=配置カード一覧 / add-cards=カード追加
// board-objects=オブジェクト（接続線・図形）一覧 / edge=接続線編集
// shape=図形編集（塗り・枠・文字） / board-settings=ボード設定 / bulk=複数選択の一括
//
// section= 汎用スロット。ページ側が自分の UI をパネルへ差し込む（ボード以外のページはこれを使う）。
// ボード固有のモードは、いずれ section へ寄せて畳む想定。
export type RightPanelMode =
  | 'closed'
  | 'card'
  | 'board-cards'
  | 'add-cards'
  | 'board-objects'
  | 'edge'
  | 'shape'
  | 'board-settings'
  | 'bulk'
  | 'section'

/** 汎用スロットで開いている内容。key はページ側が中身を出し分けるための識別子 */
/**
 * 汎用スロットで開いている内容。
 * href を渡すと、パネルの見出し横に対応するページへのリンクが出る
 * （パネルの中で完結しない作業へ移りたいときの逃げ道）。
 */
export type PanelSection = {
  key: string
  title?: string
  href?: string
  /**
   * 開くときに渡す初期値。URL のクエリが使えないパネルで、
   * 「このワードリストで作る」のような文脈を持ち込むために使う。
   */
  params?: Record<string, string>
}

interface RightPanelState {
  mode: RightPanelMode
  itemId: string | null // card モードで表示するカード
  viewId: string | null // ボード文脈（一覧/追加/ボード由来のカード詳細/接続線）
  edge: ViewEdge | null // edge モードで編集する接続線のスナップショット
  shape: BoardShape | null // shape モードで編集する図形のスナップショット
  // bulk モードの選択集合
  bulkItemIds: string[]
  bulkEdgeIds: string[]
  section: PanelSection | null
  // ボード↔パネルの疎結合シグナル（ボード側が検知して消費する）
  focusItemId: string | null // カード一覧クリック → ボードが該当カードへパン
  focusEdgeId: string | null // オブジェクト一覧クリック → ボードが該当接続線へパン
  pendingAddItem: Item | null // 追加パネルのクリック → ボードが中央に配置
  edgePatch: { id: string; changes: Partial<ViewEdge> } | null // edge 編集 → ボードが線を更新
  edgeRemoveId: string | null // edge 削除 → ボードが線を除去
  bulkStylePatch: { edgeIds: string[]; partial: Partial<ViewEdgeStyle> } | null // 接続線スタイル一括
  bulkResize: { itemIds: string[]; width: number; height: number } | null // カードサイズ揃え
  bulkRemove: { itemIds: string[]; edgeIds: string[] } | null // まとめて削除
  layerPatch: { id: string; z: number }[] | null // 一覧の並べ替え → ボードが重なり順を再適用

  openCard: (itemId: string, viewId?: string | null) => void
  openBoardCards: (viewId: string) => void
  openAddCards: (viewId: string) => void
  openBoardObjects: (viewId: string) => void
  openBoardSettings: (viewId: string) => void
  openEdge: (viewId: string, edge: ViewEdge) => void
  /** 図形の編集を開く。塗り・枠・文字をその場で直す */
  openShape: (viewId: string, shape: BoardShape) => void
  /** 図形の見た目を盤へ反映する合図。ボード側が拾って消す */
  shapePatch: BoardShape | null
  requestShapePatch: (shape: BoardShape) => void
  consumeShapePatch: () => void
  /** 図形を消す合図 */
  shapeRemoveId: string | null
  requestShapeRemove: (id: string) => void
  consumeShapeRemove: () => void
  /**
   * 重なり順を盤へ反映する合図。手前から順に並んだ一覧を渡す。
   *
   * **これが無かった頃は、一覧で並べ替えてもサーバーに書くだけで、
   * 開いている盤は再読込するまで変わらなかった**（効いていないように見えた）
   */
  layerOrder: { kind: 'shape' | 'edge'; id: string }[] | null
  requestLayerOrder: (order: { kind: 'shape' | 'edge'; id: string }[]) => void
  consumeLayerOrder: () => void
  openBulk: (viewId: string, itemIds: string[], edgeIds: string[]) => void
  /** 汎用スロットを開く。中身はページ側が差し込む */
  openSection: (section: PanelSection) => void
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
  requestBulkStylePatch: (edgeIds: string[], partial: Partial<ViewEdgeStyle>) => void
  consumeBulkStylePatch: () => void
  requestBulkResize: (itemIds: string[], width: number, height: number) => void
  consumeBulkResize: () => void
  requestBulkRemove: (itemIds: string[], edgeIds: string[]) => void
  consumeBulkRemove: () => void
  requestLayerPatch: (updates: { id: string; z: number }[]) => void
  consumeLayerPatch: () => void
}

export const useRightPanelStore = create<RightPanelState>()((set) => ({
  mode: 'closed',
  itemId: null,
  viewId: null,
  edge: null,
  shape: null,
  bulkItemIds: [],
  bulkEdgeIds: [],
  section: null,
  focusItemId: null,
  focusEdgeId: null,
  pendingAddItem: null,
  edgePatch: null,
  edgeRemoveId: null,
  bulkStylePatch: null,
  bulkResize: null,
  bulkRemove: null,
  layerPatch: null,

  // viewId 省略時は既存のボード文脈を保持する（ボードから開いたカード詳細で往復できるように）
  openCard: (itemId, viewId) => set((s) => ({ mode: 'card', itemId, viewId: viewId ?? s.viewId })),
  openBoardCards: (viewId) => set({ mode: 'board-cards', viewId }),
  openAddCards: (viewId) => set({ mode: 'add-cards', viewId }),
  openBoardObjects: (viewId) => set({ mode: 'board-objects', viewId }),
  openBoardSettings: (viewId) => set({ mode: 'board-settings', viewId }),
  openEdge: (viewId, edge) => set({ mode: 'edge', viewId, edge }),
  openShape: (viewId, shape) => set({ mode: 'shape', viewId, shape }),
  shapePatch: null,
  requestShapePatch: (shape) => set({ shapePatch: shape }),
  consumeShapePatch: () => set({ shapePatch: null }),
  shapeRemoveId: null,
  requestShapeRemove: (id) => set({ shapeRemoveId: id }),
  consumeShapeRemove: () => set({ shapeRemoveId: null }),
  layerOrder: null,
  requestLayerOrder: (order) => set({ layerOrder: order }),
  consumeLayerOrder: () => set({ layerOrder: null }),
  openBulk: (viewId, itemIds, edgeIds) => set({ mode: 'bulk', viewId, bulkItemIds: itemIds, bulkEdgeIds: edgeIds }),
  openSection: (section) => set({ mode: 'section', section }),
  close: () =>
    set({
      mode: 'closed',
      itemId: null,
      edge: null,
  shape: null,
      bulkItemIds: [],
      bulkEdgeIds: [],
      section: null,
      focusItemId: null,
      focusEdgeId: null,
      pendingAddItem: null,
    }),

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
  requestBulkStylePatch: (edgeIds, partial) => set({ bulkStylePatch: { edgeIds, partial } }),
  consumeBulkStylePatch: () => set({ bulkStylePatch: null }),
  requestBulkResize: (itemIds, width, height) => set({ bulkResize: { itemIds, width, height } }),
  consumeBulkResize: () => set({ bulkResize: null }),
  requestBulkRemove: (itemIds, edgeIds) => set({ bulkRemove: { itemIds, edgeIds } }),
  consumeBulkRemove: () => set({ bulkRemove: null }),
  requestLayerPatch: (updates) => set({ layerPatch: updates }),
  consumeLayerPatch: () => set({ layerPatch: null }),
}))
