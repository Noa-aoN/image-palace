'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useUiStore } from '@/stores/ui'
import { NAV_GROUPS } from './nav-items'

export function Sidebar() {
  const pathname = usePathname()
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

      {/* ナビゲーション（グループ間は区切り線で整理） */}
      <nav className={`flex flex-col pt-2 ${sidebarExpanded ? 'px-2' : 'px-1.5'}`}>
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} className="flex flex-col gap-1">
            {groupIndex > 0 && (
              sidebarExpanded && group.label ? (
                <p className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
              ) : (
                <hr
                  className={`my-2 border-0 border-t ${sidebarExpanded ? 'mx-2' : 'mx-1'}`}
                  style={{ borderColor: 'var(--palace)', opacity: 0.2 }}
                />
              )
            )}
            {group.items.map((item) => {
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
          </div>
        ))}
      </nav>
    </aside>
  )
}
