'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import { useItemsStore } from '@/stores/items'
import { can } from '@/lib/auth/capabilities'
import { remainingLabel } from '@/lib/demo/session'
import { showsPreviewBanner } from '@/lib/studio/preview'
import { endPreview, fetchCurrentPreview, type PreviewState } from '@/lib/api/studio'

/**
 * 公式コンテンツを下見しているあいだ、いつも1本だけ出す帯。
 *
 * **下見は自分の口座に入る。** だから見た目は本物と変わらない。
 * 何を見ているのか分からないまま自分の宮殿と混ざるのを防ぐため、
 * どの画面に居ても出し続ける。
 *
 * **浮かせない。** ヘッダーは `relative` なので、上に浮かせると隠してしまう。
 * 体験中の帯と同じく、root の layout でヘッダーの上に流れの中で置く。
 *
 * 置くのは2つだけ。**ここから公開はしない**（公開は工房室へ戻ってから）。
 */
export function PreviewBanner() {
  const router = useRouter()
  const pathname = usePathname()
  const session = useAdminStore((s) => s.session)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [preview, setPreview] = useState<PreviewState>({ active: false })
  const [ending, setEnding] = useState(false)

  // 工房に入れる人だけが尋ねる。**ふつうの利用者に1本増やさない**
  const mayPreview = isAuthenticated && can(session, 'access_official_studio')

  const load = useCallback(() => {
    if (!mayPreview) return
    fetchCurrentPreview()
      .then(setPreview)
      .catch(() => setPreview({ active: false }))
  }, [mayPreview])

  useEffect(load, [load])

  // 工房室で始めた／終えたことが、こちらのタブにも伝わるように。
  // タブを切り替えて戻ってきたときに引き直す
  useEffect(() => {
    if (!mayPreview) return
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [mayPreview, load])

  async function handleEnd() {
    if (ending) return
    if (!window.confirm('下見で入れたカードを片付けます。よろしいですか。')) return

    setEnding(true)
    try {
      await endPreview()
      setPreview({ active: false })
      // 下見のカードは消えたので、手元に持っている一覧も捨てる
      useItemsStore.getState().resetItems()
      router.push('/studio')
    } finally {
      setEnding(false)
    }
  }

  if (!preview.active) return null
  if (!showsPreviewBanner(pathname)) return null

  const remaining = remainingLabel(preview.expires_at)

  return (
    <div
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1
                 px-4 py-1.5 text-center text-xs"
      style={{ backgroundColor: '#4A3B6B', color: '#fff' }}
      role="status"
    >
      <span>
        公式コンテンツの下見中です
        {preview.name ? `（${preview.name} v${preview.version}）` : ''}
        {remaining ? ` ${remaining}で消えます` : ''}
      </span>

      <button
        type="button"
        onClick={() => router.push('/studio')}
        className="rounded-full bg-white/15 px-3 py-0.5 font-medium hover:bg-white/25"
      >
        工房室へ戻る
      </button>

      <button
        type="button"
        onClick={handleEnd}
        disabled={ending}
        className="rounded-full px-2 py-0.5 underline underline-offset-2 opacity-80
                   hover:opacity-100 disabled:opacity-50"
      >
        {ending ? '片付けています…' : '下見を終了'}
      </button>
    </div>
  )
}
