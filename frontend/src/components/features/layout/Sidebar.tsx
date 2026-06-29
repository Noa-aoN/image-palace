'use client'

import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useUiStore } from '@/stores/ui'
import { SidebarNav } from './SidebarNav'
import { GlobalActions } from './GlobalActions'

export function Sidebar() {
  const { sidebarExpanded, toggleSidebar } = useUiStore()

  return (
    <aside
      // モバイル（<md）では非表示にし、ヘッダーのハンバーガー（MobileNav）を使う
      // relative z-30: ページ内の sticky（z-10）より前面に置き、タブ等が被らないようにする
      className="relative z-30 hidden md:flex flex-col shrink-0 overflow-y-auto transition-[width] duration-200"
      style={{
        width: sidebarExpanded ? '240px' : '72px',
        backgroundColor: 'var(--ivory)',
        borderRight: '1px solid var(--palace)',
      }}
    >
      {/* 最上部の行: グローバル操作（検索・タグ）＋ 折りたたみトグル */}
      <div className={`flex pt-4 pb-2 px-3 ${sidebarExpanded ? 'items-center justify-between gap-2' : 'flex-col-reverse items-center gap-2'}`}>
        <GlobalActions vertical={!sidebarExpanded} />
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
