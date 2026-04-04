import { create } from 'zustand'
import type { Item } from '@/types/item'

interface ItemsState {
  items: Item[]
  setItems: (items: Item[]) => void
  upsertItem: (item: Item) => void
  removeItem: (id: string) => void
  resetItems: () => void
}

export const useItemsStore = create<ItemsState>()((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  upsertItem: (item) =>
    set((state) => {
      const existingIndex = state.items.findIndex((current) => current.id === item.id)
      if (existingIndex === -1) {
        return { items: [item, ...state.items] }
      }

      const nextItems = [...state.items]
      nextItems[existingIndex] = item
      return { items: nextItems }
    }),
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  resetItems: () => set({ items: [] }),
}))
