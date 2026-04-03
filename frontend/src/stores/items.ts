import { create } from 'zustand'
import type { Item } from '@/types/item'

interface ItemsState {
  items: Item[]
  setItems: (items: Item[]) => void
}

export const useItemsStore = create<ItemsState>()((set) => ({
  items: [],
  setItems: (items) => set({ items }),
}))
