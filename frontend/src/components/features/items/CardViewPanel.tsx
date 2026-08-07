'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip } from '@/components/ui/tooltip'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { updateBlockView } from '@/lib/api/items'
import type { Item } from '@/types/item'

export const CARD_VIEW_PANEL_KEY = 'item-card-view'

/** 並べ替え・表示切替の対象になるブロック1つぶん */
export interface CardBlock {
  key: string
  label: string
}

/**
 * このカードの見え方。**この1枚だけ**に効く。
 *
 * 「項目の設定」（種別ぜんぶに効く）と混ぜない。あちらは持つ項目そのもの、
 * こちらは持っているもののうち何をどの順で出すか。
 * 同じ画面に置くと、どこまで効くのか分からなくなる。
 *
 * 隠しても中身は消えない。畳んでいるだけなので、いつでも戻せる。
 */
export function CardViewPanel({
  item,
  blocks,
  onUpdated,
}: {
  item: Item
  /** 既定の並びのブロック一覧（並べ替え適用後） */
  blocks: CardBlock[]
  onUpdated: (item: Item) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hidden = new Set(item.block_view?.hidden ?? [])

  const save = async (nextHidden: string[], nextOrder: string[]) => {
    setBusy(true)
    setError(null)
    try {
      onUpdated(await updateBlockView(item.id, { hidden: nextHidden, order: nextOrder }))
    } catch {
      setError('保存できませんでした。もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (key: string) => {
    const next = hidden.has(key)
      ? [...hidden].filter((k) => k !== key)
      : [...hidden, key]
    save(next, blocks.map((b) => b.key))
  }

  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction
    if (next < 0 || next >= blocks.length) return

    const order = blocks.map((b) => b.key)
    ;[order[index], order[next]] = [order[next], order[index]]
    save([...hidden], order)
  }

  return (
    <PanelSlotContent sectionKey={CARD_VIEW_PANEL_KEY}>
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          このカード1枚だけの見え方です。隠しても中身は消えません。
          <br />
          どの項目を持つかは「項目の設定」で決めます（そちらは種別ぜんぶに効きます）。
        </p>

        {blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">並べ替えられるものがありません。</p>
        ) : (
          <div className="space-y-1.5">
            {blocks.map((block, index) => {
              const isHidden = hidden.has(block.key)
              return (
                <div
                  key={block.key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 py-2"
                >
                  <span className={`truncate text-sm ${isHidden ? 'text-muted-foreground line-through' : ''}`}>
                    {block.label}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                    <IconButton label="上へ" disabled={busy || index === 0} onClick={() => move(index, -1)}>
                      <ChevronUp size={15} />
                    </IconButton>
                    <IconButton
                      label="下へ"
                      disabled={busy || index === blocks.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown size={15} />
                    </IconButton>
                    <IconButton
                      label={isHidden ? '出す' : '隠す'}
                      disabled={busy}
                      onClick={() => toggle(block.key)}
                    >
                      {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
                    </IconButton>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {busy && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner size={12} />
            保存中…
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </PanelSlotContent>
  )
}

function IconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="transition-colors hover:text-foreground disabled:opacity-30"
      >
        {children}
      </button>
    </Tooltip>
  )
}

/**
 * 既定の並びに、このカードの指定を当てる。
 * 指定に無いブロック（あとから増えた項目）は、既定の位置のまま後ろへ残す。
 */
export function applyBlockOrder<T extends { key: string }>(blocks: T[], order: string[] | undefined): T[] {
  if (!order || order.length === 0) return blocks

  const rank = new Map(order.map((key, index) => [key, index]))
  return [...blocks].sort((a, b) => (rank.get(a.key) ?? Infinity) - (rank.get(b.key) ?? Infinity))
}
