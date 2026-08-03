'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2, Pencil, Check, X, Plus, GalleryHorizontal, LayoutGrid, Frame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Input } from '@/components/ui/input'
import {
  getBox, updateBox, deleteBox,
  addEntryToBox, removeEntryFromBox,
  uploadBoxCover, removeBoxCover, generateBoxCover } from '@/lib/api/boxes'
import { getItems } from '@/lib/api/items'
import { getSpaces } from '@/lib/api/spaces'
import { getViews } from '@/lib/api/views'
import { viewTypeLabel } from '@/lib/view-types'
import { EntityCover } from '@/components/features/shared/EntityCover'
import { useCoverGeneration } from '@/hooks/useCoverGeneration'
import { CoverSettings } from '@/components/features/shared/CoverSettings'
import type { BoxDetail, BoxEntry, BoxEntryType } from '@/types/box'
import type { CoverType } from '@/types/cover'

// 追加候補の正規化表現
type Pickable = { id: string; label: string; image: string | null; sub?: string }

const TYPE_META: Record<BoxEntryType, { label: string; icon: React.ReactNode; path: string }> = {
  Item: { label: 'カード', icon: <GalleryHorizontal size={16} />, path: 'items' },
  Space: { label: 'スペース', icon: <Frame size={16} />, path: 'spaces' },
  View: { label: 'キャンバス', icon: <LayoutGrid size={16} />, path: 'views' },
}
const TYPE_ORDER: BoxEntryType[] = ['Item', 'Space', 'View']

function entryHref(e: BoxEntry): string {
  return `/${TYPE_META[e.entry_type].path}/${e.id}`
}
function entryLabel(e: BoxEntry): string {
  return e.entry_type === 'Item' ? e.title : e.name
}
function entryImage(e: BoxEntry): string | null {
  if (e.entry_type === 'Item') return e.media?.thumb_url ?? e.media?.url ?? null
  // Space / View はそれぞれのカバー画像
  return e.cover?.thumb_url ?? e.cover?.url ?? null
}

// 全種別を正方形カバータイルに統一（名前=上・カバー=下、カバーが無ければ種別アイコン）
function EntryTile({ entry, onRemove, busy }: { entry: BoxEntry; onRemove: () => void; busy: boolean }) {
  const image = entryImage(entry)
  const removeBtn = (
    <Button
      variant="destructive"
      size="icon-sm"
      onClick={onRemove}
      disabled={busy}
      aria-label="このエントリを外す"
      className="rounded-full shadow"
    >
      <X size={14} />
    </Button>
  )

  return (
    <div className="flex flex-col rounded-xl border border-border overflow-hidden bg-card">
      <div className="px-3 py-2">
        <span className="text-sm font-medium truncate block">{entryLabel(entry)}</span>
      </div>
      <div className="relative w-full aspect-square bg-muted overflow-hidden">
        <Link href={entryHref(entry)} className="flex h-full w-full items-center justify-center hover:opacity-95 transition-opacity">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={entryLabel(entry)} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span className="text-muted-foreground/60">{TYPE_META[entry.entry_type].icon}</span>
          )}
        </Link>
        <div className="absolute top-1 right-1 z-10">{removeBtn}</div>
      </div>
    </div>
  )
}

export default function BoxDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [box, setBox] = useState<BoxDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [pickerType, setPickerType] = useState<BoxEntryType | null>(null)
  const [pickables, setPickables] = useState<Pickable[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const [loadingMore, setLoadingMore] = useState(false)

  const reload = async () => {
    const data = await getBox(id)
    setBox(data)
  }

  // 続きを読む。取得済みの分は残したまま後ろに足す
  const loadMore = async () => {
    if (!box?.next_cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const more = await getBox(id, box.next_cursor)
      setBox((current) =>
        current
          ? { ...current, entries: [ ...current.entries, ...more.entries ], next_cursor: more.next_cursor }
          : more
      )
    } catch {
      // 失敗しても取得済みの分は残す。もう一度押せばやり直せる
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    getBox(id)
      .then((data) => {
        if (!cancelled) setBox(data)
      })
      .catch(() => {
        if (!cancelled) setError('ボックスの取得に失敗しました')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const openPicker = async (type: BoxEntryType) => {
    setPickerType(type)
    setPickerLoading(true)
    try {
      let list: Pickable[] = []
      if (type === 'Item') {
        list = (await getItems()).map((i) => ({ id: i.id, label: i.title, image: i.media?.thumb_url ?? i.media?.url ?? null }))
      } else if (type === 'Space') {
        list = (await getSpaces()).map((s) => ({ id: s.id, label: s.name, image: null }))
      } else {
        list = (await getViews()).map((v) => ({ id: v.id, label: v.name, image: null, sub: viewTypeLabel(v.view_type) }))
      }
      setPickables(list)
    } catch {
      setPickables([])
    } finally {
      setPickerLoading(false)
    }
  }

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !box) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await updateBox(id, { name: trimmed })
      setBox({ ...box, name: updated.name })
      setEditing(false)
    } catch {
      setError('ボックス名の更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await deleteBox(id)
      router.push('/boxes')
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // カバー設定（デッキ踏襲）
  const [coverBusy, setCoverBusy] = useState(false)
  const handleSetCoverType = async (coverType: CoverType) => {
    if (!box || box.cover_type === coverType) return
    setCoverBusy(true)
    try {
      const updated = await updateBox(id, { cover_type: coverType })
      setBox({ ...box, ...updated })
    } catch {
      setError('カバー表示の変更に失敗しました')
    } finally {
      setCoverBusy(false)
    }
  }
  const handleUploadCover = async (file: File) => {
    if (!box) return
    setCoverBusy(true)
    try {
      const updated = await uploadBoxCover(id, file)
      setBox({ ...box, ...updated })
    } catch {
      setError('画像のアップロードに失敗しました')
    } finally {
      setCoverBusy(false)
    }
  }
  // カバー画像を AI で作る（非同期・1クレジット）。出来上がるまで取り直す
  const reloadCover = useCallback(async () => {
    const data = await getBox(id)
    setBox((prev) => (prev ? { ...prev, ...data } : data))
  }, [id])
  const cover = useCoverGeneration({
    status: box?.cover_generation_status,
    statusError: box?.cover_generation_error,
    submit: async (prompt, style) => {
      const updated = await generateBoxCover(id, prompt, style)
      setBox((prev) => (prev ? { ...prev, ...updated } : prev))
    },
    reload: reloadCover,
  })

  const handleRemoveCover = async () => {
    if (!box) return
    setCoverBusy(true)
    try {
      const updated = await removeBoxCover(id)
      setBox({ ...box, ...updated })
    } catch {
      setError('画像の削除に失敗しました')
    } finally {
      setCoverBusy(false)
    }
  }

  const handleAdd = async (type: BoxEntryType, entryId: string) => {
    setBusyKey(`${type}:${entryId}`)
    try {
      await addEntryToBox(id, type, entryId)
      await reload()
    } catch {
      setError('追加に失敗しました')
    } finally {
      setBusyKey(null)
    }
  }

  const handleRemove = async (entry: BoxEntry) => {
    if (!box) return
    setBusyKey(`${entry.entry_type}:${entry.id}`)
    try {
      await removeEntryFromBox(id, entry.entry_type, entry.id)
      setBox({
        ...box,
        entries: box.entries.filter((e) => !(e.entry_type === entry.entry_type && e.id === entry.id)),
        entry_count: Math.max(box.entry_count - 1, 0),
      })
    } catch {
      setError('除外に失敗しました')
    } finally {
      setBusyKey(null)
    }
  }

  if (error && !box) {
    return (
      <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href="/boxes"><Button variant="outline">← ボックス一覧へ</Button></Link>
      </div>
    )
  }

  if (!box) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-6">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const inBox = new Set(box.entries.map((e) => `${e.entry_type}:${e.id}`))
  const pickable = pickerType
    ? pickables.filter((p) => !inBox.has(`${pickerType}:${p.id}`))
    : []

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <Breadcrumb items={[{ href: '/boxes', label: 'ボックス' }, { label: box.name }]} />

      <div className="flex items-center justify-between gap-3 mb-2">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveName() } if (e.key === 'Escape') setEditing(false) }}
              disabled={saving}
              autoFocus
              aria-label="ボックス名"
              className="text-lg max-w-sm"
            />
            <Button size="sm" onClick={handleSaveName} disabled={saving} aria-label="保存"><Check size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} aria-label="キャンセル"><X size={16} /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-2xl font-semibold truncate">{box.name}</h1>
            <span className="text-sm text-muted-foreground shrink-0">{box.entry_count} 件</span>
            <button
              onClick={() => { setNameDraft(box.name); setEditing(true) }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="ボックス名を編集"
            >
              <Pencil size={16} />
            </button>
          </div>
        )}
        <Button
          variant={confirmDelete ? 'destructive' : 'ghost'}
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          onBlur={() => setConfirmDelete(false)}
          className="flex items-center gap-1.5 shrink-0"
        >
          <Trash2 size={14} />
          {deleting ? '削除中...' : confirmDelete ? '本当に削除' : '削除'}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        カード・デッキ・スペース・キャンバスをまとめられます。
      </p>

      {/* カバー（ヘッダー）設定 */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="aspect-square w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          <EntityCover cover={box} />
        </div>
        <div className="flex-1">
          <CoverSettings
            coverType={box.cover_type}
            busy={coverBusy}
            hasCustom={!!box.cover_image}
            helpText="先頭: ボックス内カードの先頭 / コラージュ: 最大4枚 / カスタム: アップロード画像"
            onSelectType={handleSetCoverType}
            onUpload={handleUploadCover}
            onRemove={handleRemoveCover}
            onGenerate={cover.generate}
            generating={cover.generating}
            generateError={cover.error}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {/* 追加（種別を選んでから対象を選ぶ） */}
      <div className="mb-8 rounded-xl border border-border/70 bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium mr-1 flex items-center gap-1"><Plus size={14} />追加:</span>
          {TYPE_ORDER.map((type) => (
            <Button
              key={type}
              variant={pickerType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => openPicker(type)}
              className="flex items-center gap-1.5"
            >
              {TYPE_META[type].icon}
              {TYPE_META[type].label}
            </Button>
          ))}
          {pickerType && (
            <Button variant="ghost" size="sm" onClick={() => setPickerType(null)} className="ml-auto">閉じる</Button>
          )}
        </div>

        {pickerType && (
          <div className="mt-4">
            {pickerLoading ? (
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            ) : pickable.length === 0 ? (
              <p className="text-sm text-muted-foreground">追加できる{TYPE_META[pickerType].label}がありません。</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {pickable.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-card border border-border px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className="h-9 w-9 rounded object-cover shrink-0" />
                      ) : (
                        <span className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0" style={{ color: 'var(--palace)' }}>
                          {TYPE_META[pickerType].icon}
                        </span>
                      )}
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">{p.label}</span>
                        {p.sub && <span className="text-xs text-muted-foreground">{p.sub}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAdd(pickerType, p.id)}
                      disabled={busyKey === `${pickerType}:${p.id}`}
                      className="shrink-0"
                    >
                      追加
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* エントリ（種別ごとに表示） */}
      {box.entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          まだ何もありません。上の「追加」からまとめましょう。
        </p>
      ) : (
        <div className="space-y-8">
          {TYPE_ORDER.map((type) => {
            const entries = box.entries.filter((e) => e.entry_type === type)
            if (entries.length === 0) return null
            return (
              <section key={type} className="space-y-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <span style={{ color: 'var(--palace)' }}>{TYPE_META[type].icon}</span>
                  {TYPE_META[type].label}
                  <span className="text-sm font-normal text-muted-foreground">{entries.length}</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {entries.map((entry) => (
                    <EntryTile
                      key={`${entry.entry_type}:${entry.id}`}
                      entry={entry}
                      onRemove={() => handleRemove(entry)}
                      busy={busyKey === `${entry.entry_type}:${entry.id}`}
                    />
                  ))}
                </div>
              </section>
            )
          })}

          {/* 続き。全部を一度に読むと件数に比例して待たされるため、押した分だけ足す */}
          {box.next_cursor && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? '読み込み中...' : `続きを読む（${box.entries.length} / ${box.entry_count}）`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
