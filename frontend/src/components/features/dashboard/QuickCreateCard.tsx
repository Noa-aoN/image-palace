'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent } from '@/components/ui/card'
import { createItem } from '@/lib/api/items'
import { trackEvent } from '@/lib/analytics'
import { getSettings } from '@/lib/api/settings'
import { DEFAULT_MEANING_LEVEL } from '@/lib/meaning-levels'
import { CREDIT_UNIT_SHORT } from '@/lib/billing'
import { useItemsStore } from '@/stores/items'
import { useBillingStore } from '@/stores/billing'

const MAX_TITLE_LENGTH = 100

// 改行・カンマ・読点区切りで複数タイトルに分割（CreateItemForm と同じ挙動）。
function parseTitles(raw: string): string[] {
  return raw
    .split(/[\n,、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * エントランス用の最速カード作成。単語を入れて「生成」でその場で即生成する。
 * スタイル・意味・タグなどはデフォルト設定（おまかせ／ユーザー設定値）で生成し、
 * 詳しく設定したい場合のみ作成ページ（/items/new）へ誘導する。
 */
export function QuickCreateCard() {
  const upsertItem = useItemsStore((s) => s.upsertItem)
  const fetchBilling = useBillingStore((s) => s.fetchSummary)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneCount, setDoneCount] = useState<number | null>(null)
  // 意味・タグの自動生成の既定（ユーザー設定）。CreateItemForm と同じ値。
  const [genMeaning, setGenMeaning] = useState(true)
  const [genTags, setGenTags] = useState(true)

  useEffect(() => {
    getSettings()
      .then((s) => {
        setGenMeaning(s.auto_generate_meanings)
        setGenTags(s.auto_generate_tags)
      })
      .catch(() => {})
  }, [])

  const titles = parseTitles(input)
  const tooLong = titles.some((t) => t.length > MAX_TITLE_LENGTH)

  const handleGenerate = async () => {
    if (titles.length === 0) return
    if (tooLong) {
      setError(`1単語あたり${MAX_TITLE_LENGTH}文字以内で入力してください。`)
      return
    }
    setError(null)
    setDoneCount(null)
    setSubmitting(true)
    try {
      for (const title of titles) {
        // デフォルト生成: スタイルはおまかせ（省略）、キャッシュ利用、意味/タグは設定値。
        const item = await createItem(title, false, undefined, {
          generateMeaning: genMeaning,
          generateMeaningLevel: genMeaning ? DEFAULT_MEANING_LEVEL : undefined,
          generateTags: genTags,
        })
        upsertItem(item)
      }
      trackEvent('create_items', {
        count: titles.length,
        force_generate: false,
        with_meaning: genMeaning,
        with_tags: genTags,
        source: 'entrance_quick',
      })
      fetchBilling()
      setDoneCount(titles.length)
      setInput('')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; errors?: string[] } } }
      setError(
        axiosErr?.response?.data?.error ??
          axiosErr?.response?.data?.errors?.[0] ??
          'カードの作成に失敗しました（クレジットが不足している可能性があります）。'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            if (doneCount !== null) setDoneCount(null)
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              handleGenerate()
            }
          }}
          disabled={submitting}
          rows={2}
          placeholder="カードにしたい単語や概念を入力（改行・カンマ・読点で複数枚をまとめて作成）"
          aria-label="カードにする単語"
          className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button onClick={handleGenerate} disabled={submitting || titles.length === 0} className="flex items-center gap-2">
            {submitting && <Spinner size={15} />}
            {submitting ? '生成中...' : titles.length > 1 ? `${titles.length}枚を生成` : 'カードを生成'}
          </Button>
          <p className="text-xs text-muted-foreground">
            1枚につき1{CREDIT_UNIT_SHORT}消費・スタイルや意味などはデフォルト設定で生成します。
            <Link href="/items/new" className="ml-1 underline hover:text-foreground">
              詳しく設定
            </Link>
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {doneCount !== null && !error && (
          <p className="text-sm text-muted-foreground">
            {doneCount}枚の生成を開始しました。
            <Link href="/items" className="ml-1 font-medium underline" style={{ color: 'var(--palace)' }}>
              カード一覧で確認 →
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
