'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Shuffle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getItems } from '@/lib/api/items'
import type { Item } from '@/types/item'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function StudyPage() {
  const [order, setOrder] = useState<Item[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    getItems()
      .then((data) => {
        const usable = data.filter((i) => i.generation_status === 'completed' && i.media?.url)
        setOrder(shuffle(usable))
      })
      .catch(() => setOrder([]))
  }, [])

  const reshuffle = () => {
    setOrder((current) => (current ? shuffle(current) : current))
    setIndex(0)
    setRevealed(false)
  }

  const next = () => {
    setRevealed(false)
    setIndex((i) => (order && order.length > 0 ? (i + 1) % order.length : 0))
  }

  if (order === null) {
    return (
      <div className="max-w-xl mx-auto px-6 py-12">
        <div className="h-7 w-32 rounded bg-muted animate-pulse" />
        <div className="mt-8 aspect-square w-full rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  if (order.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-6 py-12 text-center">
        <h1 className="text-2xl font-semibold">スタディ</h1>
        <p className="mt-4 text-muted-foreground">学習できるカードがまだありません。まずはカードを作成しましょう。</p>
        <Link href="/items/new">
          <Button className="mt-6">カードを作成する</Button>
        </Link>
      </div>
    )
  }

  const card = order[index]

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">スタディ</h1>
        <span className="text-sm text-muted-foreground tabular-nums">
          {index + 1} / {order.length}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">画像を見て単語を思い出し、タップで答え合わせをしましょう。</p>

      {/* フラッシュカード（タップで裏返す） */}
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="mt-6 block w-full overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:shadow-md"
        aria-label={revealed ? '画像に戻す' : '答えを表示'}
      >
        <div className="aspect-square w-full bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.media!.url} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="px-5 py-4">
          {revealed ? (
            <>
              <p className="text-xl font-bold">{card.title}</p>
              {card.meaning ? (
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{card.meaning}</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">（意味は未登録）</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">タップして答えを表示</p>
          )}
        </div>
      </button>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={next} className="flex flex-1 items-center justify-center gap-2">
          次へ
          <ArrowRight size={16} />
        </Button>
        <Button variant="outline" onClick={reshuffle} className="flex items-center gap-2" aria-label="シャッフル">
          <Shuffle size={16} />
          シャッフル
        </Button>
      </div>
    </div>
  )
}
