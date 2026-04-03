'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createItem } from '@/lib/api/items'

function parseTitles(raw: string): string[] {
  return raw
    .split(/[\n,、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function CreateItemForm() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [apiError, setApiError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const titles = parseTitles(input)
  const wordCount = titles.length

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (titles.length === 0) return
    setApiError(null)
    setSubmitting(true)
    setProgress({ done: 0, total: titles.length })

    try {
      for (let i = 0; i < titles.length; i++) {
        await createItem(titles[i])
        setProgress({ done: i + 1, total: titles.length })
      }
      router.push('/items')
    } catch {
      setApiError('カードの作成に失敗しました。もう一度試してください。')
    } finally {
      setSubmitting(false)
      setProgress(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="titles">単語・概念を入力</Label>
        <textarea
          id="titles"
          className="w-full min-h-[180px] rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          placeholder={"photosynthesis\nAPI\nmitosis\n\n改行・カンマ区切りで複数入力できます"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitting}
        />
        {wordCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {wordCount}件の単語を認識しました
          </p>
        )}
      </div>

      {apiError && <p className="text-sm text-destructive">{apiError}</p>}

      {progress && (
        <p className="text-sm text-muted-foreground">
          作成中... {progress.done} / {progress.total}
        </p>
      )}

      <Button
        type="submit"
        disabled={submitting || wordCount === 0}
        className="w-full"
      >
        {submitting
          ? `作成中... (${progress?.done ?? 0}/${progress?.total ?? wordCount})`
          : wordCount > 1
            ? `${wordCount}件のカードを作成`
            : 'カードを作成'}
      </Button>
    </form>
  )
}
