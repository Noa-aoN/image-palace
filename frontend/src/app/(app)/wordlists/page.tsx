'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getWordlists } from '@/lib/api/wordlists'
import type { Wordlist } from '@/types/wordlist'

export default function WordlistsPage() {
  const [wordlists, setWordlists] = useState<Wordlist[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWordlists()
      .then(setWordlists)
      .catch(() => {
        setError('ワードリストの取得に失敗しました')
        setWordlists([])
      })
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <ListChecks size={26} style={{ color: 'var(--palace)' }} />
          ワードリスト
        </h1>
        <Link href="/wordlists/new">
          <Button size="sm" className="flex items-center gap-1.5">
            <Plus size={16} />
            新規作成
          </Button>
        </Link>
      </div>

      {wordlists === null ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : wordlists.length === 0 ? (
        <div className="space-y-4 py-16 text-center">
          <p className="text-muted-foreground">まだワードリストがありません。テーマからAIで作ってみましょう。</p>
          <Link href="/wordlists/new">
            <Button>最初のワードリストを作成</Button>
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wordlists.map((wl) => (
            <li key={wl.id}>
              <Link
                href={`/wordlists/${wl.id}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <ListChecks size={18} className="shrink-0" style={{ color: 'var(--palace)' }} />
                  <span className="truncate">{wl.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{wl.word_count} 語</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
