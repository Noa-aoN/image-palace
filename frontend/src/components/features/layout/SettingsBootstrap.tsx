'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useAdminStore } from '@/stores/admin'
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
  const fetchAdminSession = useAdminStore((s) => s.fetchSession)
  const animationsEnabled = useMotion()

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return
    fetchSettings()
    // サイドバーに「運営」を出すかどうかだけの判断に使う（守りはサーバー側）
    fetchAdminSession()
  }, [hasHydrated, isAuthenticated, fetchSettings, fetchAdminSession])

  useEffect(() => {
    document.documentElement.dataset.motion = animationsEnabled ? 'on' : 'off'
  }, [animationsEnabled])

  return null
}
