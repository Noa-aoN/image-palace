'use client'

import Link from 'next/link'
import { BarChart3 } from 'lucide-react'
import { ComingSoon } from '@/components/features/myroom/ComingSoon'
import { useStudyRecordStore } from '@/stores/studyRecords'

// プラクティス／クイズの「③ 記録・分析・応用」を共通描画する。
// 回数などの統計＋よく使う対象ランキング＋レコード導線＋準備中。
export function StudyStatsArea({ mode }: { mode: 'practice' | 'quiz' }) {
  const records = useStudyRecordStore((s) => s.records).filter((r) => r.mode === mode)
  const count = records.length

  // 2つ目の統計（プラクティス=見返した枚数 / クイズ=平均正答率）
  let secondLabel: string
  let secondValue: string
  if (mode === 'practice') {
    secondLabel = '見返した枚数'
    secondValue = `${records.reduce((s, r) => s + r.total, 0)}`
  } else {
    const q = records.reduce((s, r) => s + r.total, 0)
    const c = records.reduce((s, r) => s + r.correct, 0)
    secondLabel = '平均正答率'
    secondValue = q > 0 ? `${Math.round((c / q) * 100)}%` : '—'
  }

  // よく使う対象ランキング（上位5）
  const counts = new Map<string, number>()
  for (const r of records) counts.set(r.targetLabel, (counts.get(r.targetLabel) ?? 0) + 1)
  const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label={mode === 'practice' ? '復習した回数' : 'クイズ回数'} value={`${count}`} />
        <Stat label={secondLabel} value={secondValue} />
      </div>

      {ranking.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">よく使う対象（上位5）</p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {ranking.map(([name, n], i) => (
              <li key={name} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="flex-1 truncate font-medium">{name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{n}回</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href="/study/record" className="inline-flex items-center gap-1.5 text-sm hover:underline" style={{ color: 'var(--palace)' }}>
        <BarChart3 size={15} /> レコード（詳しい履歴・統計）を見る
      </Link>

      {mode === 'practice' ? (
        <ComingSoon description="復習の記録や、苦手カードの抽出などは順次対応予定です。" items={['苦手カードの抽出', '復習リマインド', '定着度の可視化']} />
      ) : (
        <ComingSoon description="弱点の分析や、苦手カードの復習など、応用機能は順次対応予定です。" items={['正答率の推移', '苦手カードの抽出', '復習リマインド']} />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
