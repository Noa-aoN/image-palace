'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getDecks, createDeck } from '@/lib/api/decks'
import { DeckCover } from '@/components/features/decks/DeckCover'
import type { Deck } from '@/types/deck'

function DeckCard({ deck }: { deck: Deck }) {
  return (
    <Link
      href={`/decks/${deck.id}`}
      className="flex flex-col rounded-xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow"
    >
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <span className="font-medium truncate">{deck.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{deck.item_count} 枚</span>
      </div>
      <div className="w-full aspect-square bg-muted overflow-hidden">
        <DeckCover deck={deck} />
      </div>
    </Link>
  )
}

export default function DecksPage() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getDecks()
      .then((data) => {
        if (!cancelled) setDecks(data)
      })
      .catch(() => {
        if (!cancelled) setError('デッキの取得に失敗しました')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setCreateError('デッキ名を入力してください')
      return
    }
    setSubmitting(true)
    setCreateError(null)
    try {
      const created = await createDeck(trimmed)
      setDecks((current) => [created, ...current])
      setName('')
      setCreating(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setCreateError(axiosErr?.response?.data?.errors?.[0] ?? 'デッキの作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">デッキ</h1>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)} className="flex items-center gap-1.5">
            <Plus size={16} />
            新規作成
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        カードを束ねるグループ。表紙を設定できます。
      </p>

      {creating && (
        <form onSubmit={handleCreate} className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="デッキ名（例: 英単語 Day1、Rails用語）"
              autoFocus
              disabled={submitting}
              aria-label="デッキ名"
            />
            {createError && <p className="mt-1 text-sm text-destructive">{createError}</p>}
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? '作成中...' : '作成'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setCreating(false); setName(''); setCreateError(null) }}
              disabled={submitting}
            >
              キャンセル
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl border border-border bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : decks.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">
            まだデッキがありません。カードを束ねてデッキを作りましょう。
          </p>
          {!creating && <Button onClick={() => setCreating(true)}>最初のデッキを作成</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      )}
    </div>
  )
}
