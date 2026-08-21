'use client'

import { Button } from '@/components/ui/button'
import { previewEntryPath, previewSubject, type PreviewState } from '@/lib/studio/preview'

/**
 * 工房室の中で「いま下見しています」を出す帯。
 *
 * **画面の帯（`PreviewBanner`）とは別のもの。**
 * あちらは普通の画面に出て「工房室へ戻る」を置くが、
 * ここは工房室の中なので戻る先が今そこ。かわりに「開く」を置く。
 */
export function PreviewStrip({
  preview,
  busy,
  onStop,
}: {
  preview: PreviewState
  busy: boolean
  onStop: () => void
}) {
  if (!preview.active) return null

  const subject = previewSubject(preview)

  return (
    <section
      className="flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm"
      style={{
        borderColor: '#4A3B6B',
        backgroundColor: 'color-mix(in srgb, #4A3B6B 6%, transparent)',
      }}
    >
      <span className="flex-1">
        <strong>{subject.label}</strong>（カード {preview.items} 枚）
        {subject.note ? (
          <span className="block text-xs text-muted-foreground">{subject.note}</span>
        ) : null}
      </span>

      <Button
        size="sm"
        variant="outline"
        onClick={() => window.open(previewEntryPath(preview), '_blank', 'noopener')}
      >
        下見を開く
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={onStop}>
        {busy ? '片付けています…' : '下見を終了'}
      </Button>

      {/* **下見は作った時点で固まっている。** それは狙いどおりだが、
          原本を直したあと「直ったはずなのに変わらない」と見えるのは困る */}
      {preview.stale ? (
        <span className="w-full text-xs" style={{ color: '#8A6210' }}>
          原本が作り直されています。いま見ているのは作った時点の姿です。
          直した姿を見るには、その荷物の「下見する」をもう一度押してください
        </span>
      ) : null}
    </section>
  )
}
