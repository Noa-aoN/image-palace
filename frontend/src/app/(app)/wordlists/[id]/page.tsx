'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { getWordlist, deleteWordlist } from '@/lib/api/wordlists'
import type { Wordlist } from '@/types/wordlist'

export default function WordlistDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [wordlist, setWordlist] = useState<Wordlist | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    getWordlist(params.id)
      .then(setWordlist)
      .catch(() => setError('ワードリストが見つかりませんでした'))
  }, [params.id])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteWordlist(params.id)
      router.push('/wordlists')
    } catch {
      setError('削除に失敗しました')
      setDeleting(false)
    }
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!wordlist) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="h-7 w-40 rounded bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Breadcrumb items={[{ href: '/wordlists', label: 'ワードリスト' }, { label: wordlist.name }]} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{wordlist.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{wordlist.word_count} 語</p>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>キャンセル</Button>
            <Button size="sm" onClick={handleDelete} disabled={deleting} style={{ backgroundColor: 'var(--destructive)', color: '#fff' }}>
              {deleting ? '削除中...' : '削除する'}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirming(true)}>削除</Button>
        )}
      </div>

      <ol className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {wordlist.words.map((word, i) => (
          <li key={`${word}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <span>{word}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
