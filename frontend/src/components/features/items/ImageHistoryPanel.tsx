'use client'

import { useEffect, useState } from 'react'
import { History, Trash2 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { SafeguardVeil, useSafeguardImageClass } from '@/components/features/items/SafeguardVeil'
import {
  getItem,
  getMediaGenerations,
  applyMediaGeneration,
  deleteMediaGeneration,
  type MediaGeneration,
} from '@/lib/api/items'
import type { Item } from '@/types/item'

export const IMAGE_HISTORY_PANEL_KEY = 'item-image-history'
const PANEL_KEY = IMAGE_HISTORY_PANEL_KEY

/**
 * これまでに使った絵。
 *
 * **選び直しても新しく作らない。** 絵は既にあるものを付け替えるだけなので、
 * クレジットは減らないし、待ち時間も無い。
 *
 * 作り直すたびに前の絵へ戻る道が無かった。絵そのものは残っていたのに、
 * 「いつ、どれを使ったか」の結びつきだけが消えていたため。
 */
export function ImageHistoryPanel({
  item,
  onUpdated,
}: {
  item: Item
  onUpdated: (item: Item) => void
}) {
  const panel = usePanelForm(PANEL_KEY, '生成履歴')
  // いま使っている絵が、まだ承認されていないか
  const veilCurrent = Boolean(item.media?.needs_approval)
  // 覆いの濃さは設定で変えられる（薄い / 標準 / 濃い）
  const safeguardClass = useSafeguardImageClass()
  const [rows, setRows] = useState<MediaGeneration[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!panel.isOpen) return
    let cancelled = false
    const spinner = setTimeout(() => setLoading(true), 0)

    getMediaGenerations(item.id)
      .then((next) => {
        if (!cancelled) setRows(next)
      })
      .catch(() => {
        if (!cancelled) setError('履歴を読み込めませんでした')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      clearTimeout(spinner)
    }
  }, [panel.isOpen, item.id])

  const apply = async (row: MediaGeneration) => {
    if (row.current || busyId) return
    setBusyId(row.id)
    setError(null)
    try {
      await applyMediaGeneration(item.id, row.id)
      onUpdated(await getItem(item.id))
      setRows(await getMediaGenerations(item.id))
    } catch {
      setError('差し替えられませんでした。もう一度お試しください。')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (row: MediaGeneration) => {
    setBusyId(row.id)
    setError(null)
    try {
      await deleteMediaGeneration(item.id, row.id)
      setRows((current) => current.filter((r) => r.id !== row.id))
    } catch {
      setError('消せませんでした。もう一度お試しください。')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={panel.open}
        aria-expanded={panel.isOpen}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <History size={14} />
        生成履歴
      </button>

      <PanelSlotContent sectionKey={PANEL_KEY}>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {/* 作らないので費用の話にならない。ここを書かないと、押すのをためらう */}
            これまでにこのカードで使った絵です。選び直しても新しく作らないので、クレジットは減りません。
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner size={14} /> 読み込んでいます
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              まだ履歴はありません。作り直すと、ここに前の絵が残ります。
              <br />
              <span className="text-xs">
                見出し語を書き換えると、前の語で作った絵は選べなくなります
                （語と絵の結びつきを保つため）。
              </span>
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {rows.map((row) => (
                <li key={row.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => apply(row)}
                    disabled={row.current || busyId !== null}
                    aria-pressed={row.current}
                    title={row.current ? 'いま使っている絵' : 'この絵に戻す'}
                    className={`relative block w-full overflow-hidden rounded-lg border transition disabled:cursor-default ${
                      row.current ? 'border-[var(--palace)]' : 'border-border hover:border-[var(--palace)]'
                    }`}
                  >
                    {row.url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.url}
                          alt=""
                          loading="lazy"
                          className={`aspect-square w-full object-cover ${veilCurrent && row.current ? safeguardClass : ''}`}
                          // 覆っている間は掴めなくする（引きずるとぼかす前の絵が持ち上がる）
                          draggable={!(veilCurrent && row.current)}
                        />
                        {/* **覆うのは、まだ承認していない絵の行だけ。**
                            それが「いま使っている絵」で、カードの上では覆いが掛かっている。
                            ここだけ素通しだと、覆いを回り込んで見られてしまう。
                            ほかの行まで覆うと、選び直すための一覧が見えなくなる
                            （見えない絵は選べない） */}
                        {veilCurrent && row.current && <SafeguardVeil className="rounded-lg" />}
                      </>
                    ) : (
                      <span className="flex aspect-square w-full items-center justify-center text-xs text-muted-foreground">
                        画像なし
                      </span>
                    )}
                    {row.current && (
                      <span
                        className="absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] text-white"
                        style={{ backgroundColor: 'var(--palace)' }}
                      >
                        いま
                      </span>
                    )}
                    {busyId === row.id && (
                      <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <Spinner size={16} />
                      </span>
                    )}
                  </button>

                  <div className="flex items-center justify-between gap-1">
                    <span className="min-w-0 truncate text-[10px] text-muted-foreground" title={row.model ?? ''}>
                      {new Date(row.used_at).toLocaleDateString('ja-JP')}
                    </span>
                    {/* 消すのは記録だけ。絵そのものは消さない（ほかの人も同じ絵を使っている） */}
                    {!row.current && (
                      <button
                        type="button"
                        onClick={() => remove(row)}
                        disabled={busyId !== null}
                        aria-label="この履歴を消す"
                        title="この履歴を消す（絵そのものは残ります）"
                        className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PanelSlotContent>
    </>
  )
}
