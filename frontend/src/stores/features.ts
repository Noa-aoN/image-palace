'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import { getFeatureStages, type FeatureStage, type FeatureStages } from '@/lib/api/features'

/**
 * 機能の見せ方を1回だけ読んで、画面ぜんぶで使い回す。
 *
 * 段階を知りたい場所はサイドバー・ページ本体・入口の札と散らばるので、
 * それぞれが読みに行くと同じ問い合わせが何度も飛ぶ。
 *
 * 読み終わるまでは「まだ分からない」（undefined）を返す。ここで released を
 * 仮に返すと、出さないはずの入口が一瞬だけ見えてしまう。
 */
interface FeaturesState {
  stages: FeatureStages | null
  /** パス → キー。いま開いている場所から段階を引くのに使う */
  paths: Record<string, string> | null
  /** なぜ準備中かの一言（運営が書いたものだけ） */
  notes: Record<string, string> | null
  loading: boolean
  load: () => void
}

export const useFeaturesStore = create<FeaturesState>((set, get) => ({
  stages: null,
  paths: null,
  notes: null,
  loading: false,
  load: () => {
    if (get().stages || get().loading) return
    set({ loading: true })
    getFeatureStages()
      .then(({ features, paths, notes }) => set({ stages: features, paths, notes: notes ?? {}, loading: false }))
      // 読めなかったときは既定（released 扱い）に倒す。設定が読めないことを理由に
      // 動いている機能まで消してしまうと、障害の被害が広がる
      .catch(() => set({ stages: {}, paths: {}, notes: {}, loading: false }))
  },
}))

function useLoadedFeatures() {
  const stages = useFeaturesStore((s) => s.stages)
  const paths = useFeaturesStore((s) => s.paths)
  const load = useFeaturesStore((s) => s.load)

  useEffect(() => {
    load()
  }, [load])

  return { stages, paths }
}

/** そのキーの段階。読み込み中は undefined */
export function useFeatureStage(key: string): FeatureStage | undefined {
  const { stages } = useLoadedFeatures()
  if (!stages) return undefined
  return (stages[key] as FeatureStage) ?? 'released'
}

/**
 * そのパスの段階。読み込み中は undefined。
 *
 * 規則は2つだけにしてある。
 *   1. いちばん長く一致した指定を採る（`/study/game` の指定は `/study` より優先）
 *   2. 親が「表示しない」なら子も表示しない（入口を閉じたのに中から入れては意味がない）
 *
 * 「親が準備中なら子も準備中」にはしない。ハブは出したまま、中の1つだけ
 * 先に公開する、という進め方ができなくなるため。
 */
export function usePathStage(pathname: string | null): FeatureStage | undefined {
  const { stages, paths } = useLoadedFeatures()
  if (!stages || !paths) return undefined
  if (!pathname) return 'released'

  const matched = Object.keys(paths)
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)

  if (matched.length === 0) return 'released'

  const own = (stages[paths[matched[0]]] as FeatureStage) ?? 'released'
  const ancestorHidden = matched.slice(1).some((path) => stages[paths[path]] === 'hidden')
  return ancestorHidden ? 'hidden' : own
}

/**
 * そのパスの「なぜ準備中か」。運営が書いていなければ undefined。
 *
 * 段階（`usePathStage`）と同じ引き方をする。**同じ場所を指しているのに
 * 段階と理由で別の機能を引く**、が起きないようにするため。
 */
export function usePathStageNote(pathname: string | null): string | undefined {
  const { paths } = useLoadedFeatures()
  const notes = useFeaturesStore((s) => s.notes)
  if (!paths || !notes || !pathname) return undefined

  const matched = Object.keys(paths)
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)

  return matched.length > 0 ? notes[paths[matched[0]]] : undefined
}
