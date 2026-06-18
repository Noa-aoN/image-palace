'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PenLine, Sparkles, GalleryVerticalEnd } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getItemsSummary, type ItemsSummary } from '@/lib/api/items'

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

  useEffect(() => {
    getItemsSummary()
      .then((data) => setSummary(data))
      .catch(() => setSummary(EMPTY_SUMMARY))
  }, [])

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

  const usedRatio =
    summary.monthly_limit > 0
      ? Math.min(100, Math.round((summary.monthly_count / summary.monthly_limit) * 100))
      : 0

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

      {/* 今月のクレジット（生成枚数）残量 */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-end justify-between">
            <p className="text-sm text-muted-foreground">今月の生成枚数</p>
            <p className="text-sm">
              <span className="font-semibold text-foreground">残り {summary.monthly_remaining} 枚</span>
              <span className="text-muted-foreground"> / {summary.monthly_limit} 枚</span>
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${usedRatio}%` }}
            />
          </div>
          {summary.monthly_remaining === 0 && (
            <p className="text-xs text-destructive">
              今月の上限に達しました。来月になるとリセットされます。
            </p>
          )}
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
