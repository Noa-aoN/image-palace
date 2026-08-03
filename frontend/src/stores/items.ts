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

const upsertInto = (list: Item[], item: Item) => {
  const index = list.findIndex((current) => current.id === item.id)
  if (index === -1) return [item, ...list]

  const next = [...list]
  next[index] = item
  return next
}

export const useItemsStore = create<ItemsState>()((set) => ({
  items: [],
  recent: [],
  setItems: (items) => set({ items }),
  setRecent: (recent) => set({ recent }),
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
