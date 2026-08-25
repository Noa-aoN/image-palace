'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

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

/** この端末で選んだ列数。選んでいなければ null（アカウントの設定に従う） */
function readStored(): number | null {
  if (typeof window === 'undefined') return null
  const raw = Number(window.localStorage.getItem(KEY))
  return CARD_DETAIL_COLUMN_CHOICES.includes(raw as 1 | 2 | 3) ? raw : null
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

/**
 * @param fallback この端末でまだ選んでいないときに使う列数（アカウントの設定）
 * @param fallbackReady その `fallback` が確定しているか。
 *   アカウントの設定は後から届くので、**届く前に描くと1列で組んでから2〜3列へ割れる。**
 *   札がいったん画面幅いっぱいに広がってから縮むので、開くたびに紙面が跳ねて見えた。
 */
export function useCardDetailColumns(fallback = 1, fallbackReady = true) {
  const stored = useSyncExternalStore(subscribe, readStored, () => null)

  // 設定が最後まで来ないとき（通信の失敗など）に、隠したままにしない保険
  const [graced, setGraced] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setGraced(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  const change = useCallback((next: number) => {
    window.localStorage.setItem(KEY, String(next))
    listeners.forEach((listener) => listener())
  }, [])

  return {
    columns: stored ?? fallback,
    change,
    // この端末で選んであれば、設定を待つ必要は無い（そちらが優先されるので）
    ready: stored !== null || fallbackReady || graced,
  }
}

/**
 * 列数に対応する格子。狭い画面では自動で1列に戻す。
 * 決めた数はあくまで広い画面での話で、携帯で2列に並べても読めない。
 */
/**
 * 札の並べ方。
 *
 * **列の中を上から順に埋める**（左の列が終わってから、次の列へ）。
 *
 * 行から埋める並べ方だと、
 *   ・短い札の下に空きができる（同じ行の高さがいちばん高い札に決まるため）
 *   ・1つ動かすと、次から後ろが左右にずれる（縦に動かしたつもりが横へ飛ぶ）
 * の2つが同時に起きる。どちらも「並びが読めない」に見える。
 *
 * 列の中を流す形なら、上下に動かすと上下にだけ動く。空きも出ない。
 */
export function cardDetailGridClass(columns: number): string {
  // 間隔は札どうしで揃える（詳細ページの space-y-3 と同じ 12px）。
  // ここだけ広いと、同じ並びの札なのに群があるように見える。
  //
  // items-start は、札を中身の高さのままにするため。既定（stretch）だと
  // 同じ行でいちばん高い札に合わせて全部が伸び、短い項目の下に空の面ができる。
  // 「読み仮名」の札が「語源」と同じ高さになるのは、詰まって見えない
  // gap は列と列の間。段の間は札そのものの下余白で作る（columns には row-gap が無い）
  if (columns >= 3) return 'md:columns-2 xl:columns-3 gap-3 [&>*]:mb-3 [&>*]:break-inside-avoid'
  if (columns === 2) return 'md:columns-2 gap-3 [&>*]:mb-3 [&>*]:break-inside-avoid'
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

/**
 * 既定は入り。開いた瞬間に絵の全体が見えるほうが、カードの用を果たす。
 *
 * **「まだ選んでいない」と「自分で切った」を区別する。**
 * `=== 'true'` で読んでいたころは、保存が無い＝切っている、になっていた。
 * 既定を入りにするなら、保存が無いときだけ既定へ倒し、
 * 'false' が保存されていればその通りに切る
 */
function readFit(): boolean {
  if (typeof window === 'undefined') return true
  const raw = window.localStorage.getItem(FIT_KEY)
  return raw === null ? true : raw === 'true'
}

/**
 * 見出し語とイメージも、ほかの項目と同じ列に並べるか。
 *
 * 端末ごとに覚える（人によって画面の広さが違うので、揃える意味が薄い）。
 */
const LEAD_KEY = 'card-detail-lead-in-grid'

/** 既定は入り。見出し語と絵も同じ札として扱うほうが、並べ替えの効く範囲が広い */
function readLeadInGrid(): boolean {
  if (typeof window === 'undefined') return true
  const raw = window.localStorage.getItem(LEAD_KEY)
  return raw === null ? true : raw === 'true'
}

export function useCardDetailLeadInGrid() {
  const value = useSyncExternalStore(subscribe, readLeadInGrid, () => true)

  const change = useCallback((next: boolean) => {
    window.localStorage.setItem(LEAD_KEY, String(next))
    listeners.forEach((listener) => listener())
  }, [])

  return { leadInGrid: value, change }
}

export function useCardDetailFit() {
  const fit = useSyncExternalStore(
    subscribe,
    readFit,
    () => true
  )

  const change = useCallback((next: boolean) => {
    window.localStorage.setItem(FIT_KEY, String(next))
    listeners.forEach((listener) => listener())
  }, [])

  return { fit, change }
}
