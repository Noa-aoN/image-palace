'use client'

import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { fetchWikipediaSummary } from '@/lib/api/wikipedia'
import type { WikipediaValue } from '@/lib/api/properties'

/**
 * Wikipedia で調べた結果。
 *
 * ここは**読む場所ではなく、確かめて記事へ渡す場所**。だから冒頭までしか出さない。
 * 記事の全文は取りにも行かないし、保存もしない。
 *
 * 出典は必ず添える。Wikipedia の文は CC BY-SA なので、
 * どこから来たのかと、その条件が読めない形で出してはいけない。
 *
 * 画像は URL を指すだけ。ファイルはこちらに持たない
 * （記事本文とは別のライセンスが付くことがあるため）。
 */
export function WikipediaProperty({
  value,
  term,
  languageCode,
  onSaved,
  editable,
}: {
  value: WikipediaValue | null
  /** 引く語。既定は見出し語 */
  term: string
  /** 引く言語。渡さなければサーバーが決める（利用者の表示言語 → ブラウザ → ja） */
  languageCode?: string
  onSaved: (next: WikipediaValue) => void
  editable: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const lookup = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await fetchWikipediaSummary(term, languageCode)
      if (!result.found) {
        // 引けないのは異常ではない。カードの読み書きは止めない
        setMessage(result.message ?? 'いま引けませんでした')
        return
      }
      if (result.disambiguation) {
        setMessage('複数の意味がある語でした。見出し語をより具体的にするとうまく引けます。')
        return
      }
      onSaved(result.summary)
    } catch {
      setMessage('いま引けませんでした')
    } finally {
      setBusy(false)
    }
  }

  if (!value) {
    return (
      <div className="space-y-2">
        {editable ? (
          <Button variant="outline" size="sm" onClick={lookup} disabled={busy} className="flex items-center gap-1.5">
            {busy ? <Spinner size={13} /> : <RefreshCw size={13} />}
            「{term}」を Wikipedia で調べる
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">未設定</p>
        )}
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {value.wikipedia_thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element -- Wikimedia の画像。こちらに保存しない
          <img
            src={value.wikipedia_thumbnail_url}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
          />
        )}
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">
            {value.wikipedia_title}
            {value.wikipedia_description && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {value.wikipedia_description}
              </span>
            )}
          </p>
          {value.wikipedia_extract && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{value.wikipedia_extract}</p>
          )}
        </div>
      </div>

      {/* 出どころとライセンス。CC BY-SA なので、これが読めない形で出さない */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {value.wikipedia_url && (
          <a
            href={value.wikipedia_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 underline-offset-2 hover:underline"
          >
            記事を読む
            <ExternalLink size={11} />
          </a>
        )}
        <span>
          Wikipedia より（
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/deed.ja"
            target="_blank"
            rel="noopener noreferrer license"
            className="underline-offset-2 hover:underline"
          >
            CC BY-SA 4.0
          </a>
          ）
        </span>
        {editable && (
          <button
            type="button"
            onClick={lookup}
            disabled={busy}
            className="flex items-center gap-1 hover:text-foreground disabled:opacity-50"
          >
            {busy ? <Spinner size={11} /> : <RefreshCw size={11} />}
            引き直す
          </button>
        )}
      </p>

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}
