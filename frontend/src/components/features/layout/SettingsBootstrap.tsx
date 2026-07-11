'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useMotion } from '@/hooks/useMotion'

/**
 * アカウントの環境設定を一度だけ読み込み、アニメーション設定を DOM に反映する。
 * CSS 側は `:root[data-motion="off"]` を prefers-reduced-motion と同じ扱いにしているので、
 * ここで属性を付けるだけで既存の演出（LP のヒーロー・道など）も止まる。
 */
export function SettingsBootstrap() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const fetchSettings = useSettingsStore((s) => s.fetchSettings)
  const animationsEnabled = useMotion()

  useEffect(() => {
    if (hasHydrated && isAuthenticated) fetchSettings()
  }, [hasHydrated, isAuthenticated, fetchSettings])

  useEffect(() => {
    document.documentElement.dataset.motion = animationsEnabled ? 'on' : 'off'
  }, [animationsEnabled])

  return null
}
