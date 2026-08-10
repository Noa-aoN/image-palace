'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import { getFeatureStages, type FeatureStage, type FeatureStages } from '@/lib/api/features'

/**
 * 機能の見せ方を1回だけ読んで、画面ぜんぶで使い回す。
 *
 * 段階を知りたい場所は入口・一覧・ページ本体と散らばるので、
 * それぞれが読みに行くと同じ問い合わせが何度も飛ぶ。
 *
 * 読み終わるまでは「まだ分からない」（undefined）を返す。ここで released を
 * 仮に返すと、出さないはずの入口が一瞬だけ見えてしまう。
 */
interface FeaturesState {
  stages: FeatureStages | null
  loading: boolean
  load: () => void
}

export const useFeaturesStore = create<FeaturesState>((set, get) => ({
  stages: null,
  loading: false,
  load: () => {
    if (get().stages || get().loading) return
    set({ loading: true })
    getFeatureStages()
      .then((stages) => set({ stages, loading: false }))
      // 読めなかったときは既定（released 扱い）に倒す。設定が読めないことを理由に
      // 動いている機能まで消してしまうと、障害の被害が広がる
      .catch(() => set({ stages: {}, loading: false }))
  },
}))

/** その機能の段階。読み込み中は undefined */
export function useFeatureStage(key: string): FeatureStage | undefined {
  const stages = useFeaturesStore((s) => s.stages)
  const load = useFeaturesStore((s) => s.load)

  useEffect(() => {
    load()
  }, [load])

  if (!stages) return undefined
  return stages[key] ?? 'released'
}
