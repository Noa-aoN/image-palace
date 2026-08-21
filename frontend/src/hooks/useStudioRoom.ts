'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  endPreview,
  fetchCurrentPreview,
  fetchStudio,
  previewPackage,
  type PreviewState,
  type StudioOverview,
  type StudioPackage,
} from '@/lib/api/studio'
import { previewEntryPath } from '@/lib/studio/preview'
import { rememberEnded } from '@/lib/studio/previewTombstone'

/**
 * 工房室の部屋が共通で要るもの。
 *
 * どの部屋も「いまの様子」と「下見の状態」を見て、押されたら引き直す。
 * **同じ処理を部屋ごとに書き写さない**（片方だけ直す事故が起きる）。
 */
export function useStudioRoom() {
  const router = useRouter()
  const [data, setData] = useState<StudioOverview | null>(null)
  const [preview, setPreview] = useState<PreviewState>({ active: false })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchStudio()
      .then(setData)
      .catch(() => setError('工房を開けませんでした'))
    fetchCurrentPreview()
      .then(setPreview)
      .catch(() => setPreview({ active: false }))
  }, [])

  useEffect(load, [load])

  const act = useCallback(
    async (fn: () => Promise<unknown>, key: string) => {
      setBusy((current) => current ?? key)
      setError(null)
      try {
        await fn()
        load()
      } catch (e) {
        const message = (e as { response?: { data?: { error?: string } } }).response?.data?.error
        setError(message ?? '操作できませんでした')
      } finally {
        setBusy(null)
      }
    },
    [load]
  )

  /**
   * 下見を始めて、**新しいタブで普通の画面を開く。**
   *
   * 工房室を閉じずに、受け取った人と同じ見え方を確かめられるようにする。
   * タブは押した瞬間に開ける（返事を待ってから開くと、覗き窓の妨げに止められる）。
   */
  const openPreview = useCallback(
    async (pkg: StudioPackage) => {
      const tab = window.open('about:blank', '_blank', 'noopener')

      setBusy(`${pkg.id}-preview`)
      setError(null)
      try {
        const result = await previewPackage(pkg.key, pkg.version)
        setPreview(result)

        const path = previewEntryPath(result)
        if (tab) tab.location.href = path
        else router.push(path)
      } catch (e) {
        tab?.close()
        const message = (e as { response?: { data?: { error?: string } } }).response?.data?.error
        setError(message ?? '下見を始められませんでした')
      } finally {
        setBusy(null)
      }
    },
    [router]
  )

  const stopPreview = useCallback(async () => {
    setBusy('preview-end')
    try {
      // 終える前に行き先を覚える。**あとから開いたときに、そうと言えるように**
      if (preview.active) rememberEnded({ boxId: preview.box_id, viewId: preview.view_id })
      await endPreview()
      setPreview({ active: false })
      load()
    } finally {
      setBusy(null)
    }
  }, [preview, load])

  return { data, preview, busy, error, load, act, openPreview, stopPreview }
}
