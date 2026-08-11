'use client'

import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import {
  ENTITY_COLUMN_CHOICES,
  ENTITY_GROUPING_LABELS,
  ENTITY_SORT_LABELS,
  type EntityGrouping,
  type EntityListDisplay,
  type EntitySort,
} from '@/hooks/useEntityListDisplay'

/**
 * 入れ物の一覧（キャンバス・スペース・ボックス）の見え方。
 *
 * カード一覧の「表示」（CardDisplayPanel）と同じ作りにする。
 * 置き場所も、押したときの出方も揃える。一覧ごとに違う開き方をすると、
 * 「ここでは何ができるのか」を面ごとに覚え直すことになる。
 *
 * 中身は右パネルで開く。棚そのものを見る面積を、設定のために削らない。
 * 保存ボタンは置かない（押した瞬間に結果が見えるので、確定させる操作に意味がない）。
 */
export function EntityDisplayPanel({
  panelKey,
  display,
  onChange,
  metaLabel,
  sorts = ['recent', 'name', 'size'],
  groupable = false,
}: {
  /** 一覧ごとに分ける。まとめると別の一覧の設定まで動く */
  panelKey: string
  display: EntityListDisplay
  onChange: (patch: Partial<EntityListDisplay>) => void
  /** 札の右に添えるものの呼び名（カードの数 / 種別 など） */
  metaLabel: string
  /** 選べる並び順。件数を持たない一覧では「中身が多い順」を出さない */
  sorts?: EntitySort[]
  /** 種別を持つ一覧（キャンバス・スペース）だけ、まとめ方を選べるようにする */
  groupable?: boolean
}) {
  const panel = usePanelForm(`${panelKey}-display`, '表示')

  return (
    <>
      <Button variant="outline" size="sm" onClick={panel.open} aria-expanded={panel.isOpen}>
        <LayoutGrid size={14} className="mr-1" />
        表示
      </Button>

      <PanelSlotContent sectionKey={`${panelKey}-display`}>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>列の数</Label>
            <div className="flex flex-wrap gap-1.5">
              {ENTITY_COLUMN_CHOICES.map((columns) => (
                <Choice
                  key={columns}
                  active={display.columns === columns}
                  onClick={() => onChange({ columns })}
                  label={String(columns)}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              狭い画面では自動で減ります。ここで決めるのは広い画面での数です。
            </p>
          </div>

          <div className="space-y-2">
            <Label>並び順</Label>
            <div className="flex flex-wrap gap-1.5">
              {sorts.map((sort) => (
                <Choice
                  key={sort}
                  active={display.sort === sort}
                  onClick={() => onChange({ sort })}
                  label={ENTITY_SORT_LABELS[sort]}
                />
              ))}
            </div>
          </div>

          {groupable && (
            <div className="space-y-2">
              <Label>まとめ方</Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(ENTITY_GROUPING_LABELS) as EntityGrouping[]).map((grouping) => (
                  <Choice
                    key={grouping}
                    active={display.grouping === grouping}
                    onClick={() => onChange({ grouping })}
                    label={ENTITY_GROUPING_LABELS[grouping]}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                種別ごとに分けると、探すときに種別を読まずに済みます。数が少ないうちは、まとめたほうが詰まって見えます。
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>札に出すもの</Label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={display.showMeta}
                onChange={(e) => onChange({ showMeta: e.target.checked })}
              />
              {metaLabel}を出す
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            この設定はこの端末に覚えます。別の端末では別に決められます。
          </p>
        </div>
      </PanelSlotContent>
    </>
  )
}

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1 text-sm transition-colors ${
        active ? 'border-[var(--palace)] text-[var(--palace)]' : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )
}
