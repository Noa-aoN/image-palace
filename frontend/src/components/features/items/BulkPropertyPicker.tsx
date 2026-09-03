'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { getPropertyDefinitions, propertyCategoryOf } from '@/lib/api/properties'
import type { PropertyDefinition } from '@/lib/api/properties'
import type { Item } from '@/types/item'

export const BULK_PROPERTY_PANEL_KEY = 'items-bulk-property'

/**
 * 選んだカードの、**どの項目を埋めるか**を選ぶ。
 *
 * 「未設定だけ埋める」は全部の項目が対象になる。だが
 * 「読み方だけ入れたい」「出典だけ揃えたい」という場面のほうが多い。
 * 全部走らせると、要らない項目にも文章生成の費用が乗る。
 *
 * **ドロップダウンには入れない。** 項目は分野ごとに増えるので、
 * 一覧と複数選択が要る。設定が要るものはパネルで開く。
 */
export function BulkPropertyPicker({
  selected,
  onRun,
  onClose,
}: {
  /** いま選んでいるカード。**対象を見失わせない**ために帯で出す */
  selected: Item[]
  /** 選んだ項目で走らせる。上書きするかもここで決める */
  onRun: (keys: string[], overwrite: boolean) => void
  onClose: () => void
}) {
  const [definitions, setDefinitions] = useState<PropertyDefinition[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [overwrite, setOverwrite] = useState(false)

  useEffect(() => {
    getPropertyDefinitions()
      .then(setDefinitions)
      .catch(() => setDefinitions([]))
  }, [])

  // 同じ識別名が種別をまたいで存在しうるので畳む
  // （「読み方」を種別ごとに作っていても、選ぶのは1つ）
  const rows = Array.from(
    new Map((definitions ?? []).map((d) => [ d.key, d ])).values()
  )

  const toggle = (key: string) =>
    setPicked((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [ ...current, key ]
    )

  return (
    <PanelSlotContent sectionKey={BULK_PROPERTY_PANEL_KEY}>
      <div className="space-y-4">
        {/* **何枚に効くのかだけ言う。** 絵を並べると、選んだ数だけ画像を読みに行く。
            ここで要るのは「取り違えていないか」の確認で、それは数で足りる */}
        <p className="text-sm text-muted-foreground">
          選んだ <span className="font-medium text-foreground">{selected.length}</span> 枚の項目を埋めます
        </p>

        {definitions === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={14} />
            読み込み中…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            項目がまだありません。「項目の設定」から作れます。
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">埋める項目を選んでください</p>
            {rows.map((row) => {
              const role = propertyCategoryOf(row.category)
              return (
                <label key={row.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.includes(row.key)}
                    onChange={() => toggle(row.key)}
                  />
                  <span className="min-w-0 truncate">{row.label}</span>
                  {/* 役割を添える。同じ名前の項目が複数あっても見分けられる */}
                  <span className="shrink-0 text-3xs" style={{ color: role.accent }}>
                    {role.label}
                  </span>
                </label>
              )
            })}
          </div>
        )}

        {/* **上書きは既定にしない。** 手で書いたものが黙って消えるのを避ける */}
        <label className="flex items-start gap-2 border-t border-border/60 pt-3 text-sm">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            className="mt-1"
          />
          <span>
            書いてあるものも作り直す
            <span className="block text-xs text-muted-foreground">
              手で書いた内容も置き換わります。取り消せません。
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => onRun(picked, overwrite)}
            disabled={picked.length === 0}
          >
            {picked.length > 0 ? `${picked.length} 項目を埋める` : '項目を選んでください'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            やめる
          </Button>
        </div>
      </div>
    </PanelSlotContent>
  )
}
