'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Layers, HelpCircle, Gamepad2, Flame, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/features/study/StatCard'
import { useStudyRecordStore, type StudyRecord, type StudyGameKind } from '@/stores/studyRecords'
import { bodyFor } from '@/lib/page-help'

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

// スタディの種類（プラクティス／クイズ／プレイ）
function typeLabel(r: StudyRecord): string {
  if (r.mode === 'practice') return 'プラクティス'
  if (r.mode === 'quiz') return 'クイズ'
  return 'プレイ'
}

// その中の内容（プレイ＝ゲーム種類 / クイズ＝出題形式）。無ければ空。
function contentLabel(r: StudyRecord): string {
  if (r.mode === 'game') return r.game ? GAME_LABELS[r.game] : ''
  if (r.mode === 'quiz') return r.format ?? ''
  return ''
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
  // 復元前は records が空なので、そのまま描くと記録があっても空の案内が出る
  const hydrated = useStudyRecordStore((s) => s.hydrated)
  const clear = useStudyRecordStore((s) => s.clear)
  const [confirming, setConfirming] = useState(false)

  const { practice, quizzes, games, practiceCards, avgRate, bestStreak } = useMemo(() => {
    const p = records.filter((r) => r.mode === 'practice')
    const q = records.filter((r) => r.mode === 'quiz')
    const g = records.filter((r) => r.mode === 'game')
    const quizQ = q.reduce((s, r) => s + r.total, 0)
    const quizC = q.reduce((s, r) => s + r.correct, 0)
    return {
      practice: p,
      quizzes: q,
      games: g,
      practiceCards: p.reduce((s, r) => s + r.total, 0),
      avgRate: quizQ > 0 ? Math.round((quizC / quizQ) * 100) : null,
      bestStreak: g.filter((r) => r.game === 'streak').reduce((m, r) => Math.max(m, r.total), 0),
    }
  }, [records])

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Breadcrumb items={[{ href: '/study', label: 'スタディ' }, { label: 'レコード' }]} />
      <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
        <BarChart3 size={26} style={{ color: 'var(--palace)' }} />
        レコード
      </h1>
      <p className="mt-2 text-muted-foreground">{bodyFor('/study/record')}</p>

      {!hydrated ? (
        <div className="mt-8 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : records.length === 0 ? (
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
              <StatCard label="回数" value={`${practice.length}`} />
              <StatCard label="見返した枚数" value={`${practiceCards}`} />
            </StatGroup>
            <StatGroup icon={<HelpCircle size={16} />} title="クイズ">
              <StatCard label="回数" value={`${quizzes.length}`} />
              <StatCard label="平均正答率" value={avgRate === null ? '—' : `${avgRate}%`} />
            </StatGroup>
            <StatGroup icon={<Gamepad2 size={16} />} title="プレイ">
              <StatCard label="回数" value={`${games.length}`} />
              <StatCard label="最高連続正解" value={`${bestStreak}`} icon={<Flame size={13} style={{ color: 'var(--palace)' }} />} />
            </StatGroup>
          </div>

          {/* グラフ */}
          <div className="mt-8 space-y-6">
            <ActivityChart records={records} />
            {quizzes.length > 0 && <AccuracyTrend quizzes={quizzes} />}
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
                {/* スタディの種類＋その中の内容 */}
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <Badge variant="palace">{typeLabel(r)}</Badge>
                  {contentLabel(r) && <Badge variant="muted">{contentLabel(r)}</Badge>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.targetLabel}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.date)}</p>
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

function sameDay(iso: string, d: Date): boolean {
  const x = new Date(iso)
  return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate()
}

const mdLabel = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

// 直近2週間の学習回数（日別）バーチャート
function ActivityChart({ records }: { records: StudyRecord[] }) {
  const { days, counts, max } = useMemo(() => {
    const now = new Date()
    const ds: Date[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      ds.push(d)
    }
    const cs = ds.map((d) => records.filter((r) => sameDay(r.date, d)).length)
    return { days: ds, counts: cs, max: Math.max(1, ...cs) }
  }, [records])
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">学習アクティビティ（直近2週間）</h2>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex h-24 items-end gap-1.5">
          {days.map((d, i) => (
            <div
              key={i}
              className="flex-1 rounded-t transition-[height]"
              title={`${mdLabel(d)}：${counts[i]}回`}
              style={{
                height: `${counts[i] === 0 ? 3 : Math.max(8, (counts[i] / max) * 88)}px`,
                backgroundColor: counts[i] === 0 ? 'var(--border)' : 'var(--palace)',
              }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>{mdLabel(days[0])}</span>
          <span>今日</span>
        </div>
      </div>
    </div>
  )
}

// クイズ正答率の推移（直近最大12回）バーチャート
function AccuracyTrend({ quizzes }: { quizzes: StudyRecord[] }) {
  const recent = [...quizzes]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-12)
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">クイズ正答率の推移（直近{recent.length}回）</h2>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex h-24 items-end gap-1.5">
          {recent.map((r) => {
            const rate = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0
            return (
              <div
                key={r.id}
                className="flex-1 rounded-t"
                title={`${rate}%`}
                style={{ height: `${Math.max(6, (rate / 100) * 88)}px`, backgroundColor: 'var(--palace)' }}
              />
            )
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>古い</span>
          <span>最新（{recent.length > 0 ? Math.round((recent[recent.length - 1].correct / Math.max(1, recent[recent.length - 1].total)) * 100) : 0}%）</span>
        </div>
      </div>
    </div>
  )
}
