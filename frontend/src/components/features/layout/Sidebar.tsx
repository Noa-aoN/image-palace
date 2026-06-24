'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useUiStore } from '@/stores/ui'
import { NAV_TREE, type NavNode } from './nav-items'

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarExpanded, toggleSidebar } = useUiStore()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // 葉ノードのリンク。nested=true で子（字下げ）表示。
  const renderLink = (node: NavNode, nested = false) => {
    const href = node.href ?? '#'
    const active = isActive(href)
    return (
      <Link
        key={node.label}
        href={href}
        className={`flex rounded-lg py-2.5 text-sm font-medium transition-colors hover:bg-black/5 ${
          sidebarExpanded ? `items-center gap-3 ${nested ? 'pl-9 pr-2' : 'px-2'}` : 'items-center justify-center px-0'
        }`}
        style={{
          color: active ? 'var(--palace)' : 'inherit',
          backgroundColor: active ? 'rgba(198,167,94,0.1)' : undefined,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
        title={!sidebarExpanded ? node.label : undefined}
      >
        <span className="shrink-0">{node.icon}</span>
        {sidebarExpanded && <span className="truncate">{node.label}</span>}
      </Link>
    )
  }

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

      {/* ナビゲーション（ビュー/スペースは親子の入れ子ツリー） */}
      <nav className={`flex flex-col gap-1 pt-2 ${sidebarExpanded ? 'px-2' : 'px-1.5'}`}>
        {NAV_TREE.map((node) => {
          if (!node.children) return renderLink(node)
          // 親もリンク。配下の子を入れ子（展開時は字下げ）で表示する。
          return (
            <div key={node.label} className="flex flex-col gap-1">
              {renderLink(node)}
              {node.children.map((child) => renderLink(child, true))}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
