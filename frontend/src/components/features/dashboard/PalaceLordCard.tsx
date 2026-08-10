'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Crown, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CardImage } from '@/components/ui/card-image'
import { useAuthStore } from '@/stores/auth'
import { tierLabel } from '@/lib/billing'
import { displayNameOf } from '@/lib/display-name'
import { getAchievementSummary, type AchievementSummary, type RewardKind } from '@/lib/api/achievements'
import { getSettings } from '@/lib/api/settings'

/**
 * 「宮殿の主人」。生成資産（クレジット）の隣に並べる、本人のステータス面。
 *
 * 名乗っている称号と掲げている勲章は、栄誉の間で選んだものがそのまま出る。
 * 選ぶ場所と出る場所が違うと、選んだ意味が伝わらない。
 *
 * 読むのは軽いほう（summary）。全体を読むと実績の数え直しまで走り、
 * 関係のないこの画面がその重さを抱えることになる。
 */
export function PalaceLordCard({ tier }: { tier: string | null }) {
  const user = useAuthStore((s) => s.user)
  const [honors, setHonors] = useState<AchievementSummary | null>(null)
  const [palaceName, setPalaceName] = useState<string | null>(null)

  useEffect(() => {
    getAchievementSummary()
      .then(setHonors)
      .catch(() => {})
    getSettings()
      .then((s) => setPalaceName(s.palace_name))
      .catch(() => {})
  }, [])

  const role = user?.role
  const displayName = displayNameOf(user)
  const avatar = user?.avatar_thumb_url ?? user?.avatar_url ?? null
  // 入居日＝アカウントを開いた日。取得前でも行の高さが変わらないよう「—」を置く
  const movedInOn = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  return (
    <section className="flex flex-col space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">宮殿の主人</h2>
      <Link
        href="/account"
        aria-label="アカウントの設定を見る"
        className="group block flex-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
      >
        <Card className="h-full cursor-pointer transition hover:border-[var(--palace)] hover:shadow-md">
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              {/* 宮殿の名前。付けていない人には既定の呼び方を出す。
                  「自分の宮殿」と言いながら名無しだと、ただの保管庫に見える */}
              <p className="flex items-center gap-2 truncate text-sm text-muted-foreground">
                <Crown size={18} className="shrink-0" style={{ color: 'var(--palace)' }} />
                {palaceName?.trim() || `${displayName}の宮殿`}
              </p>
              <ChevronRight
                size={18}
                className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
              />
            </div>

            <div className="flex items-center gap-3">
              <CardImage
                src={avatar}
                alt=""
                className="h-14 w-14 shrink-0 rounded-full border border-border"
                fallback={<Crown size={20} className="text-muted-foreground/60" />}
              />
              <div className="min-w-0">
                {/* 称号は名前の上に小さく。名前と同じ大きさで横に並べると、
                    どちらが本人の名前なのか分からなくなる */}
                {honors?.title && (
                  <p className="flex items-center gap-1 truncate text-xs" style={{ color: 'var(--palace)' }}>
                    {honors.title.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={honors.title.image_url} alt="" width={14} height={14} loading="lazy" />
                    )}
                    「{honors.title.name}」
                  </p>
                )}
                <p className="truncate text-lg font-semibold">{displayName}</p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">位</dt>
                <dd className="font-medium">{tier ? tierLabel(tier) : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">権限</dt>
                <dd className="flex items-center gap-1 font-medium">
                  {role === 'admin' && <ShieldCheck size={14} style={{ color: 'var(--palace)' }} />}
                  {role === 'admin' ? '管理者' : '主人'}
                </dd>
              </div>
              {/* 入居日は「位」と同じ並びに独立して置く。名前の下に埋めると、
                  本人を指す情報と宮殿の情報が混ざる */}
              <div>
                <dt className="text-xs text-muted-foreground">入居</dt>
                <dd className="font-medium">{movedInOn}</dd>
              </div>
              {/* 称号が無い人には、次に取れるものを出す */}
              {!honors?.title && honors?.next_title && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">称号</dt>
                  <dd className="text-xs text-muted-foreground">
                    {honors.next_title.condition ?? 'もう少し進める'}と「{honors.next_title.name}」
                  </dd>
                </div>
              )}
              {/* 記名板で星を入れたものを、種別ごとに出す */}
              {SHOWCASE_KINDS.map(([kind, label]) => {
                const rows = honors?.showcase?.[kind] ?? []
                if (rows.length === 0) return null
                return (
                  <div key={kind} className="col-span-2">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {rows.map((reward) =>
                        reward.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={reward.key}
                            src={reward.image_url}
                            alt={reward.name}
                            title={reward.name}
                            width={22}
                            height={22}
                            loading="lazy"
                          />
                        ) : (
                          <span key={reward.key} className="text-xs">
                            {reward.name}
                          </span>
                        )
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </CardContent>
        </Card>
      </Link>
    </section>
  )
}

// 記名板に出す種別と見出し。称号は名前の上に出すので、ここには含めない
const SHOWCASE_KINDS: [RewardKind, string][] = [
  ['medal', '勲章'],
  ['treasure', '褒賞'],
  ['honor', '表彰'],
]
