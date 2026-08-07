'use client'

import { Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { useBillingStore } from '@/stores/billing'
import { CREDIT_UNIT, CREDIT_UNIT_SHORT } from '@/lib/billing'

export const CREDIT_BREAKDOWN_PANEL_KEY = 'credit-breakdown'

/**
 * 残高の内訳。**期限が近い順＝使われる順**に並べる。
 *
 * 合計だけ見ても「いつ消えるのか」が分からず、使い切る判断ができない。
 * サブスクの当月分・買い切り・付与が同じ数字に溶けているので、
 * どれから減るのかも読めない。
 *
 * **同じ種類でも、期限が違えば1件ずつ並ぶ**（買い切りを2回買えば2行）。
 * まとめてしまうと、どれがいつ消えるのかが分からなくなる。
 * そのぶん同じラベルが続くので、日付を主役にして読み分けられるようにする。
 *
 * 並べ替えはサーバー側で済んでいる（credit_buckets）。ここは出すだけ。
 */
export function CreditBreakdownPanel() {
  const summary = useBillingStore((s) => s.summary)
  const buckets = summary?.credit_buckets ?? []

  return (
    <PanelSlotContent sectionKey={CREDIT_BREAKDOWN_PANEL_KEY}>
      <div className="space-y-4">
        {summary === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={14} />
            読み込み中…
          </p>
        ) : (
          <>
            <div>
              <p className="text-xs text-muted-foreground">使えるクレジット</p>
              <p className="text-3xl font-bold">
                {summary.available_credits}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{CREDIT_UNIT}</span>
              </p>
            </div>

            {buckets.length === 0 ? (
              <p className="text-sm text-muted-foreground">内訳はありません。</p>
            ) : (
              <ol className="space-y-1.5">
                {buckets.map((bucket, index) => (
                  <li
                    key={`${bucket.kind}-${bucket.expires_at ?? 'none'}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-2"
                  >
                    <div className="flex min-w-0 items-baseline gap-2">
                      {/* 使われる順に番号を振る。同じラベルが続いても、どれの話か指せる */}
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                      <div className="min-w-0">
                        {/* 日付を主役にする。同じ種類が並ぶとき、違うのは期限だけ */}
                        <p className="text-sm font-medium">
                          {bucket.expires_at
                            ? `${new Date(bucket.expires_at).toLocaleDateString('ja-JP')} まで`
                            : '期限なし'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{bucket.label}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {bucket.credits} {CREDIT_UNIT_SHORT}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <p className="text-xs leading-relaxed text-muted-foreground">
              上から順に使われます（期限が近いものから）。
              <br />
              クレジットは受け取ってから6か月間有効です。
            </p>
          </>
        )}
      </div>
    </PanelSlotContent>
  )
}

/** 残高詳細を開くボタン。パネルの中身は CreditBreakdownPanel が差し込む */
export function CreditBreakdownButton({ className }: { className?: string }) {
  const panel = usePanelForm(CREDIT_BREAKDOWN_PANEL_KEY, '残高の内訳')

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={panel.open}
      aria-expanded={panel.isOpen}
      className={`flex items-center gap-1.5 ${className ?? ''}`}
    >
      <Coins size={14} />
      残高の内訳
    </Button>
  )
}
