'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Tag as TagIcon, Pencil, Check, X, Trash2, Plus, Pin, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { getTags, createTag, updateTag, deleteTag, setTagPinned } from '@/lib/api/tags'
import type { Tag } from '@/types/tag'

// セクション表示順（科学5 / NDC10）。重複する自然科学・社会科学・芸術は両方に出す。
const SCIENCE_NAMES = ['形式科学', '自然科学', '社会科学', '人文科学', '応用科学']
const NDC_NAMES = ['総記', '哲学', '歴史', '社会科学', '自然科学', '技術・工学', '産業', '芸術', '言語', '文学']

// デフォルトタグを指定順で先頭に、続いてピン留め、各グループ内は日本語の名前順で並べる
function sortTags(a: Tag, b: Tag): number {
  return (
    Number(b.is_default ?? false) - Number(a.is_default ?? false) ||
    (a.position ?? Infinity) - (b.position ?? Infinity) ||
    Number(b.pinned) - Number(a.pinned) ||
    a.name.localeCompare(b.name, 'ja')
  )
}

function TagRow({ tag, onChanged, badge }: { tag: Tag; onChanged: (next: Tag | null) => void; badge?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(tag.name)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pinning, setPinning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTogglePin = async () => {
    setPinning(true)
    setError(null)
    try {
      const updated = await setTagPinned(tag.id, !tag.pinned)
      onChanged({ ...tag, pinned: updated.pinned })
    } catch {
      setError('ピン留めの更新に失敗しました')
    } finally {
      setPinning(false)
    }
  }

  const handleSave = async () => {
    const name = draft.trim()
    if (!name || name === tag.name) {
      setEditing(false)
      setDraft(tag.name)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await updateTag(tag.id, name)
      onChanged({ ...tag, name: updated.name })
      setEditing(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setError(axiosErr?.response?.data?.errors?.[0] ?? 'タグ名の更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await deleteTag(tag.id)
      onChanged(null)
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 ${
        tag.pinned
          ? 'border-[var(--palace)]/40 bg-[var(--palace)]/5'
          : tag.is_default
            ? 'border-dashed border-border/70 bg-muted/30'
            : 'border-border bg-card'
      }`}
    >
      {editing ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } if (e.key === 'Escape') { setEditing(false); setDraft(tag.name) } }}
            disabled={saving}
            autoFocus
            aria-label="タグ名"
            className="max-w-xs"
          />
          <Button size="sm" onClick={handleSave} disabled={saving} aria-label="保存"><Check size={16} /></Button>
          <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setDraft(tag.name) }} disabled={saving} aria-label="キャンセル"><X size={16} /></Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0">
          <TagIcon size={16} style={{ color: 'var(--palace)' }} />
          <Link href={`/items?tag=${tag.id}`} className="font-medium text-sm truncate hover:underline">{tag.name}</Link>
          {badge && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {badge}
            </span>
          )}
          <span className="text-xs text-muted-foreground shrink-0">{tag.item_count} 枚</span>
        </div>
      )}
      {!editing && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleTogglePin}
            disabled={pinning}
            className="transition-colors p-1.5 disabled:opacity-50"
            style={tag.pinned ? { color: 'var(--palace)' } : undefined}
            aria-label={tag.pinned ? 'ピン留めを外す' : 'ピン留めする'}
            aria-pressed={tag.pinned}
            title={tag.pinned ? 'ピン留めを外す' : 'ピン留め'}
          >
            <Pin size={15} fill={tag.pinned ? 'currentColor' : 'none'} className={tag.pinned ? '' : 'text-muted-foreground hover:text-foreground'} />
          </button>
          <button onClick={() => { setDraft(tag.name); setEditing(true) }} className="text-muted-foreground hover:text-foreground transition-colors p-1.5" aria-label="タグ名を編集">
            <Pencil size={15} />
          </button>
          <Button
            variant={confirmDelete ? 'destructive' : 'ghost'}
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            onBlur={() => setConfirmDelete(false)}
            className="flex items-center gap-1.5"
          >
            <Trash2 size={14} />
            {deleting ? '削除中...' : confirmDelete ? '本当に削除' : '削除'}
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// 折りたたみ可能なタグセクション（科学分類 / NDC）。開閉状態は localStorage に保存する。
function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  storageKey,
  children,
}: {
  title: string
  count: number
  defaultOpen?: boolean
  storageKey: string
  children: React.ReactNode
}) {
  // 開閉状態は localStorage（外部ストア）から読む。SSR では defaultOpen。
  const open = useSyncExternalStore(
    (callback) => {
      window.addEventListener(`toggle:${storageKey}`, callback)
      return () => window.removeEventListener(`toggle:${storageKey}`, callback)
    },
    () => {
      const stored = window.localStorage.getItem(storageKey)
      return stored === null ? defaultOpen : stored === '1'
    },
    () => defaultOpen
  )

  const toggle = () => {
    window.localStorage.setItem(storageKey, open ? '0' : '1')
    window.dispatchEvent(new Event(`toggle:${storageKey}`))
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-2">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
        aria-expanded={open}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </button>
      {open && <div className="space-y-2 px-1 pb-1 pt-1">{children}</div>}
    </div>
  )
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createTag(name)
      setTags((current) => [...current, created].sort(sortTags))
      setNewName('')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setCreateError(axiosErr?.response?.data?.errors?.[0] ?? 'タグの作成に失敗しました')
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    getTags()
      .then((data) => {
        if (!cancelled) setTags([...data].sort(sortTags))
      })
      .catch(() => {
        if (!cancelled) setError('タグの取得に失敗しました')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleTagChanged = (id: string, next: Tag | null) =>
    setTags((current) => {
      const updated = next ? current.map((t) => (t.id === id ? next : t)) : current.filter((t) => t.id !== id)
      return [...updated].sort(sortTags)
    })

  // セクション分け（科学5 / NDC10。各セクションは名簿順、自然科学等は両方に表示）
  const scienceTags = tags
    .filter((t) => t.default_groups?.includes('main'))
    .sort((a, b) => SCIENCE_NAMES.indexOf(a.name) - SCIENCE_NAMES.indexOf(b.name))
  const ndcTags = tags
    .filter((t) => t.default_groups?.includes('ndc'))
    .sort((a, b) => NDC_NAMES.indexOf(a.name) - NDC_NAMES.indexOf(b.name))
  const userTags = tags.filter((t) => !t.is_default)

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="flex items-center gap-2 text-xl font-semibold mb-2">
        <TagIcon size={22} style={{ color: 'var(--palace)' }} />
        タグ
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        タグの新規作成・名前の変更・削除ができます。カードへの付与はカード詳細画面から行えます。
      </p>

      <form onSubmit={handleCreate} className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新しいタグ名（例: 英語、IT）"
            disabled={creating}
            aria-label="新しいタグ名"
          />
          {createError && <p className="mt-1 text-sm text-destructive">{createError}</p>}
        </div>
        <Button type="submit" size="sm" disabled={creating || !newName.trim()} className="flex items-center gap-1.5">
          <Plus size={16} />
          {creating ? '作成中...' : '作成'}
        </Button>
      </form>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl border border-border" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : tags.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">まだタグがありません。カード詳細でタグを付けると、ここに表示されます。</p>
      ) : (
        <div className="space-y-4">
          {scienceTags.length > 0 && (
            <CollapsibleSection title="科学分類（標準）" count={scienceTags.length} storageKey="tags-section-science">
              {scienceTags.map((tag) => (
                <TagRow key={tag.id} tag={tag} badge="標準" onChanged={(next) => handleTagChanged(tag.id, next)} />
              ))}
            </CollapsibleSection>
          )}
          {ndcTags.length > 0 && (
            <CollapsibleSection title="NDC（図書館分類）" count={ndcTags.length} defaultOpen={false} storageKey="tags-section-ndc">
              {ndcTags.map((tag) => (
                <TagRow key={tag.id} tag={tag} badge="NDC" onChanged={(next) => handleTagChanged(tag.id, next)} />
              ))}
            </CollapsibleSection>
          )}
          {userTags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="text-sm font-semibold">マイタグ</span>
                <span className="text-xs text-muted-foreground">{userTags.length}</span>
              </div>
              <div className="space-y-2">
                {userTags.map((tag) => (
                  <TagRow key={tag.id} tag={tag} onChanged={(next) => handleTagChanged(tag.id, next)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
