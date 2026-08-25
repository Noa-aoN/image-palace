import { create } from 'zustand'
import type { Item } from '@/types/item'

/**
 * カードの共有状態。
 *
 * 一覧（/items）と、ライブラリの棚に出す先頭ぶんは取得の仕方が違う。
 * 一覧はページングしながら伸びていき、棚は先頭の数件しか持たない。
 * ひとつの配列を共有すると互いに上書きし合うため、別々に持つ。
 *
 * 一方で「カードが増えた・消えた」はどちらにも効かせたい。
 * 作成・削除をここへ通せば、どの画面から行っても全ての表示が揃う。
 */
interface ItemsState {
  /** 一覧（/items）。ページングで伸びる */
  items: Item[]
  /** ライブラリの棚に出す先頭ぶん */
  recent: Item[]
  setItems: (items: Item[]) => void
  setRecent: (items: Item[]) => void
  /** 作成・更新。一覧と棚の両方へ反映する */
  upsertItem: (item: Item) => void
  /** 削除。一覧と棚の両方から取り除く */
  removeItem: (id: string) => void
  removeItems: (ids: Set<string> | string[]) => void
  resetItems: () => void
}

/**
 * 同じカードの新しい姿を、いま持っているものへ**重ねる**。
 *
 * **差し替えない。** 一覧が返すのは要約（id・見出し語・状態・絵だけ）で、
 * 項目も意味も並び順も入っていない。差し替えると、詳細を開いたまま一覧が
 * 更新されただけで**項目が消え、並びが既定へ戻り、地の色まで変わる**。
 *
 * 重ねる形なら、要約に無い鍵は前の値が残る。
 * 消したいときは、消した側が鍵ごと（`properties: []` のように）返してくる。
 */
const mergeItem = (previous: Item | undefined, next: Item): Item =>
  previous ? { ...previous, ...next } : next

const upsertInto = (list: Item[], item: Item) => {
  const index = list.findIndex((current) => current.id === item.id)
  if (index === -1) return [item, ...list]

  const next = [...list]
  next[index] = mergeItem(list[index], item)
  return next
}

/**
 * 並び・顔ぶれは新しいほうで決め、**中身は重ねる**。
 *
 * 一覧の読み直しで詳細の情報が落ちないようにする（上と同じ理由）。
 */
const replaceKeepingDetail = (list: Item[], incoming: Item[]): Item[] => {
  const known = new Map(list.map((item) => [item.id, item]))
  return incoming.map((item) => mergeItem(known.get(item.id), item))
}

export const useItemsStore = create<ItemsState>()((set) => ({
  items: [],
  recent: [],
  setItems: (items) => set((state) => ({ items: replaceKeepingDetail(state.items, items) })),
  setRecent: (recent) => set((state) => ({ recent: replaceKeepingDetail(state.recent, recent) })),
  upsertItem: (item) =>
    set((state) => ({
      items: upsertInto(state.items, item),
      recent: upsertInto(state.recent, item),
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      recent: state.recent.filter((item) => item.id !== id),
    })),
  removeItems: (ids) => {
    const targets = ids instanceof Set ? ids : new Set(ids)
    return set((state) => ({
      items: state.items.filter((item) => !targets.has(item.id)),
      recent: state.recent.filter((item) => !targets.has(item.id)),
    }))
  },
  resetItems: () => set({ items: [], recent: [] }),
}))
