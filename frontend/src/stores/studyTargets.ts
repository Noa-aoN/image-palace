import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { targetKey, type QuizTarget } from '@/lib/quiz'

// ★で保存したスタディ対象。①で★を付けた対象だけが②に表示される。
export type SavedTarget = {
  key: string
  kind: QuizTarget['kind']
  id?: string
  name: string
}

type State = {
  targets: SavedTarget[]
  toggleSave: (target: QuizTarget) => void
  remove: (key: string) => void
}

const LIMIT = 50

function toSaved(target: QuizTarget): SavedTarget {
  const key = targetKey(target)
  if (target.kind === 'all') return { key, kind: 'all', name: 'すべてのカード' }
  return { key, kind: target.kind, id: target.id, name: target.name }
}

export const useStudyTargetStore = create<State>()(
  persist(
    (set) => ({
      targets: [],
      // ★トグル：未保存なら先頭に追加、保存済みなら外す。
      toggleSave: (target) =>
        set((s) => {
          const key = targetKey(target)
          if (s.targets.some((t) => t.key === key)) {
            return { targets: s.targets.filter((t) => t.key !== key) }
          }
          return { targets: [toSaved(target), ...s.targets].slice(0, LIMIT) }
        }),
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
