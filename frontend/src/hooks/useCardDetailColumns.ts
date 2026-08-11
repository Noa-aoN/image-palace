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
  if (columns >= 3) return 'grid gap-3 md:grid-cols-2 xl:grid-cols-3'
  if (columns === 2) return 'grid gap-3 md:grid-cols-2'
  return 'space-y-3'
}
