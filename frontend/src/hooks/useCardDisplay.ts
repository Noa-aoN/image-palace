'use client'

import { useSyncExternalStore } from 'react'

/**
 * カード一覧の見え方。棚の中身と画面の広さで好みが変わるので、利用者に預ける。
 *
 * fit      … 画像の収め方
 *   natural  カードの縦横比そのままで並べる（画像は枠いっぱい）
 *   uniform  どのカードも正方形にして、画像は余白を付けて全体を収める
 *   比率の違うカードが混ざると、CSS グリッドは行の高さを一番高いカードに合わせるため、
 *   低いカードの下に空きができて棚が波打つ。uniform はそれを止めるための見え方。
 * columns  … 広い画面での列数（狭い画面では自動で減る）
 * rows     … 1ページの行数。枚数は columns × rows で決まる
 *
 * アカウントに紐づける性質のものではないので localStorage に端末ごと持つ。
 * 同じアカウントでも、机の大きな画面と手元の携帯とで好みは変わる。
 *
 * 保存値は SSR では読めないので useSyncExternalStore で扱う。
 * サーバーは既定を返し、水和のあとで保存値へ差し替わる。
 */
export type CardFit = 'natural' | 'uniform'

export interface CardDisplay {
  fit: CardFit
  columns: number
  /** 1ページの行数。実際の枚数は columns × rows */
  rows: number
}

export const CARD_COLUMN_CHOICES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const
export const CARD_ROW_CHOICES = [3, 5, 10, 20] as const

// サーバー側の上限（Api::V1::ItemsController::MAX_PER_PAGE）。超える組み合わせは選ばせない
export const MAX_CARDS_PER_PAGE = 100

export const DEFAULT_CARD_DISPLAY: CardDisplay = { fit: 'natural', columns: 5, rows: 5 }

// 対応表はスケルトンとも共有する（読み込み中と読み込み後で列数が変わらないように）
export { CARD_GRID_CLASSES, cardGridClass } from '@/lib/card-grid'

/** 1ページの枚数。行で持つので、列数を変えても行はきれいに埋まる */
export function cardsPerPage(display: CardDisplay): number {
  return display.columns * display.rows
}

/** その列数で選べる行数。枚数がサーバーの上限を超える組み合わせは出さない */
export function availableRowChoices(columns: number): number[] {
  const fits = CARD_ROW_CHOICES.filter((rows) => columns * rows <= MAX_CARDS_PER_PAGE)
  // 列数が多いと全部外れうる。そのときは一番小さい行数だけは残す
  return fits.length > 0 ? [...fits] : [CARD_ROW_CHOICES[0]]
}

/**
 * 一覧の画像に申告する表示幅。列数から作る。
 * 固定値のままだと、10列（実質 10vw）でも 25vw ぶんの解像度を落としてきて無駄になる。
 */
export function cardImageSizes(columns: number): string {
  return `(max-width: 768px) 50vw, (max-width: 1200px) 33vw, ${Math.round(100 / columns)}vw`
}

const STORAGE_KEY = 'image-palace:card-display'

function normalize(raw: unknown): CardDisplay {
  const value = (raw ?? {}) as Partial<CardDisplay>
  const columns = CARD_COLUMN_CHOICES.includes(value.columns as never)
    ? (value.columns as number)
    : DEFAULT_CARD_DISPLAY.columns
  const allowed = availableRowChoices(columns)
  const rows = allowed.includes(value.rows as number)
    ? (value.rows as number)
    : // 列を増やすと、それまでの行数では上限を超えることがある。入る中の一番多い行数へ寄せる
      (allowed.find((r) => r === DEFAULT_CARD_DISPLAY.rows) ?? allowed[allowed.length - 1])

  return { fit: value.fit === 'uniform' ? 'uniform' : 'natural', columns, rows }
}

// 読み出し結果は覚えておく。useSyncExternalStore は同じ値が返り続けることを求めるため
let cached: CardDisplay | null = null
const listeners = new Set<() => void>()

function getSnapshot(): CardDisplay {
  if (cached === null) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      cached = stored ? normalize(JSON.parse(stored)) : DEFAULT_CARD_DISPLAY
    } catch {
      // プライベートモード・壊れた値でも、既定で動けばよい
      cached = DEFAULT_CARD_DISPLAY
    }
  }
  return cached
}

function getServerSnapshot(): CardDisplay {
  return DEFAULT_CARD_DISPLAY
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

export function useCardDisplay(): [CardDisplay, (patch: Partial<CardDisplay>) => void] {
  const display = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const change = (patch: Partial<CardDisplay>) => {
    cached = normalize({ ...display, ...patch })
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached))
    } catch {
      // 保存できなくても、そのセッションの見え方は変わる
    }
    listeners.forEach((listener) => listener())
  }

  return [display, change]
}
