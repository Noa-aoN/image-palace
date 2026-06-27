'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GLOBAL_ACTIONS } from './nav-items'

interface Props {
  // 縦並び（折りたたみサイドバーの狭い幅）にするか。
  vertical?: boolean
  onNavigate?: () => void
}

/**
 * 場所に属さない横断操作（横断検索・タグ）をアイコンのみで並べるグローバル操作。
 * デスクトップのトグル行とモバイルドロワーのヘッダーで共有する。
 * アイコンのみ表示のため aria-label / title(tooltip) / focus リング / 40px タップ領域を備える。
 */
export function GlobalActions({ vertical = false, onNavigate }: Props) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className={`flex gap-1 ${vertical ? 'flex-col items-center' : 'flex-row'}`}>
      {GLOBAL_ACTIONS.map((action) => {
        const href = action.href ?? '#'
        return (
          <Link
            key={action.label}
            href={href}
            onClick={onNavigate}
            aria-label={action.label}
            title={action.label}
            className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
            style={{
              color: isActive(href) ? 'var(--palace)' : 'inherit',
              backgroundColor: isActive(href) ? 'rgba(198,167,94,0.1)' : undefined,
            }}
          >
            {action.icon}
          </Link>
        )
      })}
    </div>
  )
}
