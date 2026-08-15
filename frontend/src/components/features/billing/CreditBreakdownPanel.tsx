'use client'

import { AlertTriangle, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HelpPopover } from '@/components/ui/help-popover'
import { Spinner } from '@/components/ui/spinner'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { useBillingStore } from '@/stores/billing'
import { CREDIT_UNIT, CREDIT_UNIT_SHORT, CREDIT_VALIDITY_LABEL, expiryUrgencyLabel } from '@/lib/billing'

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
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                使えるクレジット
                {/* 仕組みが分かりにくいところに `?` を置く。
                    残高の数字だけでは、なぜ減るのか・いつ消えるのかが分からない */}
                <HelpPopover label="クレジットについて" title="クレジット">
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">何に使うか</dt>
                      <dd>絵を1枚つくるたびに 1 消費します。文章のAIは、使った量に応じて少しずつ引かれます。</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">どこから来るか</dt>
                      <dd>登録時のお試し・毎月の無料枠・プランの付与・買い切り・引き換えコード。</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">期限</dt>
                      <dd>
                        受け取ってから{CREDIT_VALIDITY_LABEL}です。<strong>期限の近いものから先に使われます</strong>。
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">同じ言葉は二度作らない</dt>
                      <dd>誰かが作った絵と同じ言葉なら、作り直さずその絵を使います（待ち時間もかかりません）。</dd>
                    </div>
                  </dl>
                </HelpPopover>
              </p>
              <p className="text-3xl font-bold">
                {summary.available_credits}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{CREDIT_UNIT}</span>
              </p>
            </div>

            {buckets.length === 0 ? (
              <p className="text-sm text-muted-foreground">内訳はありません。</p>
            ) : (
              <ol className="space-y-1.5">
                {buckets.map((bucket, index) => {
                  // 期限が近いものだけ印を出す。**全部に出すと、どれが急ぎか分からなくなる**
                  const urgency = expiryUrgencyLabel(bucket.expires_at)

                  return (
                  <li
                    key={`${bucket.kind}-${bucket.expires_at ?? 'none'}-${index}`}
                    className={`flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 ${
                      urgency ? 'border-amber-300 bg-amber-50/60' : 'border-border/70'
                    }`}
                  >
                    <div className="flex min-w-0 items-baseline gap-2">
                      {/* 使われる順に番号を振る。同じラベルが続いても、どれの話か指せる */}
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                      <div className="min-w-0">
                        {/* 日付を主役にする。同じ種類が並ぶとき、違うのは期限だけ */}
                        <p className="flex items-center gap-1.5 text-sm font-medium">
                          {bucket.expires_at
                            ? `${new Date(bucket.expires_at).toLocaleDateString('ja-JP')} まで`
                            : '期限なし'}
                          {urgency && (
                            // 色だけで急ぎを伝えない（色が見分けられない人にも届くように、印と言葉を添える）
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
                              <AlertTriangle size={11} aria-hidden />
                              {urgency}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{bucket.label}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {bucket.credits} {CREDIT_UNIT_SHORT}
                    </span>
                  </li>
                  )
                })}
              </ol>
            )}

            <p className="text-xs leading-relaxed text-muted-foreground">
              上から順に使われます（期限が近いものから）。
              <br />
              クレジットは受け取ってから{CREDIT_VALIDITY_LABEL}間有効です。
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
