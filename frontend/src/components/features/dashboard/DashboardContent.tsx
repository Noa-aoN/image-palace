'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getItemsSummary, type ItemsSummary } from '@/lib/api/items'

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

  const usedRatio =
    summary && summary.monthly_limit > 0
      ? Math.min(100, Math.round((summary.monthly_count / summary.monthly_limit) * 100))
      : 0

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <h1 className="text-xl font-semibold">ダッシュボード</h1>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">所持カード数</p>
            <p className="text-3xl font-bold mt-1">
              {summary === null ? '...' : summary.total_count}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">生成中 / 失敗</p>
            <p className="text-3xl font-bold mt-1">
              {summary === null ? '...' : `${summary.processing_count} / ${summary.failed_count}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 今月のクレジット（生成枚数）残量 */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-end justify-between">
            <p className="text-sm text-muted-foreground">今月の生成枚数</p>
            <p className="text-sm">
              {summary === null ? (
                '...'
              ) : (
                <>
                  <span className="font-semibold text-foreground">残り {summary.monthly_remaining} 枚</span>
                  <span className="text-muted-foreground"> / {summary.monthly_limit} 枚</span>
                </>
              )}
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${usedRatio}%` }}
            />
          </div>
          {summary !== null && summary.monthly_remaining === 0 && (
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
