'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PenLine, Sparkles, GalleryVerticalEnd, Loader2, ChevronRight, Coins, CreditCard, CheckCircle2, DoorOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MemoryAssetsCard } from '@/components/features/dashboard/MemoryAssetsCard'
import { PalaceFloorplan } from '@/components/features/dashboard/PalaceFloorplan'
import { PalaceLordCard } from '@/components/features/dashboard/PalaceLordCard'
import { QuickCreateCard } from '@/components/features/dashboard/QuickCreateCard'
import { getItemsSummary, type ItemsSummary } from '@/lib/api/items'
import { useBillingStore } from '@/stores/billing'
import { generatableCards } from '@/lib/credits'
import { tierLabel, CREDIT_UNIT, CREDIT_UNIT_SHORT } from '@/lib/billing'

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
  boxes_count: 0,
  views_count: 0,
  spaces_count: 0,
  monthly_count: 0,
  monthly_limit: 0,
  monthly_remaining: 0,
}

// クレジットメーターの進捗率（残高 / 今期付与, 0〜100）。付与枠が無い/不明なら null。
// 1生成＝1クレジットのため、残高がそのまま「あと何枚つくれるか」になる。
function creditPercent(available: number, perPeriod: number): number | null {
  if (perPeriod <= 0) return null
  return Math.min(100, Math.round((available / perPeriod) * 100))
}


// クレジット更新日（次回付与日）を "YYYY/M/D" に整形。null/不正は null。
function formatRenewal(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

type BatchProgress = { total: number; success: number; failed: number; remaining: number; done: boolean }
const WORK_POLL_MS = 3000

export function DashboardContent() {
  const [summary, setSummary] = useState<ItemsSummary | null>(null)
  const [progress, setProgress] = useState<BatchProgress | null>(null)
  const billing = useBillingStore((s) => s.summary)
  const fetchBilling = useBillingStore((s) => s.fetchSummary)
  // 「作業状況」バッチ進捗：生成中の総数を基準に 成功/失敗/残り をリアルタイム表示。
  const sessionRef = useRef<{ total: number; baseFailed: number } | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchBilling()
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const apply = (data: ItemsSummary) => {
      setSummary(data)
      const inProgress = data.pending_count + data.processing_count
      if (inProgress > 0 && !sessionRef.current) {
        // 新しい作業セッション開始（既存の失敗数を基準にする）
        sessionRef.current = { total: 0, baseFailed: data.failed_count }
        if (clearTimerRef.current) {
          clearTimeout(clearTimerRef.current)
          clearTimerRef.current = null
        }
      }
      const session = sessionRef.current
      if (!session) return

      const failed = Math.max(0, data.failed_count - session.baseFailed)
      session.total = Math.max(session.total, inProgress + failed)
      const success = Math.max(0, session.total - inProgress - failed)
      setProgress({ total: session.total, success, failed, remaining: inProgress, done: inProgress === 0 })

      if (inProgress === 0) {
        sessionRef.current = null
        // 完了表示を少し残してから消す
        clearTimerRef.current = setTimeout(() => {
          if (!cancelled) setProgress(null)
        }, 8000)
      }
    }

    const tick = async () => {
      if (cancelled) return
      const data = await getItemsSummary().catch(() => null)
      if (cancelled) return
      if (data) {
        apply(data)
        if (data.pending_count + data.processing_count > 0) timer = setTimeout(tick, WORK_POLL_MS)
      } else {
        setSummary((prev) => prev ?? EMPTY_SUMMARY)
      }
    }
    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
    }
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
          <CardContent className="space-y-4">
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

  const credits = billing?.available_credits ?? null
  const perPeriod = billing?.plan?.credits_per_period ?? 0
  const cards = credits !== null ? generatableCards(credits) : null
  const creditPct = cards !== null ? creditPercent(cards, perPeriod) : null
  // 有料はサブスク期末、無料は次回クレジット回復日（翌月初）。どちらも「M/D に更新」で表示する。
  const renewal = formatRenewal(billing?.subscription?.current_period_end ?? billing?.next_credit_reset)

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
        <DoorOpen size={26} style={{ color: 'var(--palace)' }} />
        エントランス
      </h1>

      {/* 宮殿の生成資産（残高・生成可能枚数・プラン）と、宮殿の主人（本人のステータス）を左右に並べる */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
      <section className="flex flex-col space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">宮殿の生成資産</h2>
        <Link
          href="/billing"
          aria-label="プランと利用状況を見る"
          className="group block flex-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
        >
          <Card className="h-full cursor-pointer transition hover:border-[var(--palace)] hover:shadow-md">
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CreditCard size={18} style={{ color: 'var(--palace)' }} />
                    プラン
                  </p>
                  <ChevronRight
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                    style={{ color: 'var(--palace)' }}
                  />
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <p className="text-lg font-semibold">{tierLabel(billing?.plan?.tier ?? 'free')}</p>
                  {renewal && <span className="text-xs text-muted-foreground">{renewal} に更新</span>}
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Coins size={18} style={{ color: 'var(--palace)' }} />
                  残高
                </p>
                <p className="mt-1">
                  <span className="text-3xl font-bold tabular-nums">{credits ?? '—'}</span>
                  <span className="ml-1 text-sm text-muted-foreground">{CREDIT_UNIT}（{CREDIT_UNIT_SHORT}）</span>
                </p>
              </div>

              <div className="space-y-2">
                {creditPct !== null && (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">生成可能カードの枚数目安</span>
                      <span>
                        <span className="text-base font-semibold tabular-nums">{cards}</span>
                        <span className="text-sm text-muted-foreground"> / {perPeriod} 枚</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${creditPct}%`, backgroundColor: 'var(--palace)' }}
                      />
                    </div>
                  </>
                )}
              </div>

              {credits !== null && credits <= 0 && (
                <p className="text-xs text-destructive">
                  クレジットがありません。プランのアップグレードかクレジット追加で生成を続けられます。
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      </section>

      <PalaceLordCard tier={billing?.plan?.tier ?? null} />
      </div>

      {/* 作業状況（生成中バッチの進捗、または失敗があるときだけ表示。3秒ポーリングで更新） */}
      {(progress || summary.failed_count > 0) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">作業状況</h2>
          <Link
            href="/items"
            aria-label="作業状況を見る"
            className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
          >
            <Card className="cursor-pointer transition hover:border-[var(--palace)] hover:shadow-md">
              <CardContent>
                {progress ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        {progress.done ? (
                          <CheckCircle2 size={18} style={{ color: 'var(--palace)' }} />
                        ) : (
                          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--palace)' }} />
                        )}
                        {progress.done ? '生成が完了しました' : '画像を生成中…'}
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {progress.success + progress.failed} / {progress.total} 完了
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[var(--palace)] transition-all duration-500"
                        style={{
                          width: `${progress.total > 0 ? Math.round(((progress.success + progress.failed) / progress.total) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">
                        成功 <b className="text-foreground tabular-nums">{progress.success}</b>
                      </span>
                      <span className="text-muted-foreground">
                        失敗 <b className={`tabular-nums ${progress.failed > 0 ? 'text-destructive' : 'text-foreground'}`}>{progress.failed}</b>
                      </span>
                      {!progress.done && (
                        <span className="text-muted-foreground">
                          残り <b className="text-foreground tabular-nums">{progress.remaining}</b>
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">
                      <span className="text-destructive">失敗 {summary.failed_count} 件</span>
                      <span className="ml-1 text-muted-foreground">（タップして再生成）</span>
                    </span>
                    <ChevronRight
                      size={16}
                      className="transition-transform group-hover:translate-x-0.5"
                      style={{ color: 'var(--palace)' }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        </section>
      )}

      {/* 記憶資産・間取り図（横並びで全幅を使う） */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        {/* 記憶資産（種類ごとの積み上げ。各列クリックで一覧へ）。カード高さは間取り図に合わせる */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">宮殿の記憶資産</h2>
          <MemoryAssetsCard summary={summary} className="flex-1" />
        </section>

        {/* 宮殿の間取り（主要な場所への地図的な導線） */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">宮殿の間取り図</h2>
          <PalaceFloorplan />
        </section>
      </div>

      {/* クイック作成: エントランスでそのまま単語を入れて即生成する */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">クイック作成</h2>
        <QuickCreateCard />
      </section>
    </div>
  )
}
