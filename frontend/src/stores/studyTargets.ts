import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { targetKey, type QuizTarget } from '@/lib/quiz'

// 最近・お気に入りのスタディ対象。ワンタップで選び直せるよう保存する。
export type SavedTarget = {
  key: string
  kind: QuizTarget['kind']
  id?: string
  name: string
  pinned: boolean
  lastUsed: string // ISO
}

type State = {
  targets: SavedTarget[]
  touch: (target: QuizTarget) => void
  togglePin: (key: string) => void
  remove: (key: string) => void
}

const LIMIT = 20

function toSaved(target: QuizTarget): Omit<SavedTarget, 'pinned' | 'lastUsed'> {
  const key = targetKey(target)
  if (target.kind === 'all') return { key, kind: 'all', name: 'すべてのカード' }
  return { key, kind: target.kind, id: target.id, name: target.name }
}

export const useStudyTargetStore = create<State>()(
  persist(
    (set) => ({
      targets: [],
      touch: (target) =>
        set((s) => {
          const base = toSaved(target)
          const now = new Date().toISOString()
          const existing = s.targets.find((t) => t.key === base.key)
          const updated: SavedTarget = { ...base, pinned: existing?.pinned ?? false, lastUsed: now }
          const rest = s.targets.filter((t) => t.key !== base.key)
          // ピン留めは保持、最近は先頭。上限超過分は未ピンの古いものから落とす。
          const all = [updated, ...rest]
          const pinned = all.filter((t) => t.pinned)
          const unpinned = all.filter((t) => !t.pinned).slice(0, Math.max(LIMIT - pinned.length, 0))
          return { targets: [...pinned, ...unpinned] }
        }),
      togglePin: (key) =>
        set((s) => ({
          targets: s.targets.map((t) => (t.key === key ? { ...t, pinned: !t.pinned } : t)),
        })),
      remove: (key) => set((s) => ({ targets: s.targets.filter((t) => t.key !== key) })),
    }),
    { name: 'ip-study-targets' }
  )
)

// SavedTarget を QuizTarget に戻す
export function toQuizTarget(t: SavedTarget): QuizTarget {
  if (t.kind === 'all') return { kind: 'all' }
  if (t.kind === 'collection') return { kind: 'collection', id: t.id!, name: t.name }
  return { kind: 'view', id: t.id!, name: t.name }
}
