'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { generateWords } from '@/lib/api/wordlists'
import { createItem } from '@/lib/api/items'
import { STYLE_OPTIONS } from '@/lib/item-styles'
import { useBillingStore } from '@/stores/billing'
import { useAcropolisStore } from '@/stores/acropolis'

const MAX_PULL = 5

function styleLabel(value: string): string {
  return STYLE_OPTIONS.find((o) => o.value === value)?.label ?? 'おまかせ'
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AcropolisPage() {
  const [genre, setGenre] = useState('')
  const [count, setCount] = useState(1)
  // 既定は「写真(photo)」。未指定だと realism 指示が付かずイラスト寄りになるため。
  const [style, setStyle] = useState('photo')
  const [forging, setForging] = useState(false)
  const [accepting, setAccepting] = useState(false)
  // 神託で提示された（まだ受け取っていない）単語。受け取るまで画像生成・クレジット消費はしない。
  const [pending, setPending] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const billing = useBillingStore((s) => s.summary)
  const fetchBilling = useBillingStore((s) => s.fetchSummary)
  const history = useAcropolisStore((s) => s.history)
  const addRecord = useAcropolisStore((s) => s.addRecord)
  const clearHistory = useAcropolisStore((s) => s.clearHistory)

  // 受け取り済み＝二度と出さない（除外）。キャンセル済み＝出る確率を大きく下げる（回避）。
  const excludeWords = useMemo(
    () => Array.from(new Set(history.filter((r) => r.status === 'received').flatMap((r) => r.words))),
    [history]
  )
  const avoidWords = useMemo(
    () => Array.from(new Set(history.filter((r) => r.status === 'cancelled').flatMap((r) => r.words))),
    [history]
  )

  useEffect(() => {
    fetchBilling()
  }, [fetchBilling])

  const available = billing?.available_credits ?? null
  const needed = pending?.length ?? 0
  const insufficient = available != null && available < needed
  const busy = forging || accepting || pending !== null

  // 神託を受ける: 単語を生成して提示するだけ（クレジット消費なし）。
  const handleConsult = async () => {
    setForging(true)
    setError(null)
    try {
      const words = await generateWords(genre.trim(), count, { exclude: excludeWords, avoid: avoidWords })
      if (words.length === 0) {
        setError('神託が得られませんでした。もう一度お試しください。')
        return
      }
      setPending(words)
    } catch {
      setError('神託に失敗しました。もう一度お試しください。')
    } finally {
      setForging(false)
    }
  }

  // 受け取る: 提示された単語をカード化（画像生成・クレジット消費）。
  const handleAccept = async () => {
    if (!pending) return
    setAccepting(true)
    setError(null)
    const cardIds: string[] = []
    const cardWords: string[] = []
    try {
      for (const word of pending) {
        const item = await createItem(word.trim(), false, undefined, { style: style || undefined })
        cardIds.push(item.id)
        cardWords.push(item.title)
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; errors?: string[] } } }
      setError(
        axiosErr?.response?.data?.error ??
          axiosErr?.response?.data?.errors?.[0] ??
          'カードの作成に失敗しました（クレジット不足の可能性があります）。'
      )
    } finally {
      if (cardIds.length > 0) {
        addRecord({
          id: crypto.randomUUID(),
          words: cardWords,
          style,
          status: 'received',
          cardIds,
          createdAt: Date.now(),
        })
      }
      setPending(null)
      setAccepting(false)
      fetchBilling()
    }
  }

  // キャンセル: 提示された神託を破棄（履歴には残す。カード・クレジットは発生しない）。
  const handleCancel = () => {
    if (!pending) return
    addRecord({
      id: crypto.randomUUID(),
      words: pending,
      style,
      status: 'cancelled',
      cardIds: [],
      createdAt: Date.now(),
    })
    setPending(null)
    setError(null)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="max-w-2xl mx-auto">
      <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
        <Wand2 size={26} style={{ color: 'var(--palace)' }} />
        アクロポリス
      </h1>
      <p className="mt-2 text-muted-foreground">
        ジャンルを指定するか、空欄のまま完全ランダムで神託を受け、気に入ったら受け取ってカード化します。
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="genre" className="mb-1 block text-sm font-medium">ジャンル（空欄でランダム）</label>
          <Input
            id="genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="例: 宇宙、英単語"
            disabled={busy}
          />
        </div>
        <div className="w-28">
          <label htmlFor="style" className="mb-1 block text-sm font-medium">スタイル</label>
          <select
            id="style"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            disabled={busy}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.value || 'default'} value={opt.value}>
                {/* 既定の写真は「おすすめ」として見せる */}
                {opt.value === 'photo' ? `おすすめ（${opt.label}）` : opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-20">
          <label htmlFor="count" className="mb-1 block text-sm font-medium">枚数</label>
          <select
            id="count"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={busy}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Array.from({ length: MAX_PULL }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <Button onClick={handleConsult} disabled={busy} className="flex items-center justify-center gap-2 sm:w-44">
          {forging ? <Spinner size={15} /> : <Wand2 size={16} />}
          {forging ? '神託を待っています...' : '神託を受ける'}
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        神託の閲覧は無料です。受け取り（カード化）時に1枚につき1クレジット消費します
        {available != null ? `（残り ${available} cr）` : ''}。
      </p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {/* 提示された神託（受け取り/キャンセルの意思表示） */}
      {pending && (
        <div className="mt-6 rounded-xl border border-border bg-card px-6 py-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">神託の結果</p>
            <button
              type="button"
              onClick={handleCancel}
              disabled={accepting}
              aria-label="この神託をキャンセル"
              className="rounded p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {pending.map((word, i) => (
              <li key={`${word}-${i}`} className="rounded-full border border-border bg-background px-3 py-1 text-sm font-medium">
                {word}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            受け取ると {needed} 枚のカードを作成します（{needed} クレジット消費・スタイル: {styleLabel(style)}）。
          </p>
          {insufficient && (
            <p className="mt-1 text-xs text-destructive">
              クレジットが不足しています。
              <Link href="/billing" className="ml-1 underline">プランを見る</Link>
            </p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={handleAccept} disabled={accepting || insufficient} className="flex items-center gap-2">
              {accepting ? <Spinner size={15} /> : <Wand2 size={16} />}
              {accepting ? '受け取り中...' : '受け取る'}
            </Button>
            <Button variant="ghost" onClick={handleCancel} disabled={accepting}>キャンセル</Button>
          </div>
        </div>
      )}

      {/* 神託の履歴 */}
      {history.length > 0 && (
        <section className="mt-10 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">神託の履歴</h2>
            <button type="button" onClick={clearHistory} className="text-xs text-muted-foreground hover:underline">
              履歴をクリア
            </button>
          </div>
          <ul className="divide-y overflow-hidden rounded-xl border border-border bg-card">
            {history.map((rec) => (
              <li key={rec.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${rec.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {rec.status === 'received' ? '受け取り' : 'キャンセル'}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(rec.createdAt)} ・ {styleLabel(rec.style)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {rec.words.map((word, i) =>
                    rec.status === 'received' && rec.cardIds[i] ? (
                      <Link
                        key={`${rec.id}-${i}`}
                        href={`/items/${rec.cardIds[i]}`}
                        className="rounded-full border border-border px-3 py-1 text-sm hover:bg-black/5"
                      >
                        {word}
                      </Link>
                    ) : (
                      <span key={`${rec.id}-${i}`} className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
                        {word}
                      </span>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </div>
  )
}
