'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useOpenCardCreate } from '@/components/features/items/CardCreatePanel'

/**
 * アトリエの「作る」入口の外枠。
 *
 * 画面を移らずその場で始められるものは右パネルで開き、
 * 専用ページが要るものはリンクのまま送る。
 * 中身（カードの見た目）は同じなので、包む要素だけをここで出し分ける。
 */
export function CreateActionShell({
  href,
  panel,
  label,
  children,
}: {
  href?: string
  panel?: 'card-create'
  label: string
  children: ReactNode
}) {
  const openCardCreate = useOpenCardCreate()
  const shell =
    'group block w-full text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]'

  if (panel === 'card-create') {
    return (
      <button type="button" onClick={openCardCreate} aria-label={label} className={shell}>
        {children}
      </button>
    )
  }

  return (
    <Link href={href ?? '#'} aria-label={label} className={shell}>
      {children}
    </Link>
  )
}
