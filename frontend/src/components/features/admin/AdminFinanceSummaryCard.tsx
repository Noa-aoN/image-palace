'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { AdminFinanceSummary } from '@/types/admin'

const yen = (value: number) => `¥${Math.round(value).toLocaleString()}`

// 概要に出す今月の収支。詳細は /admin/finance。
// 数字は概要のレスポンスに同梱されている（別に取りに行くと往復が二重になる）
export function AdminFinanceSummaryCard({ summary }: { summary: AdminFinanceSummary }) {

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">
          今月の収支（{summary.period.month}月・概算）
        </h2>
        <Link href="/admin/finance" className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground">
          内訳と設定 <ChevronRight size={14} />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="収入（実績）" value={yen(summary.revenue.total)} />
        <Stat label="支出（概算）" value={yen(summary.cost.total)} />
        <Stat
          label="差引"
          value={yen(summary.profit)}
          tone={summary.profit < 0 ? 'bad' : undefined}
          sub={summary.margin === null ? undefined : `粗利率 ${summary.margin}%`}
        />
      </div>
    </section>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'bad' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'bad' ? 'text-destructive' : ''}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
