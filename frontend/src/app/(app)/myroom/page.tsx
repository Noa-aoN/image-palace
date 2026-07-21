'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, CreditCard, UserCog, Settings, Trophy, Coins, House } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth'
import { useBillingStore } from '@/stores/billing'
import { tierLabel, CREDIT_UNIT } from '@/lib/billing'

const LINKS: { href: string; icon: ReactNode; label: string; description: string }[] = [
  { href: '/account', icon: <UserCog size={20} />, label: 'アカウント設定', description: 'プロフィール・ログイン連携・メール・退会。' },
  { href: '/billing', icon: <CreditCard size={20} />, label: 'プラン・支払い', description: 'プラン・クレジット・支払いの管理。' },
  { href: '/settings', icon: <Settings size={20} />, label: '環境設定', description: '生成・共有・連携・通知・データ管理。' },
  { href: '/trophy', icon: <Trophy size={20} />, label: 'トロフィー', description: '実績・バッジ・称号・活動記録。' },
]

export default function MyRoomPage() {
  const user = useAuthStore((s) => s.user)
  const billing = useBillingStore((s) => s.summary)
  const fetchBilling = useBillingStore((s) => s.fetchSummary)

  useEffect(() => {
    fetchBilling()
  }, [fetchBilling])

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
        <House size={26} style={{ color: 'var(--palace)' }} />
        マイルーム
      </h1>
      <p className="mt-2 text-muted-foreground">
        {user?.name ? `${user.name} さんの個人スペースです。` : 'あなたの個人スペースです。'}
      </p>

      {/* クレジット・プラン サマリー（カード全体で /billing へ） */}
      <Link
        href="/billing"
        aria-label="プランと利用状況を見る"
        className="group mt-6 block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
      >
        <Card className="cursor-pointer transition hover:border-[var(--palace)] hover:shadow-md">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Coins size={18} style={{ color: 'var(--palace)' }} />
                クレジット残高
              </p>
              <p className="mt-1">
                <span className="text-2xl font-bold tabular-nums">{billing ? billing.available_credits : '—'}</span>
                <span className="ml-1 text-sm text-muted-foreground">{CREDIT_UNIT}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">プラン</p>
                <p className="text-sm font-medium">{tierLabel(billing?.plan?.tier ?? 'free')}</p>
              </div>
              <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--palace)' }} />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* 個人設定への導線 */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-label={link.label}
            className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
          >
            <Card className="h-full cursor-pointer transition hover:border-[var(--palace)] hover:shadow-md">
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span style={{ color: 'var(--palace)' }}>{link.icon}</span>
                    {link.label}
                  </span>
                  <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--palace)' }} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{link.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
