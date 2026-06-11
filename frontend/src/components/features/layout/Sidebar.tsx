'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, ChevronLeft, LayoutDashboard, GalleryHorizontal, Plus, Layers, LibraryBig } from 'lucide-react'
import { useUiStore } from '@/stores/ui'

interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: <LayoutDashboard size={22} />, label: 'ダッシュボード' },
  { href: '/items', icon: <GalleryHorizontal size={22} />, label: 'マイカード' },
  { href: '/library', icon: <LibraryBig size={22} />, label: 'ライブラリ' },
  { href: '/collections', icon: <Layers size={22} />, label: 'コレクション' },
  { href: '/items/new', icon: <Plus size={22} />, label: 'カードを作成' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarExpanded, toggleSidebar } = useUiStore()

  return (
    <aside
      className="flex flex-col shrink-0 overflow-y-auto transition-[width] duration-200"
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

      {/* ナビゲーション */}
      <nav className={`flex flex-col gap-1 pt-2 ${sidebarExpanded ? 'px-2' : 'px-1.5'}`}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex rounded-lg py-2.5 text-sm font-medium transition-colors hover:bg-black/5 ${
                sidebarExpanded ? 'items-center gap-3 px-2' : 'items-center justify-center px-0'
              }`}
              style={{
                color: isActive ? 'var(--palace)' : 'inherit',
                backgroundColor: isActive ? 'rgba(198,167,94,0.1)' : undefined,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
              title={!sidebarExpanded ? item.label : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              {sidebarExpanded && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
