'use client'

import { useEffect, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { PropertyBlock, BlockEmpty } from '@/components/features/items/PropertyBlock'
import { getReviewSummary, type ReviewSummary } from '@/lib/api/reviews'

/**
 * このカードを何回・いつ確認したか。
 *
 * 正答率は「正誤の付いた回」だけで出す。見返し（seen）を混ぜると、
 * 見返すほど率が動いて意味を成さない。
 *
 * 「習熟度」のような1つの数字は出さない。出すなら間隔反復の設計とセットで
 * 決めるべきで、いまは生の記録が貯まりはじめたところ。
 */
export function ItemReviewBlock({ itemId }: { itemId: string }) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    getReviewSummary(itemId)
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch(() => {
        if (!cancelled) setSummary({ count: 0, last_reviewed_at: null, recent_graded_count: 0, recent_correct_count: 0 })
      })
    return () => {
      cancelled = true
    }
  }, [itemId])

  return (
    <PropertyBlock title="学習の記録">
      {summary === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={14} />
          読み込み中…
        </p>
      ) : summary.count === 0 ? (
        <BlockEmpty>まだ確認していません。</BlockEmpty>
      ) : (
        <dl className="space-y-1 text-sm">
          <Row label="確認した回数" value={`${summary.count} 回`} />
          {summary.last_reviewed_at && (
            <Row
              label="最後に確認"
              value={new Date(summary.last_reviewed_at).toLocaleString('ja-JP', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          )}
          {summary.recent_graded_count > 0 && (
            <Row
              label="直近の正答"
              value={`${summary.recent_correct_count} / ${summary.recent_graded_count}`}
            />
          )}
        </dl>
      )}
    </PropertyBlock>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}
