'use client'

import { useState } from 'react'
import { Check, ChevronDown, Lock, Route } from 'lucide-react'
import type { MissionSeries } from '@/lib/api/achievements'
import { RewardPreviews } from './RewardPreviews'

/**
 * ミッションのシリーズ。順に開けていく1本の道。
 *
 * 畳んだ状態では**いま挑んでいる1段だけ**を出す。
 * 全段を並べると、長い道は「終わらない宿題」に見える。
 * かといって次の段しか見せないと、先があること自体が伝わらないので、
 * 開けば道のり全体を見られるようにしておく。
 *
 * 別画面や右パネルには出さない。同じものを2か所に置くと、必ず片方が古くなる。
 */
export function MissionSeriesCard({ series }: { series: MissionSeries }) {
  const [open, setOpen] = useState(false)
  const done = series.completed_steps >= series.total_steps

  return (
    <li className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <Route size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--palace)' }} />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="font-medium">{series.name}</span>
            <span className="tabular-nums text-sm text-muted-foreground">
              {series.completed_steps} / {series.total_steps} 段
            </span>
          </div>

          {/* 畳んだままでも、いま何をすればよいかは分かるようにする */}
          {series.current ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm text-muted-foreground">{series.current.name}</span>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {series.current.progress} / {series.current.target}
                </span>
              </div>
              <Bar value={series.current.progress} max={series.current.target} />
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--palace)' }}>
              {done ? 'この道は歩き終えました' : ''}
            </p>
          )}
        </div>

        <ChevronDown
          size={16}
          className={`mt-0.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ol className="space-y-2 border-t border-border px-4 py-3">
          {series.steps.map((step) => (
            <li key={step.key} className="flex items-start gap-2.5">
              <StepMark state={step.state} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span
                    className={
                      step.state === 'done'
                        ? 'text-sm text-muted-foreground line-through'
                        : step.state === 'current'
                          ? 'text-sm font-medium'
                          : 'text-sm text-muted-foreground'
                    }
                  >
                    {step.name}
                  </span>
                  {step.state === 'current' && (
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {step.progress} / {step.target}
                    </span>
                  )}
                </div>
                {/* これからの段も条件は出す。何が待っているか分からない道は歩けない */}
                {step.description && step.state !== 'done' && (
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                )}
                <RewardPreviews rewards={step.rewards} earned={step.state === 'done'} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}

function StepMark({ state }: { state: 'done' | 'current' | 'locked' }) {
  if (state === 'done') {
    return (
      <span
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--palace)', color: 'white' }}
      >
        <Check size={11} />
      </span>
    )
  }

  if (state === 'current') {
    return (
      <span
        className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2"
        style={{ borderColor: 'var(--palace)' }}
        aria-label="いま挑んでいる段"
      />
    )
  }

  return <Lock size={13} className="mt-1 shrink-0 text-muted-foreground" aria-label="これから開く段" />
}

function Bar({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, backgroundColor: 'var(--palace)' }} />
    </div>
  )
}
