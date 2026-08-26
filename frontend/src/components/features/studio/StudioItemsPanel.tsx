'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { StudioContainers } from './StudioContainers'
import {
  allChosen,
  bulkLabel,
  EMPTY,
  keepVisible,
  toggle as toggleId,
  toggleAll,
  type Selection,
} from '@/lib/studio/selection'
import {
  fetchStudioItems,
  setItemExclusion,
  type StudioBox,
  type StudioItem,
  type StudioSpace,
  type StudioView,
} from '@/lib/api/studio'
import {
  blocksDraft,
  countByState,
  filterItems,
  ITEM_STATE_LABEL,
  ITEM_STATE_TONE,
  noteFor,
  stateFor,
  type ItemFilter,
  type ItemState,
} from '@/lib/studio/items'

const FILTERS: { value: ItemFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'shipped', label: ITEM_STATE_LABEL.shipped },
  { value: 'ready', label: ITEM_STATE_LABEL.ready },
  { value: 'blocked', label: ITEM_STATE_LABEL.blocked },
  { value: 'excluded', label: ITEM_STATE_LABEL.excluded },
  { value: 'loose', label: ITEM_STATE_LABEL.loose },
]

/**
 * 公式宮殿のカード一覧。**何が出ていて、何が出ていないか。**
 *
 * 出すものは箱とキャンバスで決める。ここは編集の場ではなく、
 * **その結果を1枚ずつ確かめる場所**。
 *
 * 添えてあるのは「出さない」の栓ひとつだけ。
 * 出すかどうかは箱の選択から導けるので、両方を手で持つと必ず食い違う。
 */
type Containers = { boxes: StudioBox[]; views: StudioView[]; spaces: StudioSpace[] }

export function StudioItemsPanel() {
  const [items, setItems] = useState<StudioItem[] | null>(null)
  const [containers, setContainers] = useState<Containers>({ boxes: [], views: [], spaces: [] })
  const [truncated, setTruncated] = useState(false)
  const [filter, setFilter] = useState<ItemFilter>('all')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // **選んでからまとめて押す。** 1枚ずつだと、10枚外すのに10往復要る
  const [rawChosen, setChosen] = useState<Selection>(EMPTY)

  const load = useCallback(() => {
    fetchStudioItems()
      .then((data) => {
        setItems(data.items)
        setContainers({ boxes: data.boxes, views: data.views, spaces: data.spaces })
        setTruncated(data.truncated)
      })
      .catch((e) => {
        const code = (e as { response?: { data?: { code?: string } } }).response?.data?.code
        setError(
          code === 'official_account_missing'
            ? '公式コンテンツのアカウントが設定されていません'
            : 'カードを読めませんでした'
        )
      })
  }, [])

  useEffect(load, [load])

  const counts = useMemo(() => (items ? countByState(items) : null), [items])
  const shown = useMemo(
    () => (items ? filterItems(items, filter, query) : []),
    [items, filter, query]
  )
  const shownIds = useMemo(() => shown.map((i) => i.id), [shown])

  // **絞り込みを変えたら、見えなくなったものは選びから外す。**
  // 画面に出ていないものが、まとめて変わるのを防ぐ。
  //
  // 状態を書き換えるのではなく、**その場で絞って使う**（描き直しが連鎖しない）
  const chosen = useMemo(() => keepVisible(rawChosen, shownIds), [rawChosen, shownIds])

  /**
   * 選んだものを、まとめて外す・戻す。
   *
   * **1枚ずつ送る。** まとめて送る口をサーバーに足すこともできるが、
   * 途中で1枚こけたときに「どこまで効いたか」が分からなくなる。
   * 1枚ずつなら、効いたものはそのまま残る。
   */
  async function applyToChosen(excluded: boolean) {
    if (busy || chosen.size === 0) return
    const targets = [...chosen]
    if (!window.confirm(`${bulkLabel(excluded ? '出さないようにします' : '出せるようにします', targets.length)}。よろしいですか。`)) return

    setBusy('bulk')
    setError(null)
    let done = 0
    try {
      for (const id of targets) {
        await setItemExclusion(id, excluded)
        done += 1
      }
      setItems((prev) =>
        prev ? prev.map((i) => (chosen.has(i.id) ? { ...i, excluded } : i)) : prev
      )
      setChosen(EMPTY)
    } catch {
      // 途中で止まったぶんだけ画面へ写す。**全部戻さない**（効いたものは効いている）
      const applied = new Set(targets.slice(0, done))
      setItems((prev) =>
        prev ? prev.map((i) => (applied.has(i.id) ? { ...i, excluded } : i)) : prev
      )
      setError(`${done} 件まで変えたところで止まりました`)
    } finally {
      setBusy(null)
    }
  }

  async function toggle(item: StudioItem) {
    if (busy) return
    setBusy(item.id)
    setError(null)
    try {
      const next = !item.excluded
      await setItemExclusion(item.id, next)
      // 一覧を引き直さず、その1枚だけ入れ替える。
      // 数百枚を読み直すと、押すたびに一覧が飛ぶ
      setItems((prev) =>
        prev ? prev.map((i) => (i.id === item.id ? { ...i, excluded: next } : i)) : prev
      )
    } catch {
      setError('切り替えられませんでした')
    } finally {
      setBusy(null)
    }
  }

  if (error && !items) return <p className="py-12 text-center text-muted-foreground">{error}</p>
  if (!items || !counts) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">原本</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          公式宮殿の中身。**ここにあるもの全部が公開物ではありません。**
          出すものは箱やキャンバスごと選び、出したくない1枚だけをここで外せます。
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger-deep)' }}>
          {error}
        </p>
      ) : null}

      {truncated ? (
        <p className="text-xs text-muted-foreground">
          多いので途中までを出しています（先に作ったものから 500 枚）
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const n = f.value === 'all' ? items.length : counts[f.value as ItemState]
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              disabled={n === 0 && f.value !== 'all'}
              className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-40 ${
                filter === f.value ? 'border-[var(--palace)] font-medium' : 'border-border text-muted-foreground'
              }`}
              style={filter === f.value ? { backgroundColor: 'var(--palace)', color: '#fff' } : undefined}
            >
              {f.label} <span className="tabular-nums">{n}</span>
            </button>
          )
        })}

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="題・箱・出したもので探す"
          className="ml-auto w-full sm:w-56"
          aria-label="カードを探す"
        />
      </div>

      <h3 className="text-sm font-medium">
        カード <span className="text-xs font-normal text-muted-foreground">{items.length}</span>
      </h3>

      {/* **選んだ数と、そこに効く操作を、いつも同じ場所に出す。**
          選んでから探し回らせない */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={allChosen(chosen, shownIds)}
            onChange={() => setChosen(toggleAll(chosen, shownIds))}
            disabled={shownIds.length === 0}
          />
          いま見えている {shownIds.length} 件を選ぶ
        </label>

        {chosen.size > 0 ? (
          <>
            <span className="text-muted-foreground">{chosen.size} 件を選んでいます</span>
            <button
              type="button"
              onClick={() => applyToChosen(true)}
              disabled={busy !== null}
              className="rounded-full border border-border px-3 py-1 transition hover:bg-muted disabled:opacity-50"
            >
              まとめて出さない
            </button>
            <button
              type="button"
              onClick={() => applyToChosen(false)}
              disabled={busy !== null}
              className="rounded-full border border-border px-3 py-1 transition hover:bg-muted disabled:opacity-50"
            >
              まとめて出せるようにする
            </button>
            <button
              type="button"
              onClick={() => setChosen(EMPTY)}
              className="underline underline-offset-2 text-muted-foreground"
            >
              選びを解く
            </button>
          </>
        ) : (
          <span className="text-muted-foreground">
            選ぶと、まとめて出す・出さないを決められます
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          あてはまるカードがありません
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((item) => (
            <Row
              key={item.id}
              item={item}
              busy={busy === item.id}
              chosen={chosen.has(item.id)}
              onChoose={() => setChosen(toggleId(chosen, item.id))}
              onToggle={() => toggle(item)}
            />
          ))}
        </ul>
      )}

      <StudioContainers
        boxes={containers.boxes}
        views={containers.views}
        spaces={containers.spaces}
      />
    </div>
  )
}

function Row({
  item,
  busy,
  chosen,
  onChoose,
  onToggle,
}: {
  item: StudioItem
  busy: boolean
  chosen: boolean
  onChoose: () => void
  onToggle: () => void
}) {
  const state = stateFor(item)

  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-background p-3 ${
        chosen ? 'border-[var(--palace)]' : 'border-border'
      } ${item.excluded ? 'opacity-60' : ''}`}
    >
      <input
        type="checkbox"
        checked={chosen}
        onChange={onChoose}
        aria-label={`${item.title} を選ぶ`}
        className="shrink-0"
      />
      <div className="size-12 shrink-0 overflow-hidden rounded-md bg-[var(--ivory-dark)]">
        {item.thumb_url ? (
          // 絵の配信ホストは環境で変わる（CDN / Rails プロキシ）。
          // ほかのカード表示と同じく素の img で出す
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumb_url}
            alt=""
            className="size-12 object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {item.title}{' '}
          {item.item_type ? (
            <span className="text-xs font-normal text-muted-foreground">{item.item_type}</span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[...item.boxes, ...item.views].join(' / ') || '—'}
        </p>
      </div>

      <div className="min-w-0 flex-1 sm:max-w-xs">
        <StateChip state={state} warn={blocksDraft(item)} />
        <p className="mt-1 truncate text-xs text-muted-foreground" title={noteFor(item)}>
          {noteFor(item)}
        </p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={item.excluded}
        className="rounded-lg border border-border px-3 py-1.5 text-xs transition hover:bg-muted disabled:opacity-50"
      >
        {busy ? '…' : item.excluded ? '出せるようにする' : '出さない'}
      </button>
    </li>
  )
}

/**
 * 状態の印。
 *
 * **外したのにキャンバスに置いたままなら、注意の色にする。**
 * そのキャンバスを選ぶと下書きが止まるので、静かな印では気づけない
 */
function StateChip({ state, warn = false }: { state: ItemState; warn?: boolean }) {
  const tone = warn ? 'warn' : ITEM_STATE_TONE[state]
  const style =
    tone === 'active'
      ? { backgroundColor: 'var(--palace)', color: '#fff' }
      : tone === 'warn'
        ? { backgroundColor: '#9E3226', color: '#fff' }
        : { backgroundColor: 'var(--ivory-dark)', color: '#4A4A4A' }

  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={style}>
      {ITEM_STATE_LABEL[state]}
    </span>
  )
}
