'use client'

import { Crown } from 'lucide-react'
import { AchievementsBoard } from '@/components/features/achievements/AchievementsBoard'
import { bodyFor } from '@/lib/page-help'

/**
 * アチーブメント。
 *
 * ページ名は「アチーブメント」に統一する。「トロフィー」は宝物アイテムの一種であって、
 * 場所の名前ではない。
 */
export default function AchievementsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 space-y-8">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <Crown size={26} style={{ color: 'var(--palace)' }} />
          アチーブメント
        </h1>
        <p className="mt-2 text-muted-foreground">{bodyFor('/achievements')}</p>
      </div>

      <AchievementsBoard />
    </div>
  )
}
