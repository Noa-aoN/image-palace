'use client'

import { useEffect, useState } from 'react'
import { Loader2, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getItemTypes, updateItem } from '@/lib/api/items'
import type { Item, ItemType } from '@/types/item'

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
            <button
              onClick={startEditMeaning}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="意味・説明を編集"
            >
              <Pencil size={15} />
            </button>
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
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{item.meaning}</p>
        ) : (
          <p className="text-sm text-muted-foreground">未設定（鉛筆アイコンから追加できます）</p>
        )}
      </div>
    </div>
  )
}
