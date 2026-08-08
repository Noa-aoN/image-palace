'use client'

import Link from 'next/link'
import { ChevronRight, Crown, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CardImage } from '@/components/ui/card-image'
import { useAuthStore } from '@/stores/auth'
import { tierLabel } from '@/lib/billing'
import { displayNameOf } from '@/lib/display-name'

/**
 * 「宮殿の主人」。生成資産（クレジット）の隣に並べる、本人のステータス面。
 *
 * いまは名前・アバター・プラン・権限を出す。称号や実績は将来ここへ足す想定で、
 * 空きが目立たないよう「称号」の行はプレースホルダを置いている。
 */
export function PalaceLordCard({ tier }: { tier: string | null }) {
  const user = useAuthStore((s) => s.user)
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
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Crown size={18} style={{ color: 'var(--palace)' }} />
                主人
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
                <p className="truncate text-lg font-semibold">{displayName}</p>
                {/* メールアドレスは出さない。行数を保つため、同じ位置に入居日を置く */}
                <p className="truncate text-xs text-muted-foreground">入居 {movedInOn}</p>
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
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">称号</dt>
                {/* 実績に応じた称号は今後付与する。空欄が寂しくならないよう説明を出す */}
                <dd className="text-xs text-muted-foreground">宮殿を育てると授けられます</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </Link>
    </section>
  )
}
