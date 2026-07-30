'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRightPanelStore } from '@/stores/rightPanel'

/**
 * 右パネルの「汎用スロット」。
 *
 * ページ側が自分の UI をそのままパネルへ差し込めるようにする仕組み。
 * 中身を props やストアに移し替えずに済むので、ページが持っている状態や
 * 更新関数をそのまま使える（＝ページごとに専用のストアを増やさなくてよい）。
 *
 * 使い方:
 *   openSection({ key: 'space-settings', title: '部屋の設定' })  // 開く
 *   <PanelSlotContent sectionKey="space-settings">…</PanelSlotContent>  // 中身を差し込む
 */

// スロットの DOM を購読する最小のストア（React の外で持つ）
let slotEl: HTMLElement | null = null
const listeners = new Set<() => void>()

export function setPanelSlot(el: HTMLElement | null) {
  slotEl = el
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => slotEl
const getServerSnapshot = () => null

/**
 * 指定したセクションが開いている間だけ、children を右パネルへ描画する。
 * パネルが閉じている・別のセクションが開いているときは何も描画しない。
 */
export function PanelSlotContent({ sectionKey, children }: { sectionKey: string; children: ReactNode }) {
  const el = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const mode = useRightPanelStore((s) => s.mode)
  const section = useRightPanelStore((s) => s.section)

  if (!el || mode !== 'section' || section?.key !== sectionKey) return null
  return createPortal(children, el)
}
