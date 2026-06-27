'use client'

import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useUiStore } from '@/stores/ui'
import { SidebarNav } from './SidebarNav'

export function Sidebar() {
  const { sidebarExpanded, toggleSidebar } = useUiStore()

  return (
    <aside
      // モバイル（<md）では非表示にし、ヘッダーのハンバーガー（MobileNav）を使う
      className="hidden md:flex flex-col shrink-0 overflow-y-auto transition-[width] duration-200"
      style={{
        width: sidebarExpanded ? '240px' : '72px',
        backgroundColor: 'var(--ivory)',
        borderRight: '1px solid var(--palace)',
      }}
    >
      {/* 折りたたみトグル */}
      <div className={`flex items-center pt-4 pb-2 px-3 ${sidebarExpanded ? 'justify-end' : 'justify-center'}`}>
        <button
          onClick={toggleSidebar}
          className="rounded p-1.5 hover:bg-black/5 transition-colors"
          aria-label={sidebarExpanded ? 'サイドバーを折りたたむ' : 'サイドバーを展開する'}
        >
          {sidebarExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {/* セクション付きナビ（ライブラリ/アトリエは開閉） */}
      <nav className="pt-2 pb-4">
        <SidebarNav iconsOnly={!sidebarExpanded} />
      </nav>
    </aside>
  )
}
