'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { getItemsPage } from '@/lib/api/items'
import { getTags } from '@/lib/api/tags'
import { getViewDetail } from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import { Spinner } from '@/components/ui/spinner'
import type { Item } from '@/types/item'
import type { Tag } from '@/types/tag'
import { DeckSection } from './DeckSection'

/**
 * 一度に読み込む枚数。
 *
 * 50枚を一度に出していた。持っているカードが増えるほど、
 * **開いた瞬間に長い一覧が降ってきて、探すより先に読み込みを待つ**ことになる。
 * 少なめに出して、足りなければ「もっと読み込む」で継ぎ足す。
 */
const PAGE_SIZE = 24

// 右パネル: ボードに追加できるカードを検索・タグ絞り込みして選ぶ。
// クリックは requestAdd でボード側に通知し、ボードが中央に配置する（座標計算はボードが持つため）。
export function AddCardsBody({ viewId }: { viewId: string }) {
  const requestAdd = useRightPanelStore((s) => s.requestAdd)
  const [tags, setTags] = useState<Tag[]>([])
  // タグは3行までにして、あふれたぶんは「＋」で開く。
  // **あふれているかは実際に測る。** 個数で決めると、短い名前ばかりのときに
  // まだ余裕があるのに「＋」が出る
  const [tagsOpen, setTagsOpen] = useState(false)
  const [clipped, setClipped] = useState(false)
  const tagBoxRef = useRef<HTMLDivElement>(null)
  const [placedIds, setPlacedIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  /**
   * 読み込んだ結果は、**どの絞り込みのものか**と一緒に持つ。
   *
   * 絞り込みが変わった瞬間に「読み込み中」へ戻す書き方だと、
   * 描いている最中に状態を書き替えることになる。
   * いまの絞り込みと違う結果は「まだ無い」とみなせば、その必要が無くなる。
   * 遅れて返ってきた古い結果が新しい結果を上書きすることも無くなる。
   */
  const [loaded, setLoaded] = useState<{ key: string; items: Item[]; page: number; totalPages: number } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    getTags().then(setTags).catch(() => {})
  }, [])

  // 配置済みカード（一覧から除外する）
  useEffect(() => {
    getViewDetail(viewId)
      .then((v) => setPlacedIds(new Set((v.items ?? []).map((i) => i.item_id))))
      .catch(() => {})
  }, [viewId])

  // フリーワードはデバウンスして反映
  useEffect(() => {
    const handle = setTimeout(() => setAppliedQuery(query.trim()), 300)
    return () => clearTimeout(handle)
  }, [query])

  // いまの絞り込みを表す鍵。これが変われば、いまの結果は「別のもの」になる
  const filterKey = `${appliedQuery}\u0000${activeTag ?? ''}`
  const showing = loaded?.key === filterKey ? loaded : null
  const loading = showing === null

  // 絞り込みが変わったら1ページ目から引き直す
  useEffect(() => {
    let cancelled = false
    getItemsPage(1, PAGE_SIZE, { query: appliedQuery || undefined, tagId: activeTag ?? undefined })
      .then((res) => {
        if (!cancelled) setLoaded({ key: filterKey, items: res.items, page: 1, totalPages: res.meta.total_pages })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: filterKey, items: [], page: 1, totalPages: 1 })
      })
    return () => {
      cancelled = true
    }
  }, [appliedQuery, activeTag, filterKey])

  // 続きを継ぎ足す。**すでに出ているものは消さない**（見ていた場所が動かない）
  const loadMore = () => {
    if (loadingMore || !showing || showing.page >= showing.totalPages) return

    const next = showing.page + 1
    setLoadingMore(true)
    getItemsPage(next, PAGE_SIZE, { query: appliedQuery || undefined, tagId: activeTag ?? undefined })
      .then((res) => {
        setLoaded((current) =>
          current?.key === filterKey
            ? { ...current, items: [...current.items, ...res.items], page: next, totalPages: res.meta.total_pages }
            : current
        )
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }

  useEffect(() => {
    const el = tagBoxRef.current
    if (!el) return

    // 畳んでいる状態の高さで測る。開いている間は判定を変えない
    // （開いた瞬間に「＋」が消えると、畳む道が無くなる）
    const check = () => {
      if (tagsOpen) return
      setClipped(el.scrollHeight > el.clientHeight + 1)
    }
    check()

    // パネルの幅は掴んで変えられる。幅が変われば折り返しも変わる
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [tags, tagsOpen])

  const available = useMemo(
    () => (showing?.items ?? []).filter((i) => !placedIds.has(i.id)),
    [showing, placedIds]
  )

  const handleAdd = (item: Item) => {
    // 楽観的に一覧から消し、重複クリックを防ぐ
    setPlacedIds((prev) => new Set(prev).add(item.id))
    requestAdd(item)
  }

  // まとめて置いたぶんを、こちらの一覧からも外す
  const markPlaced = (ids: string[]) => {
    setPlacedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="カードを検索"
          aria-label="カード検索"
          className="w-full rounded-lg border border-input bg-background py-1.5 pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {tags.length > 0 && (
        // **3行までに畳む。** タグが増えるほど札の一覧が下へ押し出され、
        // 選びに来たカードが見えなくなる。畳んだぶんは「＋◯」で開く
        <div
          ref={tagBoxRef}
          className={`flex flex-wrap gap-1.5 ${tagsOpen ? '' : 'max-h-[5.25rem] overflow-hidden'}`}
        >
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
              activeTag === null ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
            }`}
            style={activeTag === null ? { backgroundColor: 'var(--palace)' } : undefined}
          >
            すべて
          </button>
          {tags.map((tag) => {
            const active = activeTag === tag.id
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => setActiveTag(active ? null : tag.id)}
                className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                }`}
                style={active ? { backgroundColor: 'var(--palace)' } : undefined}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
      )}

      {/* 畳んでいるときだけ出す。**押せる場所を常に出しておかない**
          （全部見えているのに「もっと見る」があると、何が隠れているのか分からない） */}
      {tags.length > 0 && clipped && (
        <button
          type="button"
          onClick={() => setTagsOpen((v) => !v)}
          aria-expanded={tagsOpen}
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {tagsOpen ? '－ タグを畳む' : `＋ タグをすべて表示（${tags.length}）`}
        </button>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">読み込み中…</p>
      ) : available.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {appliedQuery || activeTag ? '条件に合うカードがありません。' : '追加できるカードがありません。'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {available.map((item) => {
            const imageUrl = item.media?.thumb_url ?? item.media?.url ?? null
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleAdd(item)}
                className="flex flex-col overflow-hidden rounded-lg border border-border bg-background text-left transition-shadow hover:shadow-md"
              >
                <span className="truncate px-1.5 py-1 text-2xs font-medium">{item.title}</span>
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="px-1 text-center text-3xs text-muted-foreground">{item.title}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* **続きは押したときだけ引く。** 開いた瞬間に全部降ってくると、
          探すより先に読み込みを待つことになる */}
      {showing && showing.page < showing.totalPages && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          {loadingMore ? <Spinner size={13} /> : <Plus size={13} />}
          もっと読み込む
          <span className="text-3xs">（{showing.page} / {showing.totalPages} ページ）</span>
        </button>
      )}

      {/* デッキごとまとめて置く。1枚ずつ探して押すより速い */}
      <DeckSection placedIds={placedIds} onPlaced={markPlaced} />
    </div>
  )
}
