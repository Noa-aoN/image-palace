'use client'

import Link from 'next/link'
import { AlertTriangle, Coins } from 'lucide-react'
import { CREDIT_UNIT_SHORT } from '@/lib/billing'
import { balanceLabel, costLabel, creditCost } from '@/lib/billing/credit-cost'

/**
 * これから使うクレジットを、**押す前に**置く。
 *
 * 前は足りないときだけ出していた。足りている人は最後まで単価を知らないまま使うことになり、
 * 減ってから初めて「何に使われたのか」を探すことになる。
 *
 * **⚠ は乱用しない。** 1枚1クレジットは決まりごとであって異常ではないので、
 * 普段は硬貨の印と平文で置く。印を強めるのは、足りないときと、
 * いちどに沢山使うときだけ。
 */
export function CreditCostNote({
  cost,
  available,
  className,
  variant = 'box',
}: {
  cost: number
  available: number | null
  className?: string
  /**
   * `inline` は枠を持たない1行。**縦に伸ばしたくない場所**（釦の隣など）で使う。
   * 出す中身は同じで、置き方だけが違う。
   */
  variant?: 'box' | 'inline'
}) {
  const c = creditCost({ cost, available })
  const text = costLabel(c, CREDIT_UNIT_SHORT)
  if (!text) return null

  const balance = balanceLabel(c, CREDIT_UNIT_SHORT)
  const strong = c.tone !== 'plain'

  if (variant === 'inline') {
    return (
      <p className={`text-xs ${c.sufficient ? 'text-muted-foreground' : 'text-destructive'} ${className ?? ''}`}>
        <span className={c.sufficient ? 'text-foreground' : undefined}>{text}</span>
        {balance && <span className="ml-1.5">{balance}</span>}
        {!c.sufficient && (
          <>
            <span className="ml-1.5">クレジットが足りません。</span>
            <Link href="/billing" className="ml-1 underline underline-offset-2">
              プランを見る
            </Link>
          </>
        )}
      </p>
    )
  }

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
        c.tone === 'blocked'
          ? 'border-destructive/40 bg-destructive/5 text-destructive'
          : c.tone === 'caution'
            ? 'border-amber-300 bg-amber-50/60 text-amber-900'
            : 'border-border/70 bg-muted/40 text-muted-foreground'
      } ${className ?? ''}`}
    >
      <span className="mt-0.5 shrink-0">
        {strong ? <AlertTriangle size={14} aria-hidden /> : <Coins size={14} aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className={c.tone === 'plain' ? 'font-medium text-foreground' : 'font-medium'}>{text}</span>
        {balance && <span className="ml-1.5">{balance}</span>}
        {!c.sufficient && (
          <>
            <br />
            クレジットが足りません。
            <Link href="/billing" className="ml-1 underline underline-offset-2">
              プランを見る
            </Link>
          </>
        )}
      </span>
    </div>
  )
}
