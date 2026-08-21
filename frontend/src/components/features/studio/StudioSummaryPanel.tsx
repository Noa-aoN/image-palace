'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { useStudioRoom } from '@/hooks/useStudioRoom'
import { summarize } from '@/lib/studio/channels'
import { PreviewStrip } from './PreviewStrip'

/**
 * 工房室の概要。**いま何がどこへ出ているか、ひと目で。**
 *
 * ここに操作は置かない。触るのは各部屋で行う。
 * 概要に全部を積むと、荷物が増えるほど原本や制作枠が画面の外へ行く。
 */
export function StudioSummaryPanel() {
  const { data, preview, busy, error, stopPreview } = useStudioRoom()

  const channels = useMemo(() => (data ? summarize(data.packages) : []), [data])

  if (error && !data) {
    return <p className="py-12 text-center text-muted-foreground">{error}</p>
  }
  if (!data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  const drafts = data.packages.filter((p) => p.status === 'draft').length

  return (
    <div className="space-y-6">
      <PreviewStrip preview={preview} busy={busy === 'preview-end'} onStop={stopPreview} />

      {/* 原本の様子。**公式宮殿にあるもの全部が公開物ではない**ので、
          ここは「持ち物」であって「配っているもの」ではない */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">公式宮殿（原本）</h2>
          <Link href="/studio/originals" className="text-xs underline underline-offset-2">
            原本を見る
          </Link>
        </div>
        {data.owner ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Stat label="口座" value={data.owner.email} />
            <Stat label="カード" value={`${data.owner.items} 枚`} />
            <Stat label="箱" value={`${data.owner.boxes}`} />
            <Stat label="キャンバス" value={`${data.owner.views}`} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            公式コンテンツの口座が設定されていません（<code>OFFICIAL_CONTENT_USER_ID</code>）
          </p>
        )}
      </section>

      {/* **いま何がどこへ出ているか。** 数えているのは出している荷物だけ */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">いま出しているもの</h2>
        <ul className="space-y-2">
          {channels.map((c) => (
            <li key={c.channel} className="flex items-baseline justify-between gap-3 text-sm">
              <span className={c.pending ? 'text-muted-foreground' : ''}>
                {c.label}
                {c.pending ? '（準備中）' : ''}
              </span>
              <span className="tabular-nums">
                {c.packages === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <>
                    {c.packages} 件
                    <span className="ml-2 text-xs text-muted-foreground">カード {c.items}</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <Link href="/studio/demo" className="underline underline-offset-2">
            体験宮殿設定へ
          </Link>
          <Link href="/studio/delivery" className="underline underline-offset-2">
            個別配布設定へ
          </Link>
          {drafts > 0 ? (
            <span className="text-muted-foreground">下書きが {drafts} 件あります</span>
          ) : null}
        </div>
      </section>

      {data.allowance ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 text-base font-semibold">公式制作枠</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            公式コンテンツを作るときはこちらを使います。買ったクレジットは減りません。毎月戻ります
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {data.allowance.used_credits}
            <span className="text-base font-normal text-muted-foreground">
              {' / '}
              {data.allowance.limit_credits} cr
            </span>
          </p>
        </section>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  )
}
