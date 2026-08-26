'use client'

import { Spinner } from '@/components/ui/spinner'
import { useStudioRoom } from '@/hooks/useStudioRoom'
import { PreviewStrip } from './PreviewStrip'
import { StudioPackageList } from './StudioPackageList'

/**
 * 個別配布設定。**人にどう渡すか。**
 *
 * 渡すものを「配布物」と呼ぶ。体験の宮殿に置く「配置物」とは役割が違う。
 *
 * 渡し方は4つある。デルフォイで受け取ってもらう、引き換えコードで渡す、
 * ミッションの報酬にする、買って手に入れてもらう。
 * **受け取る側の仕組みがまだ無いものは、そうと出す**（設定できるのに
 * 届かない、を黙って起こさない）。
 */
export function StudioDeliveryPanel() {
  const { data, preview, busy, error, act, openPreview, stopPreview } = useStudioRoom()

  if (error && !data) return <p className="py-12 text-center text-muted-foreground">{error}</p>
  if (!data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger-deep)' }}>
          {error}
        </p>
      ) : null}

      <PreviewStrip preview={preview} busy={busy === 'preview-end'} onStop={stopPreview} />

      <StudioPackageList
        room="delivery"
        packages={data.packages}
        busy={busy}
        onAct={act}
        onPreview={openPreview}
      />
    </div>
  )
}
