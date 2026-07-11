'use client'

import { useSyncExternalStore } from 'react'
import { useSettingsStore } from '@/stores/settings'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia(QUERY).matches
// SSR では OS の設定を知りようがないので「減らさない」を返す（クライアントで確定する）。
const getServerSnapshot = () => false

/**
 * アニメーションを動かしてよいかを返す。
 * 環境設定の motion_mode が "auto" のときだけ端末（OS）の prefers-reduced-motion に従い、
 * "on" / "off" のときはユーザーの明示指定で上書きする。
 */
export function useMotion(): boolean {
  const motionMode = useSettingsStore((s) => s.settings?.motion_mode) ?? 'auto'
  const osReduced = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (motionMode === 'off') return false
  if (motionMode === 'on') return true
  return !osReduced
}
