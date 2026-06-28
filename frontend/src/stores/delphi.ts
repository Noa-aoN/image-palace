import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface OracleRecord {
  id: string
  words: string[]
  style: string
  // 受け取った（カード化した）か、キャンセルしたか。
  status: 'received' | 'cancelled'
  // 受け取り時に作成したカードの id（status==='received' のとき）。
  cardIds: string[]
  createdAt: number
}

interface DelphiStore {
  history: OracleRecord[]
  addRecord: (record: OracleRecord) => void
  clearHistory: () => void
}

const HISTORY_LIMIT = 50

// デルフォイ（神託）の履歴。localStorage に永続化する（端末ごと）。
export const useDelphiStore = create<DelphiStore>()(
  persist(
    (set) => ({
      history: [],
      addRecord: (record) =>
        set((state) => ({ history: [record, ...state.history].slice(0, HISTORY_LIMIT) })),
      clearHistory: () => set({ history: [] }),
    }),
    { name: 'ip-delphi' }
  )
)
