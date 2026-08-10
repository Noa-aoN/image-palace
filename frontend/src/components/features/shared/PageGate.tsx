'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Clock, EyeOff } from 'lucide-react'
import { usePathStage } from '@/stores/features'
import { PrototypeBadge } from '@/components/features/shared/FeatureGate'

/**
 * ページ本体を、運営が決めた段階で出す。
 *
 * サイドバーから消すだけでは足りない。URL を直に叩けば開けてしまうので、
 * 中身のほうも同じ段階に従わせる。
 *
 * 読み込み中は何も出さない。中身を先に出すと、隠すはずのページが一瞬見える。
 */
export function PageGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const stage = usePathStage(pathname)

  if (stage === undefined) return null

  if (stage === 'hidden') {
    return (
      <Notice icon={<EyeOff size={20} />} title="このページは公開されていません">
        いまは開けないようにしています。
      </Notice>
    )
  }

  if (stage === 'development') {
    return (
      <Notice icon={<Clock size={20} />} title="準備中です">
        作っている最中です。もう少しお待ちください。
      </Notice>
    )
  }

  if (stage === 'prototype') {
    return (
      <>
        <div className="mx-auto w-full max-w-7xl px-6 pt-4">
          <PrototypeBadge />
        </div>
        {children}
      </>
    )
  }

  return <>{children}</>
}

function Notice({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <div className="mb-3 flex justify-center" style={{ color: 'var(--palace)' }}>
        {icon}
      </div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
