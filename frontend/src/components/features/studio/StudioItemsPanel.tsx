'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { fetchStudioItems, setItemExclusion, type StudioItem } from '@/lib/api/studio'
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
export function StudioItemsPanel() {
  const [items, setItems] = useState<StudioItem[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [filter, setFilter] = useState<ItemFilter>('all')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchStudioItems()
      .then((data) => {
        setItems(data.items)
        setTruncated(data.truncated)
      })
      .catch((e) => {
        const code = (e as { response?: { data?: { code?: string } } }).response?.data?.code
        setError(
          code === 'official_account_missing'
            ? '公式コンテンツの口座が設定されていません'
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
        <h2 className="text-base font-semibold">カード</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          公式宮殿にある {items.length} 枚。出すものは「公開する」で箱ごと選びます。
          ここでは、その中から出したくない1枚を外せます。
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm" style={{ color: '#9E3226' }}>
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

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          あてはまるカードがありません
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((item) => (
            <Row key={item.id} item={item} busy={busy === item.id} onToggle={() => toggle(item)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Row({
  item,
  busy,
  onToggle,
}: {
  item: StudioItem
  busy: boolean
  onToggle: () => void
}) {
  const state = stateFor(item)

  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-background p-3 ${
        item.excluded ? 'opacity-60' : ''
      }`}
    >
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
