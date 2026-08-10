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
  loading: boolean
  load: () => void
}

export const useFeaturesStore = create<FeaturesState>((set, get) => ({
  stages: null,
  paths: null,
  loading: false,
  load: () => {
    if (get().stages || get().loading) return
    set({ loading: true })
    getFeatureStages()
      .then(({ features, paths }) => set({ stages: features, paths, loading: false }))
      // 読めなかったときは既定（released 扱い）に倒す。設定が読めないことを理由に
      // 動いている機能まで消してしまうと、障害の被害が広がる
      .catch(() => set({ stages: {}, paths: {}, loading: false }))
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
