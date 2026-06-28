'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Layers, HelpCircle, Gamepad2, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStudyRecordStore, type StudyRecord, type StudyGameKind } from '@/stores/studyRecords'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const GAME_LABELS: Record<StudyGameKind, string> = {
  streak: '連続正解',
  memory: '神経衰弱',
  karuta: 'カルタ',
  duel: 'メモリーデュエル',
}

function modeLabel(r: StudyRecord): string {
  if (r.mode === 'practice') return 'プラクティス'
  if (r.mode === 'quiz') return 'クイズ'
  return r.game ? GAME_LABELS[r.game] : 'プレイ'
}

// 履歴1件の主要数値
function metric(r: StudyRecord): string {
  if (r.mode === 'practice') return `${r.total} 枚`
  if (r.mode === 'quiz') {
    const rate = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0
    return `${r.correct}/${r.total}（${rate}%）`
  }
  if (r.game === 'streak') return `連続 ${r.total}`
  if (r.game === 'memory') return `${r.total} ペア`
  if (r.game === 'karuta') return `${r.total} 枚`
  if (r.game === 'duel') return r.correct ? `勝利（残${r.score ?? 0}）` : '敗北'
  return `${r.total}`
}

export default function RecordPage() {
  const records = useStudyRecordStore((s) => s.records)
  const clear = useStudyRecordStore((s) => s.clear)
  const [confirming, setConfirming] = useState(false)

  const practice = records.filter((r) => r.mode === 'practice')
  const quizzes = records.filter((r) => r.mode === 'quiz')
  const games = records.filter((r) => r.mode === 'game')

  const practiceCards = practice.reduce((s, r) => s + r.total, 0)
  const quizQ = quizzes.reduce((s, r) => s + r.total, 0)
  const quizC = quizzes.reduce((s, r) => s + r.correct, 0)
  const avgRate = quizQ > 0 ? Math.round((quizC / quizQ) * 100) : null
  const bestStreak = games.filter((r) => r.game === 'streak').reduce((m, r) => Math.max(m, r.total), 0)

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/study">
        <Button variant="ghost" className="text-sm px-0 mb-4">← スタディへ戻る</Button>
      </Link>
      <h1 className="text-2xl font-semibold">レコード</h1>
      <p className="mt-2 text-muted-foreground">プラクティス・クイズ・プレイの学習履歴と統計を確認します。</p>

      {records.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-card/60 px-5 py-10 text-center text-sm text-muted-foreground">
          まだ記録がありません。プラクティス・クイズ・プレイに挑戦すると、ここに結果が残ります。
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/study/practice"><Button size="sm" variant="outline">プラクティス</Button></Link>
            <Link href="/study/quiz"><Button size="sm">クイズ</Button></Link>
            <Link href="/study/game"><Button size="sm" variant="outline">プレイ</Button></Link>
          </div>
        </div>
      ) : (
        <>
          {/* 統計 */}
          <div className="mt-8 space-y-4">
            <StatGroup icon={<Layers size={16} />} title="プラクティス">
              <Stat label="回数" value={`${practice.length}`} />
              <Stat label="見返した枚数" value={`${practiceCards}`} />
            </StatGroup>
            <StatGroup icon={<HelpCircle size={16} />} title="クイズ">
              <Stat label="回数" value={`${quizzes.length}`} />
              <Stat label="平均正答率" value={avgRate === null ? '—' : `${avgRate}%`} />
            </StatGroup>
            <StatGroup icon={<Gamepad2 size={16} />} title="プレイ">
              <Stat label="回数" value={`${games.length}`} />
              <Stat label="最高連続正解" value={`${bestStreak}`} icon={<Flame size={13} style={{ color: 'var(--palace)' }} />} />
            </StatGroup>
          </div>

          {/* 履歴 */}
          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">履歴（{records.length}）</h2>
            {confirming ? (
              <span className="flex items-center gap-2 text-sm">
                <button type="button" className="text-destructive" onClick={() => { clear(); setConfirming(false) }}>消去する</button>
                <button type="button" className="text-muted-foreground" onClick={() => setConfirming(false)}>キャンセル</button>
              </span>
            ) : (
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setConfirming(true)}>
                履歴をクリア
              </button>
            )}
          </div>

          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {records.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: 'rgba(198,167,94,0.12)', color: 'var(--palace)' }}
                >
                  {modeLabel(r)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.targetLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.date)}
                    {r.format ? ` ・ ${r.format}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{metric(r)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function StatGroup({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <span style={{ color: 'var(--palace)' }}>{icon}</span>
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
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
