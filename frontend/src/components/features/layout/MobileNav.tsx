'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { NAV_ITEMS } from './nav-items'

/**
 * モバイル（<md）用のナビゲーション。ヘッダー左のハンバーガーで
 * 左からスライドインするドロワーを開く。リンク選択・背景タップ・ESC で閉じる。
 */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden rounded p-1.5 hover:bg-black/5 transition-colors"
        aria-label="メニューを開く"
      >
        <Menu size={24} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* 背景オーバーレイ */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* ドロワー */}
          <nav
            className="absolute left-0 top-0 h-full w-64 flex flex-col py-3 shadow-xl"
            style={{ backgroundColor: 'var(--ivory)', borderRight: '1px solid var(--palace)' }}
            aria-label="ナビゲーション"
          >
            <div className="flex items-center justify-between px-3 pb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-palace.svg" alt="ImagePalace" width={32} height={32} />
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1.5 hover:bg-black/5 transition-colors"
                aria-label="メニューを閉じる"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex flex-col gap-1 px-2 pt-2">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-black/5"
                    style={{
                      color: isActive ? 'var(--palace)' : 'inherit',
                      backgroundColor: isActive ? 'rgba(198,167,94,0.1)' : undefined,
                    }}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
