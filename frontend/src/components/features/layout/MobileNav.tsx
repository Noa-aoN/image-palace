'use client'

import { useEffect, useState } from 'react'
import { Menu, X, Castle } from 'lucide-react'
import { SidebarNav } from './SidebarNav'

/**
 * モバイル（<md）用のナビゲーション。ヘッダー左のハンバーガーで
 * 左からスライドインするドロワーを開く。リンク選択・背景タップ・ESC で閉じる。
 * 中身は SidebarNav（セクション＋開閉グループ）をデスクトップと共有する。
 */
export function MobileNav() {
  const [open, setOpen] = useState(false)

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
            className="absolute left-0 top-0 h-full w-64 flex flex-col overflow-y-auto py-3 shadow-xl"
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

            <div className="pt-2">
              <SidebarNav onNavigate={() => setOpen(false)} />
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
