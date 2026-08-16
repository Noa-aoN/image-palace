'use client'

import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useUiStore } from '@/stores/ui'
import { useAdminStore } from '@/stores/admin'
import { isNavItemActive } from '@/lib/nav-active'
import { navSectionsFor, type NavNode } from './nav-items'
import { useFeaturesStore } from '@/stores/features'

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
  const pathname = usePathname()
  // 機能の見せ方。運営が段階を変えると、次の読み込みからサイドバーにも効く
  const stages = useFeaturesStore((s) => s.stages)
  const paths = useFeaturesStore((s) => s.paths)
  const loadFeatures = useFeaturesStore((s) => s.load)
  useEffect(() => {
    loadFeatures()
  }, [loadFeatures])
  const collapsedGroups = useUiStore((s) => s.collapsedGroups)
  // 運営だけに「運営」を出す。見た目の出し分けであって守りではない
  const isAdmin = useAdminStore((s) => s.session?.admin ?? false)
  const toggleGroup = useUiStore((s) => s.toggleGroup)

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : isNavItemActive(href, pathname, currentQuery)

  const linkClass = (depth: number) =>
    `flex rounded-lg py-2.5 text-sm font-medium transition-colors hover:bg-black/5 ${
      iconsOnly ? 'items-center justify-center px-0' : `items-center gap-3 ${INDENT[depth] ?? INDENT[2]}`
    }`

  const linkStyle = (href: string, exact = false): React.CSSProperties => ({
    color: isActive(href, exact) ? 'var(--palace)' : 'inherit',
    backgroundColor: isActive(href, exact) ? 'rgba(198,167,94,0.1)' : undefined,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  })

  // その項目をどう出すか。設定を読み終わるまでは、いまの見え方を変えない
  // （読み込みのたびに項目が現れたり消えたりすると、押そうとした先が動く）
  const stageOf = (href?: string): 'hidden' | 'development' | 'prototype' | 'released' => {
    if (!href || !stages || !paths) return 'released'
    const path = href.split('?')[0]
    const matched = Object.keys(paths)
      .filter((p) => path === p || path.startsWith(`${p}/`))
      .sort((a, b) => b.length - a.length)
    if (matched.length === 0) return 'released'
    const own = (stages[paths[matched[0]]] ?? 'released') as 'hidden' | 'development' | 'prototype' | 'released'
    const ancestorHidden = matched.slice(1).some((p) => stages[paths[p]] === 'hidden')
    return ancestorHidden ? 'hidden' : own
  }

  // 準備中・プロトタイプは印を付けて出す。隠すものだけ消す
  const stageBadge = (stage: string) => {
    if (stage === 'development') return '準備中'
    if (stage === 'prototype') return '試作'
    return null
  }

  const renderLink = (node: NavNode, depth = 0) => {
    const href = node.href ?? '#'
    const badge = stageBadge(stageOf(node.href))
    return (
      <Link
        key={node.label}
        href={href}
        onClick={onNavigate}
        className={linkClass(depth)}
        style={linkStyle(href, node.exact)}
        // 名前だけでは何の場所か分からないので、説明を持つものはそれを見せる
        title={iconsOnly ? [node.label, node.description].filter(Boolean).join(' — ') : node.description}
      >
        <span className="shrink-0">{node.icon}</span>
        {!iconsOnly && <span className="truncate">{node.label}</span>}
        {!iconsOnly && badge && (
          <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {badge}
          </span>
        )}
      </Link>
    )
  }

  const renderNode = (node: NavNode, depth = 0): React.ReactNode => {
    if (stageOf(node.href) === 'hidden') return null
    if (!node.children) return renderLink(node, depth)

    // 折りたたみ時: 親アイコンのみ（リンクがあればリンク化）。子は隠す。
    if (iconsOnly) {
      if (node.href) return renderLink(node, depth)
      return (
        <div key={node.label} className="flex items-center justify-center py-2.5" title={[node.label, node.description].filter(Boolean).join(' — ')}>
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
          title={node.description}
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
        title={node.description}
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
      {navSectionsFor(isAdmin).map((section) => (
        <div key={section.key} className="flex flex-col">
          {iconsOnly ? (
            <div className="mx-auto my-1 h-px w-6" style={{ backgroundColor: 'var(--palace)', opacity: 0.4 }} />
          ) : (
            <>
              {/* 見出しと中身を**地続きの一枚**にする。
                  見出しだけが浮いた札だったころは、どの項目がどの群に属するのかを
                  間隔だけで読み取るしかなかった。

                  見出しは上だけ角を丸め、下は角のまま中身へ繋げる。
                  中身は白系で塗って、最後の項目の下だけを丸める。
                  こうすると群が1つの面になり、切れ目を探さなくてよくなる */}
              <p
                className="mt-3 rounded-t-lg px-3 py-2 text-center text-base font-semibold"
                style={{ backgroundColor: 'var(--palace-deep)', color: 'var(--on-palace)' }}
              >
                {section.title}
              </p>
              <div
                className="flex flex-col gap-1 rounded-b-lg p-1.5"
                style={{ backgroundColor: 'color-mix(in srgb, #fff 82%, var(--ivory))' }}
              >
                {section.items.map((node) => renderNode(node))}
              </div>
            </>
          )}
          {/* 折りたたみ時は面で括らない（幅が無いので、塗ると線にしか見えない） */}
          {iconsOnly && <div className="flex flex-col gap-1">{section.items.map((node) => renderNode(node))}</div>}
        </div>
      ))}
    </div>
  )
}
