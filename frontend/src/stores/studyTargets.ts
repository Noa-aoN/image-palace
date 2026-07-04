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
    }),
    {
      name: 'ip-study-targets',
      version: 1,
      // 旧「コレクション」→「ボックス」改名の後方互換。localStorage に残る
      // kind:'collection' / key:'collection:<id>' を box 系へ読み替える。
      migrate: (persisted, version) => {
        const state = persisted as { targets?: SavedTarget[] } | undefined
        if (state?.targets && version < 1) {
          state.targets = state.targets.map((t) =>
            (t.kind as string) === 'collection'
              ? { ...t, kind: 'box', key: t.key.replace(/^collection:/, 'box:') }
              : t
          )
        }
        return state as State
      },
    }
  )
)

// SavedTarget を QuizTarget に戻す
export function toQuizTarget(t: SavedTarget): QuizTarget {
  if (t.kind === 'all') return { kind: 'all' }
  if (t.kind === 'box') return { kind: 'box', id: t.id!, name: t.name }
  return { kind: 'view', id: t.id!, name: t.name }
}
