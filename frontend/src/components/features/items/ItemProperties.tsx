'use client'

import { useEffect, useState } from 'react'
import { Loader2, Pencil, Check, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getItemTypes, updateItem, generateMeaning } from '@/lib/api/items'
import { getTags } from '@/lib/api/tags'
import type { Item, ItemType } from '@/types/item'
import type { Tag } from '@/types/tag'

type ItemPropertiesProps = {
  item: Item
  /** 更新後のItemを親（詳細画面・ストア）へ反映する */
  onUpdated: (item: Item) => void
}

/**
 * カードのプロパティ（種別・意味）編集。
 * 種別は選択即保存、意味はインライン編集で保存する。
 */
export function ItemProperties({ item, onUpdated }: ItemPropertiesProps) {
  const [itemTypes, setItemTypes] = useState<ItemType[]>([])
  const [savingType, setSavingType] = useState(false)
  const [typeError, setTypeError] = useState<string | null>(null)

  const [editingMeaning, setEditingMeaning] = useState(false)
  const [meaningDraft, setMeaningDraft] = useState('')
  const [savingMeaning, setSavingMeaning] = useState(false)
  const [meaningError, setMeaningError] = useState<string | null>(null)
  const [generatingMeaning, setGeneratingMeaning] = useState(false)

  const handleGenerateMeaning = async () => {
    setGeneratingMeaning(true)
    setMeaningError(null)
    try {
      const updated = await generateMeaning(item.id)
      onUpdated(updated)
    } catch {
      setMeaningError('意味の生成に失敗しました。時間を置いて再度お試しください。')
    } finally {
      setGeneratingMeaning(false)
    }
  }

  const [tagDraft, setTagDraft] = useState('')
  const [tagFocused, setTagFocused] = useState(false)
  const [savingTags, setSavingTags] = useState(false)
  const [tagError, setTagError] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<Tag[]>([])

  const tags = item.tags ?? []

  // 既存タグ（入力候補用）
  const loadAllTags = () => {
    getTags()
      .then(setAllTags)
      .catch(() => {})
  }
  useEffect(() => {
    loadAllTags()
  }, [])

  // まだ付いていない既存タグを候補に出す。
  // 未入力（フォーカスのみ）ならよく使われる順、入力中は該当するものを絞り込む。
  const tagQuery = tagDraft.trim().toLowerCase()
  const tagSuggestions = allTags
    .filter((t) => !tags.some((cur) => cur.name.toLowerCase() === t.name.toLowerCase()))
    .filter((t) => tagQuery.length === 0 || t.name.toLowerCase().includes(tagQuery))
    .sort((a, b) => b.item_count - a.item_count)
  const showTagSuggestions = tagFocused && tagSuggestions.length > 0

  const saveTags = async (names: string[]) => {
    setSavingTags(true)
    setTagError(null)
    try {
      const updated = await updateItem(item.id, { tags: names })
      onUpdated(updated)
      loadAllTags()
    } catch {
      setTagError('タグの更新に失敗しました')
    } finally {
      setSavingTags(false)
    }
  }

  const addTagName = async (raw: string) => {
    const name = raw.trim()
    if (!name) return
    setTagDraft('')
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) return
    await saveTags([...tags.map((t) => t.name), name])
  }

  const handleRemoveTag = async (tagId: string) => {
    await saveTags(tags.filter((t) => t.id !== tagId).map((t) => t.name))
  }

  useEffect(() => {
    let cancelled = false
    getItemTypes()
      .then((types) => {
        if (!cancelled) setItemTypes(types)
      })
      .catch(() => {
        // 種別一覧の取得失敗時はセレクタを出さない（致命的ではない）
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleTypeChange = async (itemTypeId: string) => {
    if (!itemTypeId || itemTypeId === item.item_type?.id) return
    setSavingType(true)
    setTypeError(null)
    try {
      const updated = await updateItem(item.id, { item_type_id: itemTypeId })
      onUpdated(updated)
    } catch {
      setTypeError('種別の更新に失敗しました')
    } finally {
      setSavingType(false)
    }
  }

  const startEditMeaning = () => {
    setMeaningDraft(item.meaning ?? '')
    setMeaningError(null)
    setEditingMeaning(true)
  }

  const handleSaveMeaning = async () => {
    const trimmed = meaningDraft.trim()
    if (trimmed === (item.meaning ?? '')) {
      setEditingMeaning(false)
      return
    }
    setSavingMeaning(true)
    setMeaningError(null)
    try {
      const updated = await updateItem(item.id, { meaning: trimmed })
      onUpdated(updated)
      setEditingMeaning(false)
    } catch {
      setMeaningError('意味・説明の更新に失敗しました')
    } finally {
      setSavingMeaning(false)
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-border/70 bg-muted/30 px-4 py-4">
      {/* 種別 */}
      <div className="space-y-1.5">
        <label htmlFor="item-type" className="block text-sm font-medium">
          種別
        </label>
        <div className="flex items-center gap-2">
          <select
            id="item-type"
            value={item.item_type?.id ?? ''}
            onChange={(e) => handleTypeChange(e.target.value)}
            disabled={savingType || itemTypes.length === 0}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {itemTypes.length === 0 && <option value="">読み込み中...</option>}
            {item.item_type == null && itemTypes.length > 0 && <option value="">未設定</option>}
            {itemTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
          {savingType && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
        </div>
        {typeError && <p className="text-xs text-destructive">{typeError}</p>}
      </div>

      {/* 意味・説明 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">意味・説明</span>
          {!editingMeaning && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateMeaning}
                disabled={generatingMeaning}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                aria-label="AIで意味・説明を生成"
                title="AIで生成"
              >
                {generatingMeaning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {item.meaning ? '再生成' : 'AIで生成'}
              </button>
              <button
                onClick={startEditMeaning}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="意味・説明を編集"
              >
                <Pencil size={15} />
              </button>
            </div>
          )}
        </div>

        {editingMeaning ? (
          <div className="space-y-2">
            <textarea
              value={meaningDraft}
              onChange={(e) => setMeaningDraft(e.target.value)}
              disabled={savingMeaning}
              autoFocus
              rows={3}
              placeholder="このカードの意味や説明を入力（空にすると削除されます）"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveMeaning} disabled={savingMeaning} className="flex items-center gap-1.5">
                {savingMeaning ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                保存
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingMeaning(false)}
                disabled={savingMeaning}
                className="flex items-center gap-1.5"
              >
                <X size={14} />
                キャンセル
              </Button>
            </div>
            {meaningError && <p className="text-xs text-destructive">{meaningError}</p>}
          </div>
        ) : item.meaning ? (
          <div className="space-y-1.5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{item.meaning}</p>
            {item.meaning_example && (
              <p className="text-xs leading-relaxed text-muted-foreground border-l-2 border-border pl-2">
                例: {item.meaning_example}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">未設定（「AIで生成」または鉛筆アイコンから追加できます）</p>
        )}
        {!editingMeaning && meaningError && <p className="text-xs text-destructive">{meaningError}</p>}
      </div>

      {/* タグ */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">タグ</span>
          {savingTags && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
                style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: '#7a6432' }}
              >
                {tag.name}
                <button
                  onClick={() => handleRemoveTag(tag.id)}
                  disabled={savingTags}
                  aria-label={`タグ「${tag.name}」を外す`}
                  className="hover:text-foreground transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative max-w-xs">
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onFocus={() => setTagFocused(true)}
            onBlur={() => setTagFocused(false)}
            onKeyDown={(e) => {
              // IME変換確定の Enter では追加しない（確定後、再度 Enter で設定）
              if (e.key !== 'Enter') return
              if (e.nativeEvent.isComposing) return
              e.preventDefault()
              addTagName(tagDraft)
            }}
            disabled={savingTags}
            placeholder="タグを入力して Enter"
            aria-label="タグを追加"
            autoComplete="off"
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {showTagSuggestions && (
            <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {tagSuggestions.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    // blur より先に発火させてクリックを成立させる
                    onMouseDown={(e) => { e.preventDefault(); addTagName(t.name) }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="truncate">{t.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{t.item_count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {tagError && <p className="text-xs text-destructive">{tagError}</p>}
      </div>
    </div>
  )
}
