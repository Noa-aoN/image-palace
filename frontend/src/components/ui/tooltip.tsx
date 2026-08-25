'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useSettingsStore } from '@/stores/settings'

/** 画面の端に残す余白。ここより外へは出さない */
const EDGE = 8

/**
 * アイコンだけのボタンに、何をするものかを添える。
 *
 * アイコンは場所を取らない代わりに、意味が読み手の推測任せになる。
 * ブラウザ標準の title 属性は出るまで約1秒かかり、迷って手が止まってから
 * ようやく出るので間に合わない。指を乗せた時点で出す。
 *
 * キーボードで辿ったときにも出す。マウスを持たない人にも同じ情報が要る。
 *
 * **画面を基準に置く（position: fixed）。**
 * 中身の隣に絶対配置すると、右パネルのように `overflow-y-auto` の中では
 * 枠で切られてしまい、肝心の説明が読めない。z-index を上げても直らない
 * （切っているのは重なり順ではなく、はみ出しの扱いのほう）。
 *
 * **端では折り返さず、内側へ寄せる。**
 * 中央合わせのままだと画面の端で外へ出る。出た分を詰めようとすると折り返し、
 * 2行になった説明が指の下に広がって、かえって読みにくい。
 * 出したあとに幅を測り、収まる位置まで横へずらす（幅は測らないと分からない）。
 * 画面より広い説明だけは、仕方なく折り返す。
 */
export function Tooltip({
  label,
  children,
  side = 'bottom',
  className,
}: {
  label: string
  children: ReactNode
  /** 上に出すか下に出すか。行の一番上にあるものは下、下端にあるものは上 */
  side?: 'top' | 'bottom'
  /**
   * 包みの見た目。**幅を持たせたいときに使う。**
   *
   * 既定は `inline-flex`（中身の幅）。アイコン釦に添えるぶんにはこれでよいが、
   * **並びの行に添えると、中身の幅までしか当たり判定が広がらない。**
   * サイドバーでは、名前の長さぶんだけしか色が付かず、
   * 短い項目と長い項目で反応する幅が違って見えた。
   */
  className?: string
}) {
  // **慣れた人には邪魔になる。** 環境設定で切れるようにしてある。
  // 設定を読む前（null）は出す側に倒す。初めての人のほうが困り方が大きい。
  // 体験の宮殿ではサーバーが必ず true を返すので、ここでは何もしない
  const enabled = useSettingsStore((state) => state.settings?.nav_hints) !== false

  const anchorRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const show = () => {
    if (!enabled) return

    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ left: r.left + r.width / 2, top: side === 'top' ? r.top : r.bottom })
  }

  const hide = () => setPos(null)

  // 出してから測って、収まる位置へ寄せる。
  //
  // 測った結果を state に戻すと、出すたびに描き直しが1回増える
  // （しかも1度目は端からはみ出したまま描かれる）。ここは**要素へ直に書く**。
  // 見た目を整えるだけで、ほかの描画に影響しない値だから。
  useLayoutEffect(() => {
    const tip = tipRef.current
    if (!pos || !tip) return

    const available = window.innerWidth - EDGE * 2
    // 画面より広い説明だけは、仕方なく折り返す
    if (tip.offsetWidth > available) {
      tip.style.whiteSpace = 'normal'
      tip.style.maxWidth = `${available}px`
      return
    }

    const half = tip.offsetWidth / 2
    const clamped = Math.min(Math.max(pos.left, half + EDGE), window.innerWidth - half - EDGE)
    tip.style.left = `${clamped}px`
  }, [pos])

  return (
    <span
      ref={anchorRef}
      className={`relative inline-flex ${className ?? ''}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {pos && (
        <span
          ref={tipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            transform:
              side === 'top' ? 'translate(-50%, -100%) translateY(-4px)' : 'translate(-50%, 4px)',
          }}
          className="pointer-events-none z-[100] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs leading-snug text-background shadow-md"
        >
          {label}
        </span>
      )}
    </span>
  )
}
