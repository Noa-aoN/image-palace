'use client'

import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import {
  CARD_COLUMN_CHOICES,
  CARD_ROW_CHOICES,
  MAX_CARDS_PER_PAGE,
  availableRowChoices,
  cardsPerPage,
  type CardDisplay,
} from '@/hooks/useCardDisplay'

const PANEL_KEY = 'items-display'

/**
 * カード一覧の見え方の設定。
 *
 * 一覧に置くのはボタン1つだけで、中身は右パネルで開く。
 * 作り直しパネルと同じ作りにして、置き場所が違っても迷わないようにする。
 * 棚そのものを見る面積を、設定のために削らないためでもある。
 *
 * 値は端末ごとに覚える（useCardDisplay）。保存ボタンは置かない。
 * 見え方は押した瞬間に結果が見えるので、確定させる操作を挟む意味がない。
 */
export function CardDisplayPanel({
  display,
  onChange,
}: {
  display: CardDisplay
  onChange: (patch: Partial<CardDisplay>) => void
}) {
  const panel = usePanelForm(PANEL_KEY, '表示')
  const rowChoices = availableRowChoices(display.columns)
  const perPage = cardsPerPage(display)

  return (
    <>
      <Button variant="outline" size="sm" onClick={panel.open} aria-expanded={panel.isOpen}>
        <LayoutGrid size={14} className="mr-1" />
        表示
      </Button>

      <PanelSlotContent sectionKey={PANEL_KEY}>
        <div className="space-y-5">
          {/* 説明は「選ぶと何が変わるか」だけに絞る。仕組みの話（枚数でなく行数で持つ等）は
              下の「◯列 × ◯行 ＝ ◯枚」を見れば分かるので、文にはしない */}
          <p className="text-xs text-muted-foreground">この端末だけの設定です。</p>

          <div className="space-y-2">
            <Label>画像の収め方</Label>
            <div className="flex flex-wrap gap-2">
              <Chip active={display.fit === 'natural'} onClick={() => onChange({ fit: 'natural' })}>
                実寸
              </Chip>
              <Chip active={display.fit === 'uniform'} onClick={() => onChange({ fit: 'uniform' })}>
                そろえる
              </Chip>
            </div>
            <p className="text-xs text-muted-foreground">
              {display.fit === 'uniform'
                ? '正方形にそろえ、余白を付けて画像全体を収めます。棚が波打ちません。'
                : 'カードの縦横比のまま、画像は枠いっぱいに入ります。'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>列数</Label>
            <div className="flex flex-wrap gap-2">
              {CARD_COLUMN_CHOICES.map((count) => (
                <Chip key={count} active={display.columns === count} onClick={() => onChange({ columns: count })}>
                  {count}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              広い画面での列数です。狭い画面では自動で減り、多いほど単語名は省略されます。
            </p>
          </div>

          <div className="space-y-2">
            <Label>1ページの行数</Label>
            <div className="flex flex-wrap gap-2">
              {rowChoices.map((count) => (
                <Chip key={count} active={display.rows === count} onClick={() => onChange({ rows: count })}>
                  {count}
                </Chip>
              ))}
            </div>
            {rowChoices.length < CARD_ROW_CHOICES.length && (
              <p className="text-xs text-muted-foreground">1ページ {MAX_CARDS_PER_PAGE} 枚までです。</p>
            )}
          </div>

          <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">
              {display.columns} 列 × {display.rows} 行
            </strong>{' '}
            ＝ 1ページ <strong className="text-foreground">{perPage} 枚</strong>
          </p>
        </div>
      </PanelSlotContent>
    </>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
      }`}
      style={active ? { backgroundColor: 'var(--palace)' } : undefined}
    >
      {children}
    </button>
  )
}
