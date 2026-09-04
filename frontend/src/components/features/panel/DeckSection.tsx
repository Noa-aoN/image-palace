'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Layers } from 'lucide-react'
import { getBoxes, getBox } from '@/lib/api/boxes'
import { useRightPanelStore } from '@/stores/rightPanel'
import { Spinner } from '@/components/ui/spinner'
import type { Box } from '@/types/box'
import type { Item } from '@/types/item'

/**
 * デッキ（ボックス）のカードを、まとめてボードへ置く。
 *
 * ## なぜ要るのか
 *
 * カードを1枚ずつ探して押す作りしか無かった。だが盤を作るときは
 * 「このデッキの中身を全部置きたい」ことのほうが多い。
 * 30枚のデッキなら、探して押す動きを30回することになる。
 *
 * デッキは既に「まとまり」として作られているので、そのまま置ければよい。
 *
 * ## 中身は開いたときに引く
 *
 * デッキの一覧だけ先に出し、**中身は選ばれたデッキだけ**引く。
 * 全部のデッキの中身を先に引くと、使うかも分からないものを待つことになる。
 */
export function DeckSection({
  placedIds,
  onPlaced,
}: {
  placedIds: Set<string>
  onPlaced: (ids: string[]) => void
}) {
  const requestAddMany = useRightPanelStore((s) => s.requestAddMany)
  const [open, setOpen] = useState(false)
  const [boxes, setBoxes] = useState<Box[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open || boxes !== null) return

    getBoxes()
      .then(setBoxes)
      .catch(() => setBoxes([]))
  }, [open, boxes])

  /**
   * デッキの中身を全部引いてから置く。
   *
   * 中身は続きがあるので、**続きが無くなるまでたどる**。
   * 1ページだけ置くと、「全部置いたつもりで一部しか無い」ことになる
   */
  const place = async (box: Box) => {
    setBusyId(box.id)
    setMessage(null)
    try {
      const items: Item[] = []
      let cursor: string | null | undefined
      do {
        const detail = await getBox(box.id, cursor)
        detail.entries.forEach((entry) => {
          // デッキにはスペースやキャンバスも入る。**盤に置けるのはカードだけ**
          if (entry.entry_type !== 'Item') return

          // 一覧が持っているのは id・題・絵だけ。盤に置くにはこれで足りる
          // （作りかけの表示は、盤が読み直したときに正しくなる）
          items.push({
            id: entry.id,
            title: entry.title,
            generation_status: 'completed',
            media: entry.media,
            // 一覧は作成日を持たない。盤に置くのに要らないので空で埋める
            created_at: '',
          })
        })
        cursor = detail.next_cursor
      } while (cursor)

      const fresh = items.filter((item) => !placedIds.has(item.id))
      if (fresh.length === 0) {
        setMessage('このデッキのカードは、すべて置かれています。')
        return
      }
      onPlaced(fresh.map((item) => item.id))
      requestAddMany(fresh)
      setMessage(`${fresh.length}枚を置きました。`)
    } catch {
      setMessage('デッキの中身を読み込めませんでした。')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Layers size={13} />
        デッキから、まとめて置く
        <ChevronDown size={13} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {boxes === null ? (
            <p className="text-xs text-muted-foreground">読み込み中…</p>
          ) : boxes.length === 0 ? (
            <p className="text-xs text-muted-foreground">まだデッキがありません。</p>
          ) : (
            <ul className="space-y-1">
              {boxes.map((box) => (
                <li key={box.id}>
                  <button
                    type="button"
                    onClick={() => place(box)}
                    disabled={busyId !== null}
                    className="flex w-full items-center gap-2 rounded-lg border border-border p-2 text-left transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{box.name}</span>
                    {/* 何枚入っているかは、押す前に分かるほうがよい */}
                    <span className="shrink-0 text-2xs text-muted-foreground">{box.entry_count}件</span>
                    {busyId === box.id && <Spinner size={13} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </div>
      )}
    </section>
  )
}
