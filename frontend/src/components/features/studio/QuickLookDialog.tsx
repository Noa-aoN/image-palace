'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { fetchQuickLook, type QuickLook } from '@/lib/api/studio'
import { STATUS_LABEL } from '@/lib/studio/status'

/**
 * さっと見る。**何も作らずに、荷物の中身をそのまま見る。**
 *
 * 「下見する」は自分の宮殿へ実際に入れるので、受け取った人と同じ画面で見られる。
 * だがカードを作って消す往復が要るし、見終わったら片付けも要る。
 * **見た目だけ確かめたいことのほうが多い。**
 *
 * ここは荷物の中身をそのまま描く。宮殿は汚れないし、ログインからも離れない。
 * 受け取ったときの見え方そのものではないので、**確かめる用途を取り違えない**よう
 * 「本物の画面で見る」への導線も残す。
 */
export function QuickLookDialog({
  packageKey,
  version,
  onClose,
  onPreview,
}: {
  packageKey: string
  version: number
  onClose: () => void
  onPreview: () => void
}) {
  const [data, setData] = useState<QuickLook | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchQuickLook(packageKey, version)
      .then(setData)
      .catch(() => setError('中身を読めませんでした'))
  }, [packageKey, version])

  // 逃げ道は必ず用意する。**覆いを出したまま戻れない**を作らない
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal
      aria-label="荷物の中身をさっと見る"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">
              {data?.name ?? packageKey}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                {packageKey} v{version}
                {data ? ` / ${STATUS_LABEL[data.status]}` : ''}
              </span>
            </h2>
            {data?.summary ? (
              <p className="mt-1 text-sm text-muted-foreground">{data.summary}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-md p-1 transition-colors hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>

        {error ? <p className="py-10 text-center text-muted-foreground">{error}</p> : null}

        {!data && !error ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : null}

        {data ? (
          <>
            <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span>カード {data.counts.items}</span>
              <span>箱 {data.counts.boxes}</span>
              <span>キャンバス {data.counts.views}</span>
            </div>

            {data.boxes.length > 0 ? (
              <ul className="mb-4 space-y-1 text-sm">
                {data.boxes.map((box) => (
                  <li key={box.name} className="text-muted-foreground">
                    箱「{box.name}」 カード {box.count}
                  </li>
                ))}
              </ul>
            ) : null}

            {data.views.length > 0 ? (
              <ul className="mb-4 space-y-1 text-sm">
                {data.views.map((view) => (
                  <li key={view.name} className="text-muted-foreground">
                    キャンバス「{view.name}」 節 {view.items} / 線 {view.edges}
                  </li>
                ))}
              </ul>
            ) : null}

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {data.items.map((item) => (
                <li
                  key={item.local_key}
                  className="overflow-hidden rounded-lg border border-border bg-background"
                >
                  <div className="aspect-square w-full bg-[var(--ivory-dark)]">
                    {item.image_url ? (
                      // 配信ホストは環境で変わる。ほかのカード表示と同じく素の img で出す
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : null}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {item.meaning ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {item.meaning}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            {/* **これは本物の画面ではない。** 見え方まで確かめたいなら、実際に入れて見る */}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4 text-xs text-muted-foreground"
                 style={{ borderColor: 'var(--ivory-dark)' }}>
              <span>ここは中身を並べただけです。受け取った人と同じ画面で見るなら</span>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onPreview()
                }}
                className="rounded-full border border-border px-3 py-1 transition hover:bg-muted"
              >
                下見する
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
