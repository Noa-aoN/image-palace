import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// スタディの学習履歴（プラクティス・クイズ・プレイの結果）。ブラウザに保存する簡易レコード。
export type StudyMode = 'practice' | 'quiz' | 'game'
export type StudyGameKind = 'streak' | 'memory' | 'karuta' | 'duel'

export type StudyRecord = {
  id: string
  date: string // ISO
  mode: StudyMode
  game?: StudyGameKind // mode==='game' のときの種別
  targetLabel: string
  format?: string
  // total/correct の意味は mode で異なる：
  // practice=見返した枚数 / quiz=出題数・正答数 / game streak=連続正解 / memory=ペア数 / karuta=枚数
  total: number
  correct: number
  // ゲームのハイスコア用の指標（streak=連続正解(大きいほど良い) / memory=手数 / karuta=お手つき(小さいほど良い)）
  score?: number
}

type State = {
  records: StudyRecord[]
  /**
   * localStorage からの復元が終わったか。
   * 復元前は records が空配列なので、これを見ないと記録があっても
   * 「まだ記録がありません」を一瞬出してしまう。
   */
  hydrated: boolean
  setHydrated: () => void
  addRecord: (r: Omit<StudyRecord, 'id' | 'date'>) => void
  clear: () => void
}

const LIMIT = 100

export const useStudyRecordStore = create<State>()(
  persist(
    (set) => ({
      records: [],
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      addRecord: (r) =>
        set((s) => {
          const rec: StudyRecord = {
            ...r,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            date: new Date().toISOString(),
          }
          return { records: [rec, ...s.records].slice(0, LIMIT) }
        }),
      clear: () => set({ records: [] }),
    }),
    {
      name: 'ip-study-records',
      // 保存するのは記録だけ。復元済みかどうかは毎回の起動で決まる
      partialize: (s) => ({ records: s.records }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    }
  )
)
