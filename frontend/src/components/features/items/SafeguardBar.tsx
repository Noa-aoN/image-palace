'use client'

import { useState } from 'react'
import { Check, EyeOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { approveItemImage, deleteItem } from '@/lib/api/items'
import type { Item } from '@/types/item'

/**
 * 覆いを掛けている絵に対する「これでよい」か「消す」かの選択。
 *
 * 覆いだけ掛けて外し方が無いと、ただ見えないだけになる。決め方を絵のすぐ下に置く。
 * 作り直しは既にイメージの操作列にあるので、ここには出さない
 * （同じ操作を2か所に置くと、どちらが正か分からなくなる）。
 *
 * 削除はカードごと消す。絵だけ消したカードは何も表せず、結局作り直すことになるため。
 * 押し間違いが取り返せないので、2度押しで確定させる。
 */
export function SafeguardBar({
  item,
  onUpdated,
  onDeleted,
}: {
  item: Item
  onUpdated: (item: Item) => void
  /** 渡されたときだけ削除を出す（消えたあとの行き先を知っているのは呼び出し側） */
  onDeleted?: () => void
}) {
  const [approving, setApproving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const approve = async () => {
    setApproving(true)
    setError(null)
    try {
      onUpdated(await approveItemImage(item.id))
    } catch {
      setError('承認できませんでした。時間を置いてお試しください。')
    } finally {
      setApproving(false)
    }
  }

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    setError(null)
    try {
      await deleteItem(item.id)
      onDeleted?.()
    } catch {
      setError('削除できませんでした。時間を置いてお試しください。')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
      <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
        <EyeOff size={15} className="mt-0.5 shrink-0" />
        <span>覆いを掛けています。中身を確かめてから決めてください。</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={approve} disabled={approving || deleting} className="flex items-center gap-1.5">
          {approving ? <Spinner size={14} /> : <Check size={14} />}
          これでよい
        </Button>
        {onDeleted && (
          <Button
            size="sm"
            variant={confirmDelete ? 'destructive' : 'outline'}
            onClick={remove}
            disabled={approving || deleting}
            onBlur={() => setConfirmDelete(false)}
            className="flex items-center gap-1.5"
          >
            {deleting ? <Spinner size={14} /> : <Trash2 size={14} />}
            {deleting ? '削除中…' : confirmDelete ? '本当に削除' : 'カードを削除'}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
