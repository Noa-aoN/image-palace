'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useUiStore } from '@/stores/ui'
import { NAV_SECTIONS, type NavNode } from './nav-items'
import { useOpenCardCreate } from '@/components/features/items/CardCreatePanel'

interface Props {
  // 折りたたみサイドバー（72px）ではアイコンのみ表示し、見出し・子・ラベルを隠す。
  iconsOnly?: boolean
  // リンク選択時のコールバック（モバイルドロワーを閉じる等）。
  onNavigate?: () => void
}

/**
 * サイドバー（デスクトップ）とモバイルドロワーで共有するナビ本体。
 * セクション見出し＋開閉グループ（ライブラリ=リンク＋開閉、アトリエ=開閉のみ）を描画する。
 */
export function SidebarNav({ iconsOnly = false, onNavigate }: Props) {
  const openCardCreate = useOpenCardCreate()
  const pathname = usePathname()
  const collapsedGroups = useUiStore((s) => s.collapsedGroups)
  const toggleGroup = useUiStore((s) => s.toggleGroup)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const linkClass = (href: string, nested: boolean) =>
    `flex rounded-lg py-2.5 text-sm font-medium transition-colors hover:bg-black/5 ${
      iconsOnly ? 'items-center justify-center px-0' : `items-center gap-3 ${nested ? 'pl-9 pr-2' : 'px-2'}`
    }`

  const linkStyle = (href: string): React.CSSProperties => ({
    color: isActive(href) ? 'var(--palace)' : 'inherit',
    backgroundColor: isActive(href) ? 'rgba(198,167,94,0.1)' : undefined,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  })

  const renderLink = (node: NavNode, nested = false) => {
    // パネルで開くものは画面を移らない。見た目はリンクと揃える
    if (node.panel === 'card-create') {
      return (
        <button
          key={node.label}
          type="button"
          onClick={() => {
            openCardCreate()
            onNavigate?.()
          }}
          className={`${linkClass('#', nested)} w-full text-left`}
          title={iconsOnly ? node.label : undefined}
        >
          <span className="shrink-0">{node.icon}</span>
          {!iconsOnly && <span className="truncate">{node.label}</span>}
        </button>
      )
    }

    const href = node.href ?? '#'
    return (
      <Link
        key={node.label}
        href={href}
        onClick={onNavigate}
        className={linkClass(href, nested)}
        style={linkStyle(href)}
        title={iconsOnly ? node.label : undefined}
      >
        <span className="shrink-0">{node.icon}</span>
        {!iconsOnly && <span className="truncate">{node.label}</span>}
      </Link>
    )
  }

  const renderNode = (node: NavNode) => {
    if (!node.children) return renderLink(node)

    // 折りたたみ時: 親アイコンのみ（リンクがあればリンク化）。子は隠す。
    if (iconsOnly) {
      if (node.href) return renderLink(node)
      return (
        <div key={node.label} className="flex items-center justify-center py-2.5" title={node.label}>
          <span className="shrink-0">{node.icon}</span>
        </div>
      )
    }

    const collapsed = collapsedGroups[node.label]
    // 閉じている時は ▼（下＝展開できる合図）、開いている時は ▲（上＝畳める合図）。
    const Chevron = collapsed ? ChevronDown : ChevronUp

    const header = node.href ? (
      // リンク（ラベル）＋ chevron トグル
      <div className="flex items-center">
        <Link
          href={node.href}
          onClick={onNavigate}
          className="flex flex-1 items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors hover:bg-black/5"
          style={linkStyle(node.href)}
        >
          <span className="shrink-0">{node.icon}</span>
          <span className="truncate">{node.label}</span>
        </Link>
        <button
          type="button"
          onClick={() => toggleGroup(node.label)}
          className="rounded-lg p-1.5 hover:bg-black/5 transition-colors"
          aria-label={`${node.label}を開閉`}
          aria-expanded={!collapsed}
        >
          <Chevron size={16} />
        </button>
      </div>
    ) : (
      // 行全体がトグル
      <button
        type="button"
        onClick={() => toggleGroup(node.label)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors hover:bg-black/5"
        aria-expanded={!collapsed}
      >
        <span className="shrink-0">{node.icon}</span>
        <span className="flex-1 truncate text-left">{node.label}</span>
        <Chevron size={16} />
      </button>
    )

    return (
      <div key={node.label} className="flex flex-col gap-1">
        {header}
        {!collapsed && node.children.map((child) => renderLink(child, true))}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-1 ${iconsOnly ? 'px-1.5' : 'px-2'}`}>
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          {iconsOnly ? (
            <div className="mx-auto my-1 h-px w-6" style={{ backgroundColor: 'var(--palace)', opacity: 0.4 }} />
          ) : (
            <p className="px-2 pt-3 pb-1 text-xs font-semibold text-muted-foreground">{section.title}</p>
          )}
          {section.items.map(renderNode)}
        </div>
      ))}
    </div>
  )
}
