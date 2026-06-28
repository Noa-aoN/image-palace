'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  GalleryHorizontal,
  Library,
  LayoutGrid,
  Search,
  X,
  Check,
  ChevronDown,
  Clock,
  Tag,
  Frame,
  AlertTriangle,
} from 'lucide-react'
import { getCollections } from '@/lib/api/collections'
import { getViews } from '@/lib/api/views'
import { viewTypeLabel } from '@/lib/view-types'
import { targetKey, type QuizTarget } from '@/lib/quiz'
import type { Collection } from '@/types/collection'
import type { View } from '@/types/view'

const COMING_SOON_TARGETS: { icon: ReactNode; label: string }[] = [
  { icon: <Clock size={15} />, label: '最近作成したカード' },
  { icon: <Tag size={15} />, label: 'タグ' },
  { icon: <Frame size={15} />, label: 'スペース' },
  { icon: <AlertTriangle size={15} />, label: '苦手カード' },
]

type OpenMedium = 'collection' | 'view' | null

interface Props {
  selectedKey?: string
  onSelect: (target: QuizTarget) => void
}

/**
 * スタディの対象選択。媒体ごとに1行のアコーディオンで省スペースに表示し、
 * 展開したときだけ検索つきのリストを出す。選択は selectedKey でハイライトする。
 */
export function TargetPicker({ selectedKey, onSelect }: Props) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [views, setViews] = useState<View[]>([])
  const [open, setOpen] = useState<OpenMedium>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    getCollections().then(setCollections).catch(() => setCollections([]))
    getViews().then(setViews).catch(() => setViews([]))
  }, [])

  const toggle = (medium: OpenMedium) => {
    setOpen((cur) => (cur === medium ? null : medium))
    setQuery('')
  }

  const q = query.trim().toLowerCase()
  const filteredCollections = useMemo(
    () => (q ? collections.filter((c) => c.name.toLowerCase().includes(q)) : collections),
    [collections, q]
  )
  const filteredViews = useMemo(
    () => (q ? views.filter((v) => v.name.toLowerCase().includes(q)) : views),
    [views, q]
  )

  const allActive = selectedKey === 'all'

  return (
    <div className="space-y-2">
      {/* すべてのカード（行クリックで即選択） */}
      <button
        type="button"
        onClick={() => onSelect({ kind: 'all' })}
        className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition hover:border-[var(--palace)]"
        style={{
          borderColor: allActive ? 'var(--palace)' : 'var(--border)',
          backgroundColor: allActive ? 'rgba(198,167,94,0.08)' : undefined,
        }}
      >
        <span style={{ color: 'var(--palace)' }}><GalleryHorizontal size={18} /></span>
        <span className="flex-1 text-sm font-medium">すべてのカード</span>
        {allActive && <Check size={16} className="text-[var(--palace)]" />}
      </button>

      {/* コレクション（展開で検索＋リスト） */}
      <MediumAccordion
        icon={<Library size={18} />}
        title="コレクション"
        count={collections.length}
        opened={open === 'collection'}
        onToggle={() => toggle('collection')}
      >
        <MediumList
          query={query}
          onQuery={setQuery}
          placeholder="コレクションを検索"
          empty={collections.length === 0 ? 'コレクションがありません。' : '該当するコレクションがありません。'}
          items={filteredCollections}
        >
          {filteredCollections.map((c) => {
            const t: QuizTarget = { kind: 'collection', id: c.id, name: c.name }
            return (
              <ItemRow
                key={c.id}
                icon={<Library size={16} />}
                label={c.name}
                meta={`${c.entry_count} 件`}
                active={selectedKey === targetKey(t)}
                onClick={() => onSelect(t)}
              />
            )
          })}
        </MediumList>
      </MediumAccordion>

      {/* キャンバス（展開で検索＋リスト） */}
      <MediumAccordion
        icon={<LayoutGrid size={18} />}
        title="キャンバス"
        count={views.length}
        opened={open === 'view'}
        onToggle={() => toggle('view')}
      >
        <MediumList
          query={query}
          onQuery={setQuery}
          placeholder="キャンバスを検索"
          empty={views.length === 0 ? 'キャンバスがありません。' : '該当するキャンバスがありません。'}
          items={filteredViews}
        >
          {filteredViews.map((v) => {
            const t: QuizTarget = { kind: 'view', id: v.id, name: v.name }
            return (
              <ItemRow
                key={v.id}
                icon={<LayoutGrid size={16} />}
                label={v.name}
                meta={viewTypeLabel(v.view_type)}
                active={selectedKey === targetKey(t)}
                onClick={() => onSelect(t)}
              />
            )
          })}
        </MediumList>
      </MediumAccordion>

      {/* その他（準備中） */}
      <div className="pt-1">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">その他（準備中）</p>
        <div className="flex flex-wrap gap-1.5">
          {COMING_SOON_TARGETS.map((t) => (
            <span
              key={t.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground"
            >
              <span style={{ color: 'var(--palace)' }}>{t.icon}</span>
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function MediumAccordion({
  icon,
  title,
  count,
  opened,
  onToggle,
  children,
}: {
  icon: ReactNode
  title: string
  count: number
  opened: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={opened}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/5"
      >
        <span style={{ color: 'var(--palace)' }}>{icon}</span>
        <span className="flex-1 text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${opened ? 'rotate-180' : ''}`} />
      </button>
      {opened && <div className="border-t border-border p-3">{children}</div>}
    </div>
  )
}

function MediumList({
  query,
  onQuery,
  placeholder,
  empty,
  items,
  children,
}: {
  query: string
  onQuery: (v: string) => void
  placeholder: string
  empty: string
  items: unknown[]
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-8 text-sm outline-none focus:border-[var(--palace)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            aria-label="検索をクリア"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-1 py-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="max-h-64 space-y-1 overflow-y-auto">{children}</div>
      )}
    </div>
  )
}

function ItemRow({
  icon,
  label,
  meta,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  meta?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition hover:border-[var(--palace)]"
      style={{
        borderColor: active ? 'var(--palace)' : 'transparent',
        backgroundColor: active ? 'rgba(198,167,94,0.08)' : undefined,
      }}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
      {active && <Check size={15} className="shrink-0 text-[var(--palace)]" />}
    </button>
  )
}
