'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PenLine, Sparkles, GalleryVerticalEnd } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getItemsSummary, type ItemsSummary } from '@/lib/api/items'
import { useBillingStore } from '@/stores/billing'
import { tierLabel } from '@/lib/billing'

const GETTING_STARTED = [
  { icon: <PenLine size={20} />, text: '覚えたい単語や概念を入力する' },
  { icon: <Sparkles size={20} />, text: 'AIが画像カードに変換する' },
  { icon: <GalleryVerticalEnd size={20} />, text: 'カードで見返し、デッキやタグで整理する' },
]

const EMPTY_SUMMARY: ItemsSummary = {
  total_count: 0,
  pending_count: 0,
  processing_count: 0,
  failed_count: 0,
  monthly_count: 0,
  monthly_limit: 0,
  monthly_remaining: 0,
}

export function DashboardContent() {
  const [summary, setSummary] = useState<ItemsSummary | null>(null)
  const billing = useBillingStore((s) => s.summary)
  const fetchBilling = useBillingStore((s) => s.fetchSummary)

  useEffect(() => {
    getItemsSummary()
      .then((data) => setSummary(data))
      .catch(() => setSummary(EMPTY_SUMMARY))
    fetchBilling()
  }, [fetchBilling])

  // 読み込み中はスケルトンを表示する。新規ユーザー判定（total_count===0）の前に出すことで、
  // 「統計(…) → ようこそ画面」へ切り替わるレイアウトシフトを防ぐ。
  if (summary === null) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div className="h-7 w-40 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
        </div>
        <div className="h-28 rounded-xl bg-muted animate-pulse" />
        <div className="h-10 w-48 rounded bg-muted animate-pulse" />
      </div>
    )
  }

  // 新規ユーザー（カード0件）には統計の代わりに始め方ガイドを表示
  if (summary.total_count === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">ようこそ、ImagePalace へ</h1>
          <p className="mt-2 text-muted-foreground">
            単語をAI画像のカードに変えて、思い出しやすい記憶をつくりましょう。まずは1枚作ってみてください。
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm font-medium">使い方</p>
            <ol className="space-y-3">
              {GETTING_STARTED.map((step, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: 'var(--palace)' }}
                  >
                    {step.icon}
                  </span>
                  <span className="text-sm">{step.text}</span>
                </li>
              ))}
            </ol>
            <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
              <p className="text-sm font-medium">最初に試しやすい例</p>
              <p className="mt-1 text-sm text-muted-foreground">富士山、光合成、API、細胞分裂</p>
            </div>
            <Link href="/items/new">
              <Button size="lg" className="w-full sm:w-auto">最初のカードを作成する</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <h1 className="text-xl font-semibold">ダッシュボード</h1>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">所持カード数</p>
            <p className="text-3xl font-bold mt-1">{summary.total_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">生成中 / 失敗</p>
            <p className="text-3xl font-bold mt-1">{summary.processing_count} / {summary.failed_count}</p>
          </CardContent>
        </Card>
      </div>

      {/* クレジット残高・プラン */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-muted-foreground">クレジット残高</p>
              <p className="text-3xl font-bold mt-1 tabular-nums">
                {billing ? billing.available_credits : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">プラン</p>
              <p className="text-sm font-medium">{tierLabel(billing?.plan?.tier ?? 'free')}</p>
            </div>
          </div>
          {billing && billing.available_credits <= 0 && (
            <p className="text-xs text-destructive">
              クレジットがありません。プランのアップグレードかクレジット追加で生成を続けられます。
            </p>
          )}
          <Link href="/billing">
            <Button variant="outline" size="sm">プランを見る</Button>
          </Link>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Link href="/items/new">
          <Button>+ カードを作成</Button>
        </Link>
        <Link href="/items">
          <Button variant="outline">マイカードを見る</Button>
        </Link>
      </div>
    </div>
  )
}
