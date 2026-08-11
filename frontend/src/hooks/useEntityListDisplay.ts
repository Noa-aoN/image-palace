'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * 入れ物の一覧（キャンバス・スペース・ボックス）の見え方。
 *
 * カード一覧（useCardDisplay）と同じ考え方で、端末ごとに localStorage へ持つ。
 * 同じアカウントでも、机の大きな画面と手元の携帯とで好みは変わる。
 *
 * カード側と分けているのは、選べるものが違うため。
 * 入れ物は画像の比率が揃っているので「収め方」は要らず、
 * 代わりに「どの順に並べるか」が効く（数が増えるほど、探し方の問題になる）。
 */
export type EntitySort = 'recent' | 'name' | 'size'

/**
 * まとめ方。
 *   flat  … 全部を1つの棚に並べる
 *   type  … 種別ごとに棚を分ける（フリーボード / デッキ / ルーム / ロード）
 *
 * 種別が混ざったまま並ぶと、探すときに毎回「これはどれだったか」を読むことになる。
 * 一方、数が少ないうちは分けるほうが隙間だらけになる。だから選べるようにする。
 */
export type EntityGrouping = 'flat' | 'type'

export interface EntityListDisplay {
  columns: number
  sort: EntitySort
  grouping: EntityGrouping
  /** 札の右に添える一言（件数・種別）を出すか */
  showMeta: boolean
}

export const ENTITY_COLUMN_CHOICES = [2, 3, 4, 5, 6, 7, 8] as const

export const ENTITY_SORT_LABELS: Record<EntitySort, string> = {
  recent: '新しい順',
  name: '名前順',
  size: '中身が多い順',
}

export const ENTITY_GROUPING_LABELS: Record<EntityGrouping, string> = {
  flat: 'まとめて並べる',
  type: '種別ごとに分ける',
}

export const DEFAULT_ENTITY_DISPLAY: EntityListDisplay = {
  columns: 5,
  sort: 'recent',
  grouping: 'flat',
  showMeta: true,
}

const listeners = new Set<() => void>()

function storageKey(key: string) {
  return `entity-display:${key}`
}

function read(key: string): EntityListDisplay {
  if (typeof window === 'undefined') return DEFAULT_ENTITY_DISPLAY
  try {
    const raw = window.localStorage.getItem(storageKey(key))
    if (!raw) return DEFAULT_ENTITY_DISPLAY
    const parsed = JSON.parse(raw) as Partial<EntityListDisplay>
    return {
      columns: ENTITY_COLUMN_CHOICES.includes(parsed.columns as (typeof ENTITY_COLUMN_CHOICES)[number])
        ? (parsed.columns as number)
        : DEFAULT_ENTITY_DISPLAY.columns,
      sort: parsed.sort && parsed.sort in ENTITY_SORT_LABELS ? parsed.sort : DEFAULT_ENTITY_DISPLAY.sort,
      grouping:
        parsed.grouping && parsed.grouping in ENTITY_GROUPING_LABELS
          ? parsed.grouping
          : DEFAULT_ENTITY_DISPLAY.grouping,
      showMeta: typeof parsed.showMeta === 'boolean' ? parsed.showMeta : DEFAULT_ENTITY_DISPLAY.showMeta,
    }
  } catch {
    // 壊れた値が入っていても画面は出す。既定に戻すだけでよい
    return DEFAULT_ENTITY_DISPLAY
  }
}

// 保存値を読むたびに新しいオブジェクトを返すと、useSyncExternalStore が
// 「変わった」と判断して描き直し続ける。鍵ごとに1つだけ持って使い回す
const snapshots = new Map<string, EntityListDisplay>()

function snapshot(key: string): EntityListDisplay {
  const next = read(key)
  const current = snapshots.get(key)
  if (
    current &&
    current.columns === next.columns &&
    current.sort === next.sort &&
    current.grouping === next.grouping &&
    current.showMeta === next.showMeta
  ) {
    return current
  }
  snapshots.set(key, next)
  return next
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

/**
 * key は一覧ごとに分ける（views / spaces / boxes）。
 * まとめて1つにすると、列数を変えたつもりが別の一覧まで動く。
 */
export function useEntityListDisplay(key: string) {
  const display = useSyncExternalStore(
    subscribe,
    () => snapshot(key),
    () => DEFAULT_ENTITY_DISPLAY
  )

  const change = useCallback(
    (patch: Partial<EntityListDisplay>) => {
      const next = { ...read(key), ...patch }
      window.localStorage.setItem(storageKey(key), JSON.stringify(next))
      snapshots.delete(key)
      listeners.forEach((listener) => listener())
    },
    [key]
  )

  return { display, change }
}

/**
 * 種別ごとに分ける。並び順は各棚の中でも保たれる（呼ぶ前に並べ替えておく）。
 *
 * 棚の順番は、渡した種別の一覧（order）に従う。中身が0の種別は棚ごと出さない
 * （空の棚が並ぶと、あるはずのものが無いように見える）。
 */
export function groupEntities<T>(
  rows: T[],
  order: string[],
  read: { type: (row: T) => string; label: (type: string) => string }
): { type: string; label: string; rows: T[] }[] {
  const buckets = new Map<string, T[]>()
  rows.forEach((row) => {
    const type = read.type(row)
    const bucket = buckets.get(type)
    if (bucket) bucket.push(row)
    else buckets.set(type, [ row ])
  })

  // 一覧に出てきた種別のうち、順番が決まっているものを先に、知らないものは後ろへ
  const known = order.filter((type) => buckets.has(type))
  const unknown = [...buckets.keys()].filter((type) => !order.includes(type))

  return [...known, ...unknown].map((type) => ({
    type,
    label: read.label(type),
    rows: buckets.get(type) ?? [],
  }))
}

/** 並び順を適用する。名前と件数の取り出し方だけ呼び出し側から渡す */
export function sortEntities<T>(
  rows: T[],
  sort: EntitySort,
  read: { name: (row: T) => string; count: (row: T) => number }
): T[] {
  if (sort === 'recent') return rows
  const sorted = [...rows]
  if (sort === 'name') return sorted.sort((a, b) => read.name(a).localeCompare(read.name(b), 'ja'))
  return sorted.sort((a, b) => read.count(b) - read.count(a))
}
