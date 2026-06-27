'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { generateWords } from '@/lib/api/wordlists'
import { createItem } from '@/lib/api/items'
import type { Item } from '@/types/item'

export default function DelphiPage() {
  const [genre, setGenre] = useState('')
  const [forging, setForging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [card, setCard] = useState<Item | null>(null)

  const handleForge = async () => {
    setForging(true)
    setError(null)
    setCard(null)
    try {
      const words = await generateWords(genre.trim(), 1)
      const word = words[0]?.trim()
      if (!word) {
        setError('単語を錬成できませんでした。もう一度お試しください。')
        return
      }
      const created = await createItem(word)
      setCard(created)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; errors?: string[] } } }
      setError(
        axiosErr?.response?.data?.error ??
          axiosErr?.response?.data?.errors?.[0] ??
          '錬成に失敗しました。もう一度お試しください。'
      )
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
        ジャンルを指定するか、空欄のまま完全ランダムで、単語カードを1枚錬成します。
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Input
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          placeholder="ジャンル（例: 宇宙、英単語）。空欄でランダム"
          disabled={forging}
          aria-label="ジャンル"
        />
        <Button onClick={handleForge} disabled={forging} className="flex items-center justify-center gap-2 sm:w-36">
          {forging ? <Spinner size={15} /> : <Wand2 size={16} />}
          {forging ? '錬成中...' : '錬成する'}
        </Button>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {card && (
        <div className="mt-8 rounded-xl border border-border bg-card px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">錬成されたカード</p>
          <p className="mt-1 text-2xl font-bold">{card.title}</p>
          <p className="mt-2 text-sm text-muted-foreground">画像を生成しています…（少し待つと表示されます）</p>
          <Link href={`/items/${card.id}`}>
            <Button variant="outline" className="mt-4">カードを見る</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
