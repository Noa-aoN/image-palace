'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { generateWords } from '@/lib/api/wordlists'
import { createItem } from '@/lib/api/items'
import { STYLE_OPTIONS } from '@/lib/item-styles'
import { useBillingStore } from '@/stores/billing'
import type { Item } from '@/types/item'

const MAX_PULL = 5

export default function DelphiPage() {
  const [genre, setGenre] = useState('')
  const [count, setCount] = useState(1)
  // 既定は「写真(photo)」。未指定だと realism 指示が付かずイラスト寄りになるため。
  const [style, setStyle] = useState('photo')
  const [forging, setForging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cards, setCards] = useState<Item[]>([])
  const billing = useBillingStore((s) => s.summary)
  const fetchBilling = useBillingStore((s) => s.fetchSummary)

  useEffect(() => {
    fetchBilling()
  }, [fetchBilling])

  const available = billing?.available_credits ?? null
  const insufficient = available != null && available < count

  const handleForge = async () => {
    setForging(true)
    setError(null)
    setCards([])
    try {
      const words = await generateWords(genre.trim(), count)
      if (words.length === 0) {
        setError('単語を錬成できませんでした。もう一度お試しください。')
        return
      }
      // 1枚=1クレジット。枚数分を順に作成し、不足等で失敗したらそこで止める。
      const created: Item[] = []
      for (const word of words) {
        try {
          created.push(await createItem(word.trim(), false, undefined, { style: style || undefined }))
        } catch (err: unknown) {
          const axiosErr = err as { response?: { data?: { error?: string; errors?: string[] } } }
          setError(
            axiosErr?.response?.data?.error ??
              axiosErr?.response?.data?.errors?.[0] ??
              '一部のカードを作成できませんでした。'
          )
          break
        }
      }
      setCards(created)
      fetchBilling()
    } catch {
      setError('神託に失敗しました。もう一度お試しください。')
    } finally {
      setForging(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Wand2 size={24} style={{ color: 'var(--palace)' }} />
        デルフォイ
      </h1>
      <p className="mt-2 text-muted-foreground">
        ジャンルを指定するか、空欄のまま完全ランダムで、単語カードを錬成します。
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="genre" className="mb-1 block text-sm font-medium">ジャンル（空欄でランダム）</label>
          <Input
            id="genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="例: 宇宙、英単語"
            disabled={forging}
          />
        </div>
        <div className="w-28">
          <label htmlFor="style" className="mb-1 block text-sm font-medium">スタイル</label>
          <select
            id="style"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            disabled={forging}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.value || 'default'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="w-20">
          <label htmlFor="count" className="mb-1 block text-sm font-medium">枚数</label>
          <select
            id="count"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={forging}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Array.from({ length: MAX_PULL }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <Button onClick={handleForge} disabled={forging || insufficient} className="flex items-center justify-center gap-2 sm:w-44">
          {forging ? <Spinner size={15} /> : <Wand2 size={16} />}
          {forging ? '神託を受けています...' : '神託を受ける'}
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        1枚につき1クレジット消費します（必要 {count} cr{available != null ? ` ・ 残り ${available} cr` : ''}）。
      </p>
      {insufficient && (
        <p className="mt-1 text-xs text-destructive">
          クレジットが不足しています。
          <Link href="/billing" className="ml-1 underline">プランを見る</Link>
        </p>
      )}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {cards.length > 0 && (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-muted-foreground">{cards.length}枚のカードを錬成しました（画像を生成中）。</p>
          <ul className="divide-y overflow-hidden rounded-xl border border-border bg-card">
            {cards.map((card) => (
              <li key={card.id}>
                <Link href={`/items/${card.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-black/5">
                  <span className="font-medium">{card.title}</span>
                  <span className="text-xs text-muted-foreground">カードを見る →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
