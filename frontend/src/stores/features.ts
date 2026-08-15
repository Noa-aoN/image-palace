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
  /** 最後に読んだ時刻（ミリ秒）。取り直しの間隔を測るのに使う */
  fetchedAt: number
  load: () => void
  /** いま読み直す。運営が段階を変えたときと、画面に戻ってきたときに使う */
  refresh: () => void
}

/**
 * 取り直しの最短の間隔。
 *
 * 画面に戻るたびに読みに行くと、行き来しただけで問い合わせが増える。
 * かといって長いと、運営が閉じた機能がいつまでも開いたままになる。
 */
export const FEATURES_REFRESH_INTERVAL_MS = 60_000

function fetchStages(set: (partial: Partial<FeaturesState>) => void) {
  set({ loading: true })
  getFeatureStages()
    .then(({ features, paths, notes }) =>
      set({ stages: features, paths, notes: notes ?? {}, loading: false, fetchedAt: Date.now() })
    )
    // 読めなかったときは既定（released 扱い）に倒す。設定が読めないことを理由に
    // 動いている機能まで消してしまうと、障害の被害が広がる
    //
    // **失敗しても fetchedAt は進める。** 進めないと、落ちている間じゅう
    // 画面に戻るたびに読みに行くことになる
    .catch(() => set({ stages: {}, paths: {}, notes: {}, loading: false, fetchedAt: Date.now() }))
}

export const useFeaturesStore = create<FeaturesState>((set, get) => ({
  stages: null,
  paths: null,
  notes: null,
  loading: false,
  fetchedAt: 0,
  load: () => {
    if (get().stages || get().loading) return
    fetchStages(set)
  },
  refresh: () => {
    if (get().loading) return
    fetchStages(set)
  },
}))

function useLoadedFeatures() {
  const stages = useFeaturesStore((s) => s.stages)
  const paths = useFeaturesStore((s) => s.paths)
  const load = useFeaturesStore((s) => s.load)

  useEffect(() => {
    load()
  }, [load])

  // 画面に戻ってきたときに読み直す。
  //
  // 段階は運営がいつでも変えられるが、**開きっぱなしの画面には届かない**
  // （読むのは1回だけなので、閉じたはずの機能が開いたまま残る）。
  // 別のタブから戻ってきた瞬間が、いちばん自然な取り直しどころ。
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return

      const { fetchedAt, refresh } = useFeaturesStore.getState()
      if (Date.now() - fetchedAt < FEATURES_REFRESH_INTERVAL_MS) return

      refresh()
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

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
