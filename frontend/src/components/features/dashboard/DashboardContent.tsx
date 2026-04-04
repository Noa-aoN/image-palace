'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getItemsSummary } from '@/lib/api/items'

export function DashboardContent() {
  const [summary, setSummary] = useState<{ total_count: number; processing_count: number; failed_count: number } | null>(null)

  useEffect(() => {
    getItemsSummary()
      .then((data) => setSummary(data))
      .catch(() => setSummary({ total_count: 0, processing_count: 0, failed_count: 0 }))
  }, [])

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
