'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Plus, X, ChevronUp, ChevronDown, GripVertical, List, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getItems } from '@/lib/api/items'
import { addDeckCard, removeViewItem, reorderDeckCards } from '@/lib/api/views'
import { ItemCard } from '@/components/features/items/ItemCard'
import { CardDisplayPanel } from '@/components/features/items/CardDisplayPanel'
import { CARD_GRID_CLASSES } from '@/lib/card-grid'
import { cardImageSizes, useCardDisplay } from '@/hooks/useCardDisplay'
import { densityFor } from '@/lib/items/card-density'
import { readDeckLayout, writeDeckLayout, type DeckLayout } from '@/lib/views/deck-layout'
import type { ViewItemPlacement } from '@/types/view'
import type { Item } from '@/types/item'

/**
 * deck 種別のキャンバス本体：カードの順序付きリスト（追加・削除・並び替え）。
 *
 * 見せ方を2つ持つ。
 *   リスト … 並びを直すための形。順番・つまみ・外すが1行に収まる
 *   カード … 中身を読むための形。**一覧とまったく同じ札**を使う
 *
 * 別々に描くと、同じカードなのに一覧とデッキで見え方が違うことになる。
 * 札は `ItemCard` を借りて、並べ方の設定（何をどの順で積むか）もサーバーから受け取る。
 */
export function DeckBoard({
  viewId,
  initialItems,
  cardList,
  aiEditAction,
  aiEditHistoryActions,
  onCountChange,
  onLayoutSaved,
}: {
  viewId: string
  initialItems: ViewItemPlacement[]
  /** 並べ方の設定。キャンバスに1回だけ付いてくる */
  cardList?: { blocks: string[]; image: boolean; type_mark: boolean }
  /**
   * AI の操作。**このツールバーに混ぜて受け取る。**
   * 別の行に置くと、同じキャンバスへの操作が2段に分かれて、
   * どちらを見ればよいのか分からなくなる（フリーボードと同じ形にする）
   */
  aiEditAction?: ReactNode
  aiEditHistoryActions?: ReactNode
  /** 枚数は見出しの隣に出す。中で増減するので、変わったら知らせる */
  onCountChange?: (count: number) => void
  /**
   * 出す項目の設定を保存し終えたとき。
   * 項目の並びはサーバーが解決して返すので、**保存しただけでは札は変わらない**
   */
  onLayoutSaved?: () => void
}) {
  // 見え方の設定は**一覧と同じものを使う**。デッキだけ列数が違うと、
  // 同じ札なのに幅が変わり、読める字の量も変わる
  const [display, changeDisplay] = useCardDisplay()
  const [items, setItems] = useState<ViewItemPlacement[]>(initialItems)

  // 枚数の持ち主はここ（増減するのはここでの操作）。見出しへは知らせるだけ。
  // **効果で送らない。** 増減した瞬間に呼べば、余計な描き直しが1回減る
  const replaceItems = (next: ViewItemPlacement[]) => {
    setItems(next)
    onCountChange?.(next.length)
  }
  // 見せ方は端末に覚えさせる。**この人がどう見たいか**であって、デッキの性質ではない
  const [layout, setLayout] = useState<DeckLayout>(() => readDeckLayout())

  const changeLayout = (next: DeckLayout) => {
    setLayout(next)
    writeDeckLayout(next)
  }
  const [picking, setPicking] = useState(false)
  const [allItems, setAllItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  // つまみを押している行だけが動かせる
  const [grabbed, setGrabbed] = useState<number | null>(null)

  const placedIds = new Set(items.map((i) => i.item_id))

  const openPicker = async () => {
    setPicking(true)
    if (allItems.length === 0) {
      try {
        setAllItems(await getItems())
      } catch {
        // 取得失敗時はピッカーが空になるだけ
      }
    }
  }

  const addCard = async (item: Item) => {
    setBusy(true)
    try {
      await addDeckCard(viewId, item.id)
      replaceItems([
        ...items,
        {
          item_id: item.id,
          x: 0,
          y: 0,
          z_index: 0,
          item: { id: item.id, title: item.title, generation_status: item.generation_status, media: item.media ?? null },
        },
      ])
    } catch {
      // noop
    } finally {
      setBusy(false)
    }
  }

  const removeCard = async (itemId: string) => {
    setBusy(true)
    try {
      await removeViewItem(viewId, itemId)
      replaceItems(items.filter((i) => i.item_id !== itemId))
    } catch {
      // noop
    } finally {
      setBusy(false)
    }
  }

  const persistOrder = async (ordered: ViewItemPlacement[]) => {
    try {
      await reorderDeckCards(viewId, ordered.map((i) => i.item_id))
    } catch {
      // noop（楽観更新のまま）
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)
    await persistOrder(next)
  }

  // ドラッグ中は target の位置へ即時に差し込む（楽観更新）。確定は dragEnd で永続化。
  const handleDragOver = (index: number) => {
    if (dragIndex === null || dragIndex === index) return
    const next = [...items]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(index, 0, moved)
    setItems(next)
    setDragIndex(index)
  }

  const handleDragEnd = () => {
    if (dragIndex !== null) persistOrder(items)
    setDragIndex(null)
  }

  return (
    <div className="flex-1">
      {/*
        **操作は1行に収める。** カードを足す・AI に整えさせる・戻す／進む・見せ方を変える。
        フリーボードと同じ並べ方にする（主な操作を左端に色付きで、
        履歴はそのあと、見せ方だけを右端へ）。

        枚数はここに出さない。**見出しの隣**にあるほうが、
        「このデッキが何枚か」として読める（操作の一部ではない）
      */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={openPicker} className="flex items-center gap-1">
          <Plus size={15} />
          カードを追加
        </Button>
        {aiEditAction}
        {aiEditHistoryActions}

        {/* 掴む場所は見れば分かるものではないので、一言添える
            （フリーボードが操作の要点を右端に置いているのと同じ形） */}
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          つまみを掴んで並び替えられます
        </span>

        {/* 出す項目・列数・画像の収め方。**一覧と同じパネルを開く。**
            行数（ページ送り）だけはデッキに無いので出さない。
            カードで見るときにしか効かないので、そのときだけ出す */}
        {layout === 'card' && (
          <CardDisplayPanel
            display={display}
            onChange={changeDisplay}
            onLayoutSaved={onLayoutSaved}
            showRows={false}
          />
        )}

        {/* **並びを直すのと、中身を読むのは別の用事。**
            リストは順番・つまみ・外すが1行に収まる。カードは一覧と同じ札で読める。
            見せ方は操作ではないので、右端へ寄せる（一覧の「表示」と同じ位置） */}
        <div className="flex shrink-0 rounded-lg border border-border p-0.5">
          <LayoutToggle active={layout === 'list'} onClick={() => changeLayout('list')} label="リストで見る">
            <List size={15} />
          </LayoutToggle>
          <LayoutToggle active={layout === 'card'} onClick={() => changeLayout('card')} label="カードで見る">
            <LayoutGrid size={15} />
          </LayoutToggle>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 px-5 py-10 text-center text-sm text-muted-foreground">
          まだカードがありません。「カードを追加」から入れましょう。
        </div>
      ) : layout === 'card' ? (
        /* **一覧とまったく同じ札**を使う。別々に描くと、同じカードなのに
           一覧とデッキで見え方が変わる。並べ方の設定もサーバーから受け取る */
        <div className={`grid gap-4 ${CARD_GRID_CLASSES[display.columns]}`}>
          {items.map((vi, index) => (
            <div
              key={vi.item_id}
              // 掴めるのはつまみを押している間だけ。**札そのものを掴めるようにしない。**
              // 札は押すと詳細へ進む。掴めてしまうと、開こうとしただけで並びが動く
              draggable={grabbed === index}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => { e.preventDefault(); handleDragOver(index) }}
              onDragEnd={() => { handleDragEnd(); setGrabbed(null) }}
              className={`group relative ${dragIndex === index ? 'opacity-50' : ''}`}
            >
              <ItemCard
                item={vi.item as Item}
                selectionMode={false}
                selected={false}
                onToggle={() => {}}
                fit={display.fit}
                blocks={cardList?.blocks ?? [ 'image' ]}
                showTypeMark={cardList?.type_mark ?? true}
                density={densityFor(display.columns)}
                sizes={cardImageSizes(display.columns)}
                working={false}
                workingLabel={null}
              />
              {/*
                つまみ。**札の上に重ねる。**
                リスト表示と同じ持ち方にして、掴む場所を覚え直させない。

                **ふだんは出さない。** 札は絵を見るためのもので、
                常に印が乗っていると、並べ替えないときにも視線を取る。
                指で触る画面には hover が無いので、そこでは出したままにする
                （消すと掴む場所が無くなる）。
              */}
              <span
                onPointerDown={() => setGrabbed(index)}
                onPointerUp={() => setGrabbed(null)}
                // 札の押下（詳細へ進む）に伝えない
                onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                title="掴んで並び替え"
                aria-hidden="true"
                className={`absolute left-1 top-1 z-10 cursor-grab touch-none rounded bg-background/80 p-0.5 text-muted-foreground/70 backdrop-blur-sm transition-opacity active:cursor-grabbing [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 ${
                  grabbed === index || dragIndex === index ? '[@media(hover:hover)]:opacity-100' : ''
                }`}
              >
                <GripVertical size={14} />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((vi, index) => {
            const url = vi.item.media?.thumb_url ?? vi.item.media?.url ?? null
            return (
              <li
                key={vi.item_id}
                // 掴めるのはつまみを押している間だけ。
                // 行そのものを draggable にすると、**カード名をなぞって写せない**
                draggable={grabbed === index}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => { e.preventDefault(); handleDragOver(index) }}
                onDragEnd={() => { handleDragEnd(); setGrabbed(null) }}
                className={`flex items-center gap-3 rounded-xl border border-border bg-card p-2 ${
                  dragIndex === index ? 'opacity-50' : ''
                }`}
              >
                <span
                  onPointerDown={() => setGrabbed(index)}
                  onPointerUp={() => setGrabbed(null)}
                  className="cursor-grab touch-none text-muted-foreground/60 active:cursor-grabbing"
                  aria-hidden="true"
                >
                  <GripVertical size={16} />
                </span>
                <span className="w-6 text-center text-xs text-muted-foreground">{index + 1}</span>
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={vi.item.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <Link href={`/items/${vi.item_id}?deck=${viewId}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                  {vi.item.title}
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => move(index, -1)} disabled={index === 0 || busy} aria-label="上へ" className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronUp size={16} />
                  </button>
                  <button onClick={() => move(index, 1)} disabled={index === items.length - 1 || busy} aria-label="下へ" className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronDown size={16} />
                  </button>
                  <button onClick={() => removeCard(vi.item_id)} disabled={busy} aria-label="外す" className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30">
                    <X size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {picking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPicking(false)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">カードを追加</h3>
              <button onClick={() => setPicking(false)} aria-label="閉じる">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {allItems
                .filter((it) => !placedIds.has(it.id))
                .map((it) => {
                  const url = it.media?.thumb_url ?? it.media?.url ?? null
                  return (
                    <button key={it.id} onClick={() => addCard(it)} disabled={busy} className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left hover:shadow-md">
                      <span className="truncate px-2 py-1 text-xs font-medium">{it.title}</span>
                      <div className="aspect-square overflow-hidden bg-muted">
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={it.title} className="h-full w-full object-cover" loading="lazy" />
                        ) : null}
                      </div>
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 見せ方の切り替え。**字ではなく形で示す。**
 * 「リスト」「カード」と並べると、その2語ぶんだけ横幅を食い、
 * 「カードを追加」が画面の外へ出る。何であるかは名前で伝える
 */
function LayoutToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`rounded-md px-2 py-1 transition-colors ${
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
