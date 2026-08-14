'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent } from '@/components/ui/card'
import { createItem, getItem } from '@/lib/api/items'
import { trackEvent } from '@/lib/analytics'
import { getSettings } from '@/lib/api/settings'
import { DEFAULT_MEANING_LEVEL } from '@/lib/meaning-levels'
import { CREDIT_UNIT_SHORT } from '@/lib/billing'
import { useItemsStore } from '@/stores/items'
import { useBillingStore } from '@/stores/billing'
import { isSubmitEnter } from '@/lib/enter-key'

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
  // いま作らせているカード。**できるまで動いているのが見える**ようにする
  const [watching, setWatching] = useState<string[]>([])
  const [ready, setReady] = useState(0)
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

  /**
   * できたかどうかを追う。
   *
   * 「始めました」と出したきり動かないと、**進んでいるのか止まったのかが分からない**。
   * 数えるのは作らせたぶんだけ。全部片付いたら見るのをやめる（ずっと叩き続けない）。
   */
  useEffect(() => {
    if (watching.length === 0) return

    let cancelled = false
    const timer = setInterval(async () => {
      const results = await Promise.all(
        watching.map((id) => getItem(id).catch(() => null))
      )
      if (cancelled) return

      const settled = results.filter(
        (item) => item && (item.generation_status === 'completed' || item.generation_status === 'failed')
      ).length
      setReady(settled)
      if (settled >= watching.length) setWatching([])
    }, 2500)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [watching])

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
    setWatching([])
    setReady(0)
    setSubmitting(true)
    const created: { id: string }[] = []
    try {
      for (const title of titles) {
        // デフォルト生成: スタイルはおまかせ（省略）、キャッシュ利用、意味/タグは設定値。
        const item = await createItem(title, false, undefined, {
          generateMeaning: genMeaning,
          generateMeaningLevel: genMeaning ? DEFAULT_MEANING_LEVEL : undefined,
          generateTags: genTags,
        })
        upsertItem(item)
        created.push(item)
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
      setWatching(created.map((item) => item.id))
      setReady(0)
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
            if ((e.metaKey || e.ctrlKey) && isSubmitEnter(e)) {
              e.preventDefault()
              handleGenerate()
            }
          }}
          disabled={submitting}
          rows={2}
          placeholder="単語や概念を入力（改行・カンマで複数枚）"
          aria-label="カードにする単語"
          className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button onClick={handleGenerate} disabled={submitting || titles.length === 0} className="flex items-center gap-2">
            {submitting && <Spinner size={15} />}
            {submitting ? '生成中...' : titles.length > 1 ? `${titles.length}枚を生成` : 'カードを生成'}
          </Button>
          {/* 消費の目安は釦の隣に置く。下に1行を足すとその分だけ縦に伸び、
              入力欄と行き先の間が遠くなる */}
          <p className="text-xs text-muted-foreground">1枚 1{CREDIT_UNIT_SHORT}・設定は既定のまま</p>
          {/* 行き先は常に出す。作ったあとにだけ出していたため、
              「一覧はどこか」を探すことになっていた */}
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <Link href="/items/new" className="underline hover:text-foreground">
              詳しく設定
            </Link>
            <Link href="/items" className="underline hover:text-foreground">
              カード一覧へ
            </Link>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {doneCount !== null && !error && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {watching.length > 0 ? (
              <>
                <Spinner size={14} />
                {doneCount}枚を作っています（{ready}/{doneCount} 枚できました）
              </>
            ) : (
              <>{doneCount}枚できました。</>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
