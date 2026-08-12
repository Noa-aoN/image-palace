'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import {
  Tag as TagIcon,
  Pencil,
  Check,
  X,
  Trash2,
  Plus,
  Pin,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  GripVertical,
  Undo2,
  Redo2,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTagBoard, type BoardTag, type BoardGroup, type TagBoard } from '@/hooks/useTagBoard'
import { isSubmitEnter } from '@/lib/enter-key'

// ---- ドラッグ用 ID スキーム（cid に ':' は含まれない）----
const groupSortId = (cid: string) => `G:${cid}`
const groupDropId = (cid: string) => `GC:${cid}`
const tagSortId = (groupCid: string, tagCid: string) => `T:${groupCid}:${tagCid}` // groupCid='' は未所属
const UNGROUPED = 'UNGROUPED'
function parseTagId(id: string): { groupCid: string; tagCid: string } {
  const parts = id.split(':')
  return { groupCid: parts[1] ?? '', tagCid: parts[2] ?? '' }
}

// アイコンのみのボタン＋ホバー/フォーカスで内容を示すツールチップ
function IconHintButton({
  icon,
  hint,
  onClick,
  disabled,
  ariaLabel,
}: {
  icon: React.ReactNode
  hint: string
  onClick: () => void
  disabled?: boolean
  ariaLabel: string
}) {
  return (
    <div className="group relative">
      <Button variant="ghost" size="icon" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
        {icon}
      </Button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 max-w-[15rem] whitespace-normal rounded-md border border-border bg-popover px-2 py-1 text-right text-xs text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {hint}
      </span>
    </div>
  )
}

// 折りたたみ状態を localStorage に保持
function useCollapsed(storageKey: string, defaultOpen: boolean) {
  const open = useSyncExternalStore(
    (cb) => {
      window.addEventListener(`toggle:${storageKey}`, cb)
      return () => window.removeEventListener(`toggle:${storageKey}`, cb)
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
  return [open, toggle] as const
}

// ================= タグ1行（ドラッグ対応）=================
function TagChip({
  tag,
  sortId,
  onRename,
  onPin,
  onDelete,
  onRemoveFromGroup,
}: {
  tag: BoardTag
  sortId: string
  onRename: (to: string) => void
  onPin: (to: boolean) => void
  onDelete: () => void
  onRemoveFromGroup?: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: sortId })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(tag.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const save = () => {
    const name = draft.trim()
    if (name && name !== tag.name) onRename(name)
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-1 rounded-xl border px-2 py-2.5 ${
        tag.pinned ? 'border-[var(--palace)]/40 bg-[var(--palace)]/5' : 'border-border bg-card'
      }`}
    >
      {editing ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (isSubmitEnter(e)) {
                e.preventDefault()
                save()
              }
              if (e.key === 'Escape') {
                setEditing(false)
                setDraft(tag.name)
              }
            }}
            autoFocus
            aria-label="タグ名"
            className="max-w-xs"
          />
          <Button size="sm" onClick={save} aria-label="保存">
            <Check size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false)
              setDraft(tag.name)
            }}
            aria-label="キャンセル"
          >
            <X size={16} />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-1">
            <button
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              className="cursor-grab touch-none p-0.5 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
              aria-label="ドラッグして並べ替え"
              title="ドラッグで移動"
            >
              <GripVertical size={15} />
            </button>
            <TagIcon size={15} style={{ color: 'var(--palace)' }} className="shrink-0" />
            <Link href={`/items?tag=${tag.id}`} className="truncate text-sm font-medium hover:underline">
              {tag.name}
            </Link>
            <span className="shrink-0 text-xs text-muted-foreground">{tag.itemCount}</span>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              onClick={() => onPin(!tag.pinned)}
              className="p-1 transition-colors"
              style={tag.pinned ? { color: 'var(--palace)' } : undefined}
              aria-label={tag.pinned ? 'ピン留めを外す' : 'ピン留めする'}
              aria-pressed={tag.pinned}
              title={tag.pinned ? 'ピン留めを外す' : 'ピン留め'}
            >
              <Pin
                size={14}
                fill={tag.pinned ? 'currentColor' : 'none'}
                className={tag.pinned ? '' : 'text-muted-foreground hover:text-foreground'}
              />
            </button>
            <button
              onClick={() => {
                setDraft(tag.name)
                setEditing(true)
              }}
              className="p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="タグ名を編集"
            >
              <Pencil size={14} />
            </button>
            {onRemoveFromGroup && (
              <button
                onClick={onRemoveFromGroup}
                className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                aria-label="このグループから外す"
                title="グループから外す"
              >
                <X size={15} />
              </button>
            )}
            <button
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true)
                  return
                }
                onDelete()
              }}
              onBlur={() => setConfirmDelete(false)}
              className={`p-1 transition-colors ${
                confirmDelete ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'
              }`}
              aria-label="タグを削除"
              title={confirmDelete ? 'もう一度で削除' : 'タグを削除'}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ================= グループ削除ボタン（タグごと削除の選択つき）=================
function GroupDeleteControl({ memberCount, onDelete }: { memberCount: number; onDelete: (deleteTags: boolean) => void }) {
  const [open, setOpen] = useState(false)

  if (memberCount === 0) {
    return (
      <DeleteConfirmButton label="グループを削除" onConfirm={() => onDelete(false)} />
    )
  }
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="p-1.5 text-muted-foreground transition-colors hover:text-destructive"
        aria-label="グループを削除"
        title="グループを削除"
      >
        <Trash2 size={15} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => onDelete(false)}
          className="cursor-pointer"
        >
          グループのみ削除（タグは残す）
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(true)}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          タグごと削除（{memberCount} 件）
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// 2 段階確認の削除ボタン（アイコンのみ）
function DeleteConfirmButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <button
      onClick={() => {
        if (!confirm) {
          setConfirm(true)
          return
        }
        onConfirm()
      }}
      onBlur={() => setConfirm(false)}
      className={`p-1.5 transition-colors ${confirm ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
      aria-label={label}
      title={confirm ? 'もう一度で削除' : label}
    >
      <Trash2 size={15} />
    </button>
  )
}

// グループにタグを追加するドロップダウン（コピー＝元にも残す）
function AddTagControl({ candidates, onAdd }: { candidates: BoardTag[]; onAdd: (tagCid: string) => void }) {
  if (candidates.length === 0) {
    return <p className="px-1 py-1 text-xs text-muted-foreground">追加できるタグがありません</p>
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
        <Plus size={15} />
        タグを追加
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        {candidates.map((tag) => (
          <DropdownMenuItem key={tag.cid} onClick={() => onAdd(tag.cid)} className="cursor-pointer">
            <TagIcon size={14} style={{ color: 'var(--palace)' }} />
            {tag.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ================= グループ1つ（ドラッグ対応＋タグのドロップ先）=================
function GroupCard({ group, board }: { group: BoardGroup; board: TagBoard }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: groupSortId(group.cid),
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: groupDropId(group.cid) })
  const [open, toggle] = useCollapsed(`tags-group-${group.cid}`, !group.isDefault || group.defaultKey === 'science')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(group.name)

  const memberTags = group.tagCids
    .map((cid) => board.tagsByCid.get(cid))
    .filter((t): t is BoardTag => Boolean(t))
  const memberSet = new Set(group.tagCids)
  const candidates = [...board.tagsByCid.values()]
    .filter((t) => !memberSet.has(t.cid))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name, 'ja'))

  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const saveName = () => {
    const name = draft.trim()
    if (name && name !== group.name) board.renameGroup(group.cid, name)
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border p-2 ${
        group.pinned ? 'border-[var(--palace)]/40 bg-[var(--palace)]/5' : 'border-border/60 bg-muted/20'
      } ${isOver ? 'ring-2 ring-[var(--palace)]/40' : ''}`}
    >
      <div className="flex items-center gap-1 px-1">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none p-1 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
          aria-label="ドラッグしてグループを並べ替え"
          title="ドラッグで並べ替え"
        >
          <GripVertical size={16} />
        </button>
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
          aria-expanded={open}
        >
          {open ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
          {editing ? (
            <span className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (isSubmitEnter(e)) {
                    e.preventDefault()
                    saveName()
                  }
                  if (e.key === 'Escape') {
                    setEditing(false)
                    setDraft(group.name)
                  }
                }}
                autoFocus
                aria-label="グループ名"
                className="max-w-xs"
              />
            </span>
          ) : (
            <>
              <span className="truncate text-sm font-semibold">{group.name}</span>
              {group.isDefault && (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  標準
                </span>
              )}
              <span className="shrink-0 text-xs text-muted-foreground">{memberTags.length}</span>
            </>
          )}
        </button>

        {editing ? (
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={saveName} aria-label="グループ名を保存">
              <Check size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false)
                setDraft(group.name)
              }}
              aria-label="キャンセル"
            >
              <X size={16} />
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center">
            <button
              onClick={() => board.setGroupPin(group.cid, !group.pinned)}
              className="p-1.5 transition-colors"
              style={group.pinned ? { color: 'var(--palace)' } : undefined}
              aria-label={group.pinned ? 'ピン留めを外す' : 'ピン留めする'}
              aria-pressed={group.pinned}
              title={group.pinned ? 'ピン留めを外す' : 'ピン留め'}
            >
              <Pin
                size={15}
                fill={group.pinned ? 'currentColor' : 'none'}
                className={group.pinned ? '' : 'text-muted-foreground hover:text-foreground'}
              />
            </button>
            <button
              onClick={() => {
                setDraft(group.name)
                setEditing(true)
              }}
              className="p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="グループ名を編集"
            >
              <Pencil size={15} />
            </button>
            <GroupDeleteControl
              memberCount={memberTags.length}
              onDelete={(deleteTags) => board.deleteGroup(group.cid, deleteTags)}
            />
          </div>
        )}
      </div>

      {open && (
        <div ref={setDropRef} className="min-h-[2.5rem] px-1 pb-1 pt-1">
          <SortableContext items={group.tagCids.map((tc) => tagSortId(group.cid, tc))} strategy={rectSortingStrategy}>
            {memberTags.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {memberTags.map((tag) => (
                  <TagChip
                    key={tag.cid}
                    tag={tag}
                    sortId={tagSortId(group.cid, tag.cid)}
                    onRename={(to) => board.renameTag(tag.cid, to)}
                    onPin={(to) => board.setTagPin(tag.cid, to)}
                    onDelete={() => board.deleteTag(tag.cid)}
                    onRemoveFromGroup={() => board.removeTagFromGroup(group.cid, tag.cid)}
                  />
                ))}
              </div>
            ) : (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                ここにタグをドラッグ、または「タグを追加」で入れられます。
              </p>
            )}
          </SortableContext>
          <div className="mt-2 px-1">
            <AddTagControl candidates={candidates} onAdd={(tagCid) => board.addTagToGroup(group.cid, tagCid)} />
          </div>
        </div>
      )}
    </div>
  )
}

// ================= 未所属セクション（ドロップでグループから外す先）=================
function UngroupedSection({ tags, board }: { tags: BoardTag[]; board: TagBoard }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNGROUPED })
  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="text-sm font-semibold">未所属のタグ</span>
        <span className="text-xs text-muted-foreground">{tags.length}</span>
      </div>
      <div ref={setNodeRef} className={`rounded-xl p-1 ${isOver ? 'ring-2 ring-[var(--palace)]/40' : ''}`}>
        <SortableContext items={tags.map((t) => tagSortId('', t.cid))} strategy={rectSortingStrategy}>
          {tags.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tags.map((tag) => (
                <TagChip
                  key={tag.cid}
                  tag={tag}
                  sortId={tagSortId('', tag.cid)}
                  onRename={(to) => board.renameTag(tag.cid, to)}
                  onPin={(to) => board.setTagPin(tag.cid, to)}
                  onDelete={() => board.deleteTag(tag.cid)}
                />
              ))}
            </div>
          ) : (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              すべてのタグがいずれかのグループに属しています。ここへドラッグすると外せます。
            </p>
          )}
        </SortableContext>
      </div>
    </div>
  )
}

export default function TagsPage() {
  const board = useTagBoard()
  const [newTag, setNewTag] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const [activeLabel, setActiveLabel] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Cmd/Ctrl+Z で undo、Cmd/Ctrl+Shift+Z（または Ctrl+Y）で redo。入力中は無効。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        board.undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        board.redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [board])

  const containerCids = (groupCid: string): string[] =>
    groupCid === ''
      ? board.ungroupedTags.map((t) => t.cid)
      : board.groups.find((g) => g.cid === groupCid)?.tagCids ?? []

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    if (id.startsWith('G:')) {
      setActiveLabel(board.groups.find((g) => g.cid === id.slice(2))?.name ?? null)
    } else if (id.startsWith('T:')) {
      setActiveLabel(board.tagsByCid.get(parseTagId(id).tagCid)?.name ?? null)
    }
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveLabel(null)
    const { active, over } = e
    if (!over) return
    const a = String(active.id)
    const o = String(over.id)

    // グループの並べ替え
    if (a.startsWith('G:')) {
      const from = a.slice(2)
      const toCid = o.startsWith('G:') ? o.slice(2) : o.startsWith('GC:') ? o.slice(3) : null
      if (!toCid || toCid === from) return
      const order = board.groups.map((g) => g.cid)
      const oldIndex = order.indexOf(from)
      const newIndex = order.indexOf(toCid)
      if (oldIndex < 0 || newIndex < 0) return
      board.reorderGroups(arrayMove(order, oldIndex, newIndex))
      return
    }

    // タグの並べ替え／移動
    if (a.startsWith('T:')) {
      const { groupCid: fromG, tagCid } = parseTagId(a)
      let toG: string
      let toIndex: number
      if (o.startsWith('T:')) {
        const p = parseTagId(o)
        toG = p.groupCid
        toIndex = containerCids(toG).indexOf(p.tagCid)
      } else if (o.startsWith('GC:')) {
        toG = o.slice(3)
        toIndex = containerCids(toG).length
      } else if (o === UNGROUPED) {
        toG = ''
        toIndex = 0
      } else {
        return
      }

      if (fromG === toG) {
        if (fromG === '') return // 未所属内の並びは保持しない
        const cids = containerCids(fromG)
        const oldIndex = cids.indexOf(tagCid)
        if (oldIndex >= 0 && toIndex >= 0 && oldIndex !== toIndex) {
          board.reorderTags(fromG, arrayMove(cids, oldIndex, toIndex))
        }
      } else if (toG === '') {
        if (fromG !== '') board.removeTagFromGroup(fromG, tagCid)
      } else if (fromG === '') {
        board.addTagToGroup(toG, tagCid)
      } else {
        board.moveTagBetweenGroups(fromG, toG, tagCid, toIndex < 0 ? containerCids(toG).length : toIndex)
      }
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <TagIcon size={26} style={{ color: 'var(--palace)' }} />
          タグ
        </h1>
        <div className="flex items-center gap-1.5">
          <IconHintButton
            icon={<Undo2 size={16} />}
            ariaLabel="元に戻す"
            hint={board.canUndo && board.undoLabel ? `元に戻す：${board.undoLabel}　⌘Z` : '元に戻す　⌘Z'}
            onClick={() => board.undo()}
            disabled={!board.canUndo}
          />
          <IconHintButton
            icon={<Redo2 size={16} />}
            ariaLabel="やり直す"
            hint={board.canRedo && board.redoLabel ? `やり直す：${board.redoLabel}　⌘⇧Z` : 'やり直す　⌘⇧Z'}
            onClick={() => board.redo()}
            disabled={!board.canRedo}
          />
        </div>
      </div>
      <p className="mb-6 text-muted-foreground">
        タグの作成・編集・削除、タイトル付き「グループ」での整理ができます。ドラッグで並べ替え・グループ間の移動、
        <span className="whitespace-nowrap">⌘Z / ⌘⇧Z</span> で戻す・進むができます。
      </p>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (newTag.trim()) {
              board.addTag(newTag.trim())
              setNewTag('')
            }
          }}
          className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-start"
        >
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="新しいタグ名（例: 英語、IT）"
            aria-label="新しいタグ名"
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={!newTag.trim()} className="flex items-center gap-1.5">
            <Plus size={16} />
            タグ作成
          </Button>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (newGroup.trim()) {
              board.addGroup(newGroup.trim())
              setNewGroup('')
            }
          }}
          className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-start"
        >
          <Input
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="新しいタググループ名（例: 語学、資格）"
            aria-label="新しいタググループ名"
            className="flex-1"
          />
          <Button type="submit" variant="outline" size="sm" disabled={!newGroup.trim()} className="flex items-center gap-1.5">
            <FolderPlus size={16} />
            グループ作成
          </Button>
        </form>
      </div>

      {board.error && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
          <p className="text-sm text-destructive">{board.error}</p>
          <button onClick={() => board.setError(null)} aria-label="閉じる" className="text-destructive/70 hover:text-destructive">
            <X size={16} />
          </button>
        </div>
      )}

      {board.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl border border-border" />
          ))}
        </div>
      ) : board.isEmpty ? (
        <p className="py-12 text-center text-muted-foreground">
          まだタグがありません。カード詳細でタグを付けると、ここに表示されます。
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveLabel(null)}
        >
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="text-sm font-semibold">タググループ</span>
                <span className="text-xs text-muted-foreground">{board.groups.length}</span>
              </div>
              <SortableContext items={board.groups.map((g) => groupSortId(g.cid))} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {board.groups.map((group) => (
                    <GroupCard key={group.cid} group={group} board={board} />
                  ))}
                </div>
              </SortableContext>
              {board.groups.length === 0 && (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  まだグループがありません。「グループ作成」から追加できます。
                </p>
              )}
            </div>
            <UngroupedSection tags={board.ungroupedTags} board={board} />
          </div>
          <DragOverlay>
            {activeLabel ? (
              <div className="rounded-xl border border-[var(--palace)]/40 bg-card px-3 py-2 text-sm font-medium shadow-lg">
                {activeLabel}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
