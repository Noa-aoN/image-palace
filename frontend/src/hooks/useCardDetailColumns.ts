'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * カード詳細で項目を何列に並べるか。
 *
 * 端末ごとに localStorage で覚える（カード一覧の見え方と同じ考え方）。
 * 机の大きな画面では2列で一望したいが、手元の携帯では1列でないと読めない。
 *
 * 既定はアカウントの設定（`settings.card_detail_columns`）から来る。
 * この端末でまだ選んでいなければ、そちらに従う。
 *
 * 3列より多くしないのは、1列が細くなりすぎて説明のような長い項目が読めなくなるため。
 */
const KEY = 'card-detail-columns'
export const CARD_DETAIL_COLUMN_CHOICES = [1, 2, 3] as const

const listeners = new Set<() => void>()

function read(fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const raw = Number(window.localStorage.getItem(KEY))
  return CARD_DETAIL_COLUMN_CHOICES.includes(raw as 1 | 2 | 3) ? raw : fallback
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

export function useCardDetailColumns(fallback = 1) {
  const columns = useSyncExternalStore(
    subscribe,
    () => read(fallback),
    () => fallback
  )

  const change = useCallback((next: number) => {
    window.localStorage.setItem(KEY, String(next))
    listeners.forEach((listener) => listener())
  }, [])

  return { columns, change }
}

/**
 * 列数に対応する格子。狭い画面では自動で1列に戻す。
 * 決めた数はあくまで広い画面での話で、携帯で2列に並べても読めない。
 */
export function cardDetailGridClass(columns: number): string {
  // 間隔は札どうしで揃える（詳細ページの space-y-3 と同じ 12px）。
  // ここだけ広いと、同じ並びの札なのに群があるように見える。
  //
  // items-start は、札を中身の高さのままにするため。既定（stretch）だと
  // 同じ行でいちばん高い札に合わせて全部が伸び、短い項目の下に空の面ができる。
  // 「読み仮名」の札が「語源」と同じ高さになるのは、詰まって見えない
  if (columns >= 3) return 'grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3'
  if (columns === 2) return 'grid items-start gap-3 md:grid-cols-2'
  return 'space-y-3'
}

/**
 * カード詳細を「画面に収める」かどうか。
 *
 * 学習で見返すときは、**見出し語と絵だけを大きく見たい**。
 * 項目を全部並べる見方（列設定どおり）とは目的が違うので、切り替えで持つ。
 *
 * 列数と同じく端末ごとに覚える。**新しい設定体系は増やさない**
 * （同じ「詳細の見え方」の話なので、置き場所も揃える）。
 *
 * 何を出すかの語彙は一覧と同じ（見出し語 = title / イメージ = image）。
 * 収めるときはその2つだけを見せる。
 */
const FIT_KEY = 'card-detail-fit'

function readFit(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(FIT_KEY) === 'true'
}

export function useCardDetailFit() {
  const fit = useSyncExternalStore(
    subscribe,
    readFit,
    () => false
  )

  const change = useCallback((next: boolean) => {
    window.localStorage.setItem(FIT_KEY, String(next))
    listeners.forEach((listener) => listener())
  }, [])

  return { fit, change }
}
