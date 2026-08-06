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
 * columns  … 広い画面での1行の枚数（狭い画面では自動で減る）
 * perPage  … 1ページの枚数
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
  perPage: number
}

export const CARD_COLUMN_CHOICES = [2, 3, 4, 5, 6] as const
export const CARD_PER_PAGE_CHOICES = [12, 24, 48, 96] as const

export const DEFAULT_CARD_DISPLAY: CardDisplay = { fit: 'natural', columns: 5, perPage: 24 }

// Tailwind は文字列を静的に読むので、組み立てず対応表から選ぶ
export const CARD_GRID_CLASSES: Record<number, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6',
}

const STORAGE_KEY = 'image-palace:card-display'

function normalize(raw: unknown): CardDisplay {
  const value = (raw ?? {}) as Partial<CardDisplay>
  return {
    fit: value.fit === 'uniform' ? 'uniform' : 'natural',
    columns: CARD_COLUMN_CHOICES.includes(value.columns as never)
      ? (value.columns as number)
      : DEFAULT_CARD_DISPLAY.columns,
    perPage: CARD_PER_PAGE_CHOICES.includes(value.perPage as never)
      ? (value.perPage as number)
      : DEFAULT_CARD_DISPLAY.perPage,
  }
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
