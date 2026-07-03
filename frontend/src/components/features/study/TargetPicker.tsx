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
  Star,
  ChevronDown,
  Clock,
  Tag,
  Frame,
  AlertTriangle,
} from 'lucide-react'
import { getCollections } from '@/lib/api/collections'
import { getViews } from '@/lib/api/views'
import { viewTypeLabel } from '@/lib/view-types'
import { useStudyTargetStore } from '@/stores/studyTargets'
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

// 「その他（準備中）」の対象候補をチップで表示する（単体でも使える）。
export function ComingSoonTargets() {
  return (
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
  )
}

interface Props {
  selectedKey?: string
  onSelect: (target: QuizTarget) => void
  // 「その他（準備中）」セクションを隠す（呼び出し側で別途表示する場合に使う）
  hideComingSoon?: boolean
}

/**
 * スタディの対象選択。媒体ごとに1行のアコーディオンで省スペースに表示し、
 * 各行の★で対象を保存できる（保存した対象は②に表示される）。
 */
export function TargetPicker({ selectedKey, onSelect, hideComingSoon = false }: Props) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [views, setViews] = useState<View[]>([])
  const [open, setOpen] = useState<OpenMedium>(null)
  const [query, setQuery] = useState('')

  const savedTargets = useStudyTargetStore((s) => s.targets)
  const toggleSave = useStudyTargetStore((s) => s.toggleSave)
  const savedKeys = useMemo(() => new Set(savedTargets.map((t) => t.key)), [savedTargets])

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
  const allTarget: QuizTarget = { kind: 'all' }

  return (
    <div className="space-y-2">
      {/* すべてのカード（行クリックで即選択／★で保存） */}
      <div
        className="flex items-center gap-1 rounded-xl border bg-card transition"
        style={{
          borderColor: allActive ? 'var(--palace)' : 'var(--border)',
          backgroundColor: allActive ? 'rgba(198,167,94,0.08)' : undefined,
        }}
      >
        <button
          type="button"
          onClick={() => onSelect(allTarget)}
          className="flex flex-1 items-center gap-3 px-4 py-3 text-left"
        >
          <span style={{ color: 'var(--palace)' }}><GalleryHorizontal size={18} /></span>
          <span className="flex-1 text-sm font-medium">すべてのカード</span>
          {allActive && <Check size={16} className="text-[var(--palace)]" />}
        </button>
        <StarBtn saved={savedKeys.has('all')} onClick={() => toggleSave(allTarget)} />
      </div>

      {/* ボックス（展開で検索＋リスト） */}
      <MediumAccordion
        icon={<Library size={18} />}
        title="ボックス"
        count={collections.length}
        opened={open === 'collection'}
        onToggle={() => toggle('collection')}
      >
        <MediumList
          query={query}
          onQuery={setQuery}
          placeholder="ボックスを検索"
          empty={collections.length === 0 ? 'ボックスがありません。' : '該当するボックスがありません。'}
          items={filteredCollections}
        >
          {filteredCollections.map((c) => {
            const t: QuizTarget = { kind: 'collection', id: c.id, name: c.name }
            const key = targetKey(t)
            return (
              <ItemRow
                key={c.id}
                icon={<Library size={16} />}
                label={c.name}
                meta={`${c.entry_count} 件`}
                active={selectedKey === key}
                saved={savedKeys.has(key)}
                onClick={() => onSelect(t)}
                onToggleSave={() => toggleSave(t)}
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
            const key = targetKey(t)
            return (
              <ItemRow
                key={v.id}
                icon={<LayoutGrid size={16} />}
                label={v.name}
                meta={viewTypeLabel(v.view_type)}
                active={selectedKey === key}
                saved={savedKeys.has(key)}
                onClick={() => onSelect(t)}
                onToggleSave={() => toggleSave(t)}
              />
            )
          })}
        </MediumList>
      </MediumAccordion>

      {/* その他（準備中）。呼び出し側で別表示する場合は隠す。 */}
      {!hideComingSoon && (
        <div className="pt-1">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">その他（準備中）</p>
          <ComingSoonTargets />
        </div>
      )}
    </div>
  )
}

function StarBtn({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={saved ? '保存を外す' : '保存する'}
      className="mr-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:text-[var(--palace)]"
    >
      <Star size={16} fill={saved ? 'var(--palace)' : 'none'} color={saved ? 'var(--palace)' : 'currentColor'} />
    </button>
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
  saved,
  onClick,
  onToggleSave,
}: {
  icon: ReactNode
  label: string
  meta?: string
  active: boolean
  saved: boolean
  onClick: () => void
  onToggleSave: () => void
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-lg border transition"
      style={{
        borderColor: active ? 'var(--palace)' : 'transparent',
        backgroundColor: active ? 'rgba(198,167,94,0.08)' : undefined,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-black/5"
      >
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="flex-1 truncate font-medium">{label}</span>
        {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
        {active && <Check size={15} className="shrink-0 text-[var(--palace)]" />}
      </button>
      <StarBtn saved={saved} onClick={onToggleSave} />
    </div>
  )
}
