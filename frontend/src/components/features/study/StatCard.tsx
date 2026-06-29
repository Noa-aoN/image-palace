import type { ReactNode } from 'react'

// スタディの統計カード（ラベル＋数値＋任意アイコン）。レコード/ゲーム③/StudyStatsArea で共用。
export function StatCard({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
