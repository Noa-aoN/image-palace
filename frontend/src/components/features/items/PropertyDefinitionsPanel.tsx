'use client'

import { useCallback, useEffect, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { CardPropertiesEditor } from '@/components/features/settings/CardPropertiesEditor'
import { getPropertyDefinitions, type PropertyDefinition } from '@/lib/api/properties'
import type { ItemType } from '@/types/item'

export const PROPERTY_DEFINITIONS_PANEL_KEY = 'item-property-definitions'

/**
 * カードが持つ項目の定義。**その種別のカード全部に効く。**
 *
 * 1枚のカードの上で編集させると、効く範囲が分からなくなる（1枚だけ変えたつもりが
 * 全部に効く）。値はカードの画面、定義はここ、と入口を分けてある。
 *
 * 中身は環境設定の「カードの項目」と同じものを使う。触れる場所が2つあるだけで、
 * 意味が変わらないようにする。
 */
export function PropertyDefinitionsPanel({
  itemType,
  onChanged,
}: {
  itemType: ItemType | null | undefined
  /** 定義が変わったら、開いているカードを取り直してもらう */
  onChanged: () => void
}) {
  const panel = usePanelForm(PROPERTY_DEFINITIONS_PANEL_KEY, '項目の設定')
  const [definitions, setDefinitions] = useState<PropertyDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const itemTypeId = itemType?.id

  const load = useCallback(async () => {
    if (!itemTypeId) return setDefinitions([])

    setLoading(true)
    try {
      setDefinitions(await getPropertyDefinitions(itemTypeId))
      setError(null)
    } catch {
      setError('項目を読み込めませんでした')
    } finally {
      setLoading(false)
    }
  }, [itemTypeId])

  useEffect(() => {
    if (panel.isOpen) load()
  }, [panel.isOpen, load])

  return (
    <PanelSlotContent sectionKey={PROPERTY_DEFINITIONS_PANEL_KEY}>
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {itemType
            ? `種別「${itemType.label}」のカード全部に効きます。1枚だけ変えたいときは「表示」から。`
            : 'まず種別を選んでください。項目は種別ごとに決めます。'}
        </p>

        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={14} />
            読み込み中…
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}

        {itemType && !loading && (
          <CardPropertiesEditor
            itemType={itemType}
            definitions={definitions}
            onChanged={async () => {
              await load()
              onChanged()
            }}
          />
        )}
      </div>
    </PanelSlotContent>
  )
}
