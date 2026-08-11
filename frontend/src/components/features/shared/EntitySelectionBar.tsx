'use client'

import { useState } from 'react'
import { Circle, CircleCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

/**
 * 入れ物の一覧（キャンバス・スペース・ボックス）の選択モード。
 *
 * カード一覧と同じ形にする。
 *   - 押す前と縦幅を揃える（行が伸びると下の棚がずれて、見ていたものを目で追い直すことになる）
 *   - 「表示」「作成」は選択中も同じ位置に残す（右側は呼び出し側が渡す）
 *   - 削除は2段階。1回目は言葉が変わるだけで、まだ消えない
 *
 * まとめてできるのは削除だけにしてある。入れ物に対する一括の操作は、
 * いまのところ他に「これをまとめてやりたい」と言えるものが無い。
 * 足すときは、ここに並べれば3つの一覧すべてに出る。
 */
export function EntitySelectionBar({
  total,
  selected,
  busy,
  onToggleAll,
  onDelete,
  onCancel,
  right,
}: {
  total: number
  selected: number
  busy: boolean
  onToggleAll: () => void
  onDelete: () => void
  onCancel: () => void
  /** 「表示」「作成」など、選択中も位置を変えないもの */
  right: React.ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  const allSelected = total > 0 && selected === total

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    onDelete()
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-muted/40 px-2">
        <button
          type="button"
          onClick={onToggleAll}
          disabled={busy}
          className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {allSelected ? <CircleCheck size={16} /> : <Circle size={16} />}
          {allSelected ? 'すべて解除' : 'すべて選択'}
        </button>
        <span className="shrink-0 text-sm text-muted-foreground">{selected}件を選択中</span>

        <div className="ml-auto flex min-w-0 items-center gap-2 overflow-x-auto">
          <Button
            variant={confirming ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleDelete}
            onBlur={() => setConfirming(false)}
            disabled={busy || selected === 0}
            className="flex shrink-0 items-center gap-1.5"
          >
            {busy ? <Spinner size={14} /> : <Trash2 size={14} />}
            {busy ? '削除中...' : confirming ? `本当に削除（${selected}件）` : '削除'}
          </Button>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onCancel} disabled={busy}>
            キャンセル
          </Button>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </div>
  )
}
