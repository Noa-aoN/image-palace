'use client'

import Link from 'next/link'
import { AlertTriangle, Coins } from 'lucide-react'
import { AI_TEXT_COST, CREDIT_UNIT_SHORT } from '@/lib/billing'
import {
  afterBalanceLabel,
  balanceLabel,
  breakdownLabel,
  costLabel,
  creditCost,
  formatCredits,
  type CostLine,
} from '@/lib/billing/credit-cost'

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
/**
 * 押す釦のすぐ横に添える、ひと言だけの版。
 *
 * 文章の AI は 0.01cr と軽いので、残高の増減まで並べると釦より説明のほうが目立つ。
 * **いくら使うかだけ**を言い、足りないときにだけ色を変える。
 *
 * 画面ごとに自前で書かないこと。書き方が散ると、同じ 0.01cr が
 * 場所によって違う言い方になる。
 */
export function CreditCostHint({
  cost,
  available,
  className,
}: {
  cost: number
  available: number | null
  className?: string
}) {
  const c = creditCost({ cost, available })
  if (c.cost === 0) return null

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        c.sufficient ? 'text-muted-foreground' : 'text-destructive'
      } ${className ?? ''}`}
    >
      <Coins size={12} aria-hidden />
      <span className="whitespace-nowrap">
        {formatCredits(c.cost)} {CREDIT_UNIT_SHORT}
      </span>
      {!c.sufficient && (
        <Link href="/billing" className="underline underline-offset-2">
          クレジットが足りません
        </Link>
      )}
    </span>
  )
}

/**
 * 「0.01 cr／枚」。選ぶと費用が増える項目の名前の隣に置く小さな札。
 *
 * **絵以外にもお金がかかることは、選ぶ場所で言わないと伝わらない。**
 * 合計だけを下に出しても、どの選択が効いているのかが結び付かない。
 *
 * 札そのものは注意ではないので、色は付けない（既定でONの項目が
 * 赤く見えると、間違った設定をしているように読める）。
 */
export function AiCostBadge({ perCard = true }: { perCard?: boolean }) {
  return (
    <span
      className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-muted-foreground"
      title="画像生成とは別に、文章の AI を1回使います"
    >
      +{AI_TEXT_COST} {CREDIT_UNIT_SHORT}
      {perCard && '／枚'}
    </span>
  )
}

export function CreditCostNote({
  cost,
  available,
  className,
  variant = 'box',
  lines,
}: {
  cost: number
  available: number | null
  className?: string
  /**
   * `inline` は枠を持たない1行。**縦に伸ばしたくない場所**（釦の隣など）で使う。
   * `after` は残りだけを言う1行。書きながら数が動く場所で使う。
   * 出す中身の量だけが違い、計算はどれも同じ。
   */
  variant?: 'box' | 'inline' | 'after'
  /**
   * 内訳。**絵ぶん以外の費用があるときは必ず渡す。**
   *
   * 「1枚しか作っていないのに 1cr 以上減った」という問い合わせが実際に来ている。
   * 合計だけでは 1.04 の 0.04 がどこから来たのか読み取れない。
   */
  lines?: CostLine[]
}) {
  const c = creditCost({ cost, available })
  const breakdown = lines ? breakdownLabel(lines) : null
  const text = costLabel(c, CREDIT_UNIT_SHORT)
  if (!text) return null

  if (variant === 'after') {
    const after = afterBalanceLabel(c, CREDIT_UNIT_SHORT)
    if (!after) return null

    return (
      <p className={`text-xs ${c.sufficient ? 'text-muted-foreground' : 'text-destructive'} ${className ?? ''}`}>
        <span className={`whitespace-nowrap ${c.sufficient ? 'text-foreground' : ''}`}>{after}</span>
        {!c.sufficient && (
          <Link href="/billing" className="ml-1.5 underline underline-offset-2">
            クレジットが足りません
          </Link>
        )}
      </p>
    )
  }

  const balance = balanceLabel(c, CREDIT_UNIT_SHORT)
  const strong = c.tone !== 'plain'

  if (variant === 'inline') {
    return (
      /* 折り返すなら句の切れ目で。「1 cr 使い / ます」のように
         数と単位や語の途中で切れると、読み直すことになる */
      <p className={`text-xs ${c.sufficient ? 'text-muted-foreground' : 'text-destructive'} ${className ?? ''}`}>
        <span className={`whitespace-nowrap ${c.sufficient ? 'text-foreground' : ''}`}>{text}</span>
        {balance && <span className="ml-1.5 whitespace-nowrap">{balance}</span>}
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
        <span className={`whitespace-nowrap font-medium ${c.tone === 'plain' ? 'text-foreground' : ''}`}>{text}</span>
        {balance && <span className="ml-1.5 whitespace-nowrap">{balance}</span>}
        {/* 内訳。**合計の真下に置く。** 離すと、数と出どころが結び付かない */}
        {breakdown && (
          <>
            <br />
            <span className="opacity-90">{breakdown}</span>
          </>
        )}
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
