'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/stores/settings'
import {
  LIBRARY_SECTIONS,
  LIBRARY_SECTION_LABELS,
  moveLibrarySection,
  normalizeLibraryOrder,
} from '@/lib/library-sections'

/**
 * ライブラリの棚の並び替え。
 *
 * 何をよく使うかは人によって違う。カードから見たい人もいれば、
 * スペースを起点に動く人もいる。上下ボタンで動かせるようにする。
 *
 * つかんで動かす方式は端末によって扱いづらく、項目も5つと少ないので採らない。
 */
export function LibraryOrderSetting() {
  const settings = useSettingsStore((s) => s.settings)
  const patchSettings = useSettingsStore((s) => s.patchSettings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const order = normalizeLibraryOrder(settings?.library_order)
  const isDefault = order.every((key, index) => key === LIBRARY_SECTIONS[index])

  const save = async (next: string[]) => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await patchSettings({ library_order: next })
    } catch {
      setError('並び順を保存できませんでした')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">棚の並び順</p>
        {!isDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => save([])}
            disabled={saving}
            className="flex items-center gap-1 text-xs"
          >
            <RotateCcw size={13} />
            既定に戻す
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">ライブラリで棚が並ぶ順番を変えられます。</p>

      <ul className="space-y-1.5">
        {order.map((key, index) => (
          <li
            key={key}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
          >
            <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
            <span className="flex-1 truncate text-sm">{LIBRARY_SECTION_LABELS[key]}</span>
            <button
              type="button"
              onClick={() => save(moveLibrarySection(order, index, -1))}
              disabled={saving || index === 0}
              aria-label={`${LIBRARY_SECTION_LABELS[key]}を1つ上へ`}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              onClick={() => save(moveLibrarySection(order, index, 1))}
              disabled={saving || index === order.length - 1}
              aria-label={`${LIBRARY_SECTION_LABELS[key]}を1つ下へ`}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ChevronDown size={16} />
            </button>
          </li>
        ))}
      </ul>

      {saving && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
