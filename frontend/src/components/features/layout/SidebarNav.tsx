'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useUiStore } from '@/stores/ui'
import { useAdminStore } from '@/stores/admin'
import { isNavItemActive } from '@/lib/nav-active'
import { ADMIN_SECTION, NAV_SECTIONS, type NavNode } from './nav-items'
import { useOpenCardCreate } from '@/components/features/items/CardCreatePanel'

interface Props {
  // 折りたたみサイドバー（72px）ではアイコンのみ表示し、見出し・子・ラベルを隠す。
  iconsOnly?: boolean
  // リンク選択時のコールバック（モバイルドロワーを閉じる等）。
  onNavigate?: () => void
}

/**
 * サイドバー（デスクトップ）とモバイルドロワーで共有するナビ。
 *
 * 「/views」と「/views?type=deck」はパスが同じなので、選択中の判定には絞り込みも要る。
 * 絞り込みを読む useSearchParams は静的プリレンダリングを外してしまうため、
 * 読む側だけを Suspense の内側に閉じ込める。外側（フォールバック）は絞り込み無しで
 * 同じ見た目を描くので、各ページの静的化は保たれ、ちらつきも起きない。
 */
export function SidebarNav(props: Props) {
  return (
    <Suspense fallback={<NavTree {...props} currentQuery={null} />}>
      <NavWithQuery {...props} />
    </Suspense>
  )
}

function NavWithQuery(props: Props) {
  const searchParams = useSearchParams()
  return <NavTree {...props} currentQuery={searchParams.toString()} />
}

// 階層の深さぶん字下げする（0=直下, 1=子, 2=孫）
const INDENT = ['px-2', 'pl-9 pr-2', 'pl-14 pr-2']

function NavTree({
  iconsOnly = false,
  onNavigate,
  currentQuery,
}: Props & {
  /** 現在の絞り込み。null は「まだ読めていない」＝パスだけで判定する */
  currentQuery: string | null
}) {
  const openCardCreate = useOpenCardCreate()
  const pathname = usePathname()
  const collapsedGroups = useUiStore((s) => s.collapsedGroups)
  // 運営だけに「運営」を出す。見た目の出し分けであって守りではない
  const isAdmin = useAdminStore((s) => s.session?.admin ?? false)
  const toggleGroup = useUiStore((s) => s.toggleGroup)

  const isActive = (href: string) => isNavItemActive(href, pathname, currentQuery)

  const linkClass = (depth: number) =>
    `flex rounded-lg py-2.5 text-sm font-medium transition-colors hover:bg-black/5 ${
      iconsOnly ? 'items-center justify-center px-0' : `items-center gap-3 ${INDENT[depth] ?? INDENT[2]}`
    }`

  const linkStyle = (href: string): React.CSSProperties => ({
    color: isActive(href) ? 'var(--palace)' : 'inherit',
    backgroundColor: isActive(href) ? 'rgba(198,167,94,0.1)' : undefined,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  })

  const renderLink = (node: NavNode, depth = 0) => {
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
          className={`${linkClass(depth)} w-full text-left`}
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
        className={linkClass(depth)}
        style={linkStyle(href)}
        title={iconsOnly ? node.label : undefined}
      >
        <span className="shrink-0">{node.icon}</span>
        {!iconsOnly && <span className="truncate">{node.label}</span>}
      </Link>
    )
  }

  const renderNode = (node: NavNode, depth = 0) => {
    if (!node.children) return renderLink(node, depth)

    // 折りたたみ時: 親アイコンのみ（リンクがあればリンク化）。子は隠す。
    if (iconsOnly) {
      if (node.href) return renderLink(node, depth)
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
          className={`flex-1 ${linkClass(depth)}`}
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
        className={`w-full ${linkClass(depth)}`}
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
        {!collapsed && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-1 ${iconsOnly ? 'px-1.5' : 'px-2'}`}>
      {(isAdmin ? [ ...NAV_SECTIONS, ADMIN_SECTION ] : NAV_SECTIONS).map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          {iconsOnly ? (
            <div className="mx-auto my-1 h-px w-6" style={{ backgroundColor: 'var(--palace)', opacity: 0.4 }} />
          ) : (
            <p className="px-2 pt-3 pb-1 text-xs font-semibold text-muted-foreground">{section.title}</p>
          )}
          {section.items.map((node) => renderNode(node))}
        </div>
      ))}
    </div>
  )
}
