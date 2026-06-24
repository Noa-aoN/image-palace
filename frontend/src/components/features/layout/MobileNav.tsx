'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Castle } from 'lucide-react'
import { NAV_TREE, type NavNode } from './nav-items'

/**
 * モバイル（<md）用のナビゲーション。ヘッダー左のハンバーガーで
 * 左からスライドインするドロワーを開く。リンク選択・背景タップ・ESC で閉じる。
 * ビュー/スペースは親子の入れ子ツリーで表示する。
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const renderLink = (node: NavNode, nested = false) => {
    const href = node.href ?? '#'
    const active = isActive(href)
    return (
      <Link
        key={node.label}
        href={href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors hover:bg-black/5 ${
          nested ? 'pl-9 pr-3' : 'px-3'
        }`}
        style={{
          color: active ? 'var(--palace)' : 'inherit',
          backgroundColor: active ? 'rgba(198,167,94,0.1)' : undefined,
        }}
      >
        <span className="shrink-0">{node.icon}</span>
        <span className="truncate">{node.label}</span>
      </Link>
    )
  }

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
              {/* ロゴは仮置き（宮殿アイコン） */}
              <Castle size={28} style={{ color: 'var(--palace)' }} aria-label="ImagePalace" />
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1.5 hover:bg-black/5 transition-colors"
                aria-label="メニューを閉じる"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex flex-col gap-1 px-2 pt-2">
              {NAV_TREE.map((node) => {
                if (!node.children) return renderLink(node)
                // 親もリンク。配下の子を字下げで入れ子表示する。
                return (
                  <div key={node.label} className="flex flex-col gap-1">
                    {renderLink(node)}
                    {node.children.map((child) => renderLink(child, true))}
                  </div>
                )
              })}
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
