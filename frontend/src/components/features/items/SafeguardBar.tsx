'use client'

import { useRef, useState } from 'react'
import { Check, EyeOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { approveItemImage, deleteItem } from '@/lib/api/items'
import { useSettingsStore } from '@/stores/settings'
import { SAFEGUARD_STRENGTHS, type SafeguardStrength } from '@/lib/items/safeguard'
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
  /**
   * 濃さの調整。**決める場所の隣に置く。**
   *
   * 設定の画面にもあるが、濃さを変えたくなるのは
   * **いま覆われた絵を前にして「もう少し見たい」と思ったとき**で、
   * そのために設定へ往復させると、戻ってきたころには何を見ていたか薄れる。
   *
   * ここで変えるのは**アカウントの設定そのもの**（このカード限りではない）。
   * 濃さを2通り持つと、どちらが効いているのか読めなくなる。そう書いて渡す。
   */
  const strength = useSettingsStore((s) => s.settings?.image_safeguard_strength)
  const patchSettings = useSettingsStore((s) => s.patchSettings)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const level = Math.max(0, SAFEGUARD_STRENGTHS.findIndex((o) => o.key === (strength ?? 'normal')))

  const changeStrength = (next: SafeguardStrength) => {
    // 送るのは手を止めてから。掴んで動かすと途中の段まで送ることになる
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void patchSettings({ image_safeguard_strength: next }).catch(() => {})
    }, 400)
    // 見た目は先に変える（覆いはこの設定を見て濃さを決めている）
    useSettingsStore.setState((s) =>
      s.settings ? { settings: { ...s.settings, image_safeguard_strength: next } } : s
    )
  }

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
      {/* 濃さの調整。**決める釦の隣**に置く（見たい／見たくないは、決める直前に動く） */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground" htmlFor="safeguard-strength">
          隠す濃さ
          <input
            id="safeguard-strength"
            type="range"
            min={0}
            max={SAFEGUARD_STRENGTHS.length - 1}
            step={1}
            value={level}
            onChange={(e) => changeStrength(SAFEGUARD_STRENGTHS[Number(e.target.value)].key)}
            aria-valuetext={SAFEGUARD_STRENGTHS[level].label}
            className="w-28 accent-[var(--palace)]"
          />
          <span className="w-8 shrink-0 font-medium text-foreground">{SAFEGUARD_STRENGTHS[level].label}</span>
        </label>
        {/* このカード限りではない、と先に言う。黙って全体が変わると驚きになる */}
        <span className="text-3xs text-muted-foreground">次に覆う絵にも、同じ濃さで掛かります</span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
