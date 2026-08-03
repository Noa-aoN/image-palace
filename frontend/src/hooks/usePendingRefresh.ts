'use client'

import { useEffect } from 'react'
import { POLLING_STATUSES } from '@/lib/item-status'
import type { GenerationStatus } from '@/types/item'

/** 生成中かどうかを見るのに必要な最小限 */
type Watchable = { generation_status?: GenerationStatus }

const INTERVAL_MS = 3000
const HIDDEN_INTERVAL_MS = 10000

/**
 * 生成中のカードが混ざっている間だけ、取り直しを繰り返す。
 *
 * 画像は非同期に作られるため、作った直後は生成中のまま並ぶ。
 * 取り直さないと、待っていても画像が現れない。
 *
 * 取り直しの結果 items が変われば、この効果がもう一度動いて次の回を予約する。
 * 生成中が居なくなれば予約しないので、自然に止まる。
 * タブが隠れている間は間隔を空け、見ていない画面のために叩き続けない。
 *
 * 一覧（/items）は自前のページングと結びついた取り直しを既に持つため、
 * こちらは使わない。同じ対象を二重に追わないよう、使う側は 1 画面に 1 つとする。
 */
export function usePendingRefresh(items: Watchable[], refresh: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const waiting = items.some(
      (item) => item.generation_status !== undefined && POLLING_STATUSES.has(item.generation_status)
    )
    if (!waiting) return

    const hidden = typeof document !== 'undefined' && document.hidden
    const timer = setTimeout(refresh, hidden ? HIDDEN_INTERVAL_MS : INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [items, refresh, enabled])
}
