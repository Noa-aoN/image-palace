'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { searchLibrary } from '@/lib/api/search'
import type { SearchResults } from '@/types/search'

interface ResultLink {
  id: string
  href: string
  label: string
}

function ResultGroup({ title, items }: { title: string; items: ResultLink[] }) {
  if (items.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {title}（{items.length}）
      </h2>
      <ul className="divide-y overflow-hidden rounded-xl border border-border bg-card">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className="block truncate px-4 py-2.5 text-sm hover:bg-black/5">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [searching, setSearching] = useState(false)

  // 入力をデバウンスして横断検索（既存の searchLibrary を流用）。
  // setState はすべてタイマー内（非同期）で行う。
  useEffect(() => {
    const q = query.trim()
    const timer = setTimeout(() => {
      if (!q) {
        setResults(null)
        setSearching(false)
        return
      }
      setSearching(true)
      searchLibrary(q)
        .then(setResults)
        .catch(() => setResults(null))
        .finally(() => setSearching(false))
    }, q ? 250 : 0)
    return () => clearTimeout(timer)
  }, [query])

  const total = results
    ? results.items.length +
      results.decks.length +
      results.collections.length +
      results.views.length +
      results.spaces.length
    : 0

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold">横断検索</h1>
      <p className="mt-2 text-muted-foreground">
        カード・コレクション・キャンバス・スペースをまとめて検索します。
      </p>

      <div className="relative mt-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="キーワードで検索…"
          aria-label="横断検索"
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[var(--palace)] focus:ring-1 focus:ring-[var(--palace)]"
        />
      </div>

      <div className="mt-8 space-y-6">
        {!query.trim() ? (
          <p className="text-sm text-muted-foreground">キーワードを入力すると結果が表示されます。</p>
        ) : results && total === 0 && !searching ? (
          <p className="text-sm text-muted-foreground">「{query.trim()}」に一致するものは見つかりませんでした。</p>
        ) : results ? (
          <>
            <ResultGroup
              title="カード"
              items={results.items.map((i) => ({ id: i.id, href: `/items/${i.id}`, label: i.title }))}
            />
            <ResultGroup
              title="コレクション"
              items={results.collections.map((c) => ({ id: c.id, href: `/collections/${c.id}`, label: c.name }))}
            />
            <ResultGroup
              title="キャンバス"
              items={results.views.map((v) => ({ id: v.id, href: `/views/${v.id}`, label: v.name }))}
            />
            <ResultGroup
              title="デッキ"
              items={results.decks.map((d) => ({ id: d.id, href: `/views/${d.id}`, label: d.name }))}
            />
            <ResultGroup
              title="スペース"
              items={results.spaces.map((s) => ({ id: s.id, href: `/spaces/${s.id}`, label: s.name }))}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">検索中…</p>
        )}
      </div>
    </div>
  )
}
