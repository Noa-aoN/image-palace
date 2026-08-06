'use client'

import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import {
  CARD_COLUMN_CHOICES,
  CARD_PER_PAGE_CHOICES,
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

  return (
    <>
      <Button variant="outline" size="sm" onClick={panel.open} aria-expanded={panel.isOpen}>
        <LayoutGrid size={14} className="mr-1" />
        表示
      </Button>

      <PanelSlotContent sectionKey={PANEL_KEY}>
        <div className="space-y-5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            この端末での見え方です。ほかの端末やほかの人の画面は変わりません。
          </p>

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
                ? 'すべて正方形にして、画像は余白を付けて全体を収めます。縦横比の違うカードが混ざっても棚が波打ちません。'
                : 'カードの縦横比そのままで並べます。画像は枠いっぱいに入ります。'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>1行の枚数</Label>
            <div className="flex flex-wrap gap-2">
              {CARD_COLUMN_CHOICES.map((count) => (
                <Chip key={count} active={display.columns === count} onClick={() => onChange({ columns: count })}>
                  {count}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">画面が広いときの枚数です。狭い画面では自動で減ります。</p>
          </div>

          <div className="space-y-2">
            <Label>1ページの枚数</Label>
            <div className="flex flex-wrap gap-2">
              {CARD_PER_PAGE_CHOICES.map((count) => (
                <Chip key={count} active={display.perPage === count} onClick={() => onChange({ perPage: count })}>
                  {count}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              多くすると送りの回数は減りますが、そのぶん1回の読み込みが重くなります。
            </p>
          </div>
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
