'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Gem } from 'lucide-react'
import { getAchievementSummary, type AchievementSummary } from '@/lib/api/achievements'
import { RewardArt } from '@/components/features/achievements/RewardCard'
import { HelpPopover } from '@/components/ui/help-popover'
import { rewardKindHelp } from '@/lib/reward-kinds'

/**
 * 部屋に飾ってある宝物。
 *
 * **飾る仕組みは既にあった**（アチーブメントで星を入れると `room_placed` が立つ）。
 * ただし飾った先が無く、選んでも何も起きないように見えていた。ここがその置き場。
 *
 * 置く位置までは決められない（自由配置は別の話）。まずは「選んだものが、
 * 自分の部屋に並んでいる」ところまでを作る。
 */
export function RoomShowcase() {
  const [summary, setSummary] = useState<AchievementSummary | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAchievementSummary()
      .then((next) => {
        if (!cancelled) setSummary(next)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 読めなかったときは黙って畳む。飾りが出ないことより、
  // 部屋そのものが開かないほうが困る
  if (failed || summary === null) return null

  const treasures = summary.showcase?.treasure ?? []
  const help = rewardKindHelp('treasure')

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Gem size={16} style={{ color: 'var(--palace)' }} />
          飾っている宝物
        </h2>
        {help && (
          <HelpPopover label="宝物について" title={`${help.label}（${help.verb}）`}>
            <p className="text-sm">{help.description}</p>
          </HelpPopover>
        )}
        <Link href="/achievements" className="ml-auto text-xs text-muted-foreground hover:text-foreground">
          アチーブメントで選ぶ
        </Link>
      </div>

      {treasures.length === 0 ? (
        // 「ありません」で終わらせない。次に何をすればよいかを出す
        <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          まだ何も飾っていません。
          <Link href="/achievements" className="mx-1 underline hover:text-foreground">
            アチーブメント
          </Link>
          で、手に入れた宝物に星を入れると、ここに並びます。
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4">
          {treasures.map((reward) => (
            <li key={reward.key} className="flex w-20 flex-col items-center gap-1 text-center">
              <RewardArt reward={reward} size={48} />
              <span className="text-2xs leading-tight">
                {reward.name}
                {/* 2つ以上のときだけ数を出す（1個で ×1 と書くと、
                    重ねられないものまで数える対象に見える） */}
                {reward.quantity > 1 && (
                  <span className="ml-0.5 tabular-nums text-muted-foreground">×{reward.quantity}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
