'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertTriangle, Volume2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStudyRecordStore } from '@/stores/studyRecords'
import { loadPracticeCards, targetLabel, type QuizTarget, type PracticeCard } from '@/lib/quiz'
import { shuffle } from '@/lib/shuffle'

const MIN_CARDS = 4
const DEFAULT_COUNT = 8

export type KarutaReadBy = 'word' | 'meaning'

// 読み上げる文（説明モードで意味が無ければ単語にフォールバック）
function readingText(card: PracticeCard, readBy: KarutaReadBy): string {
  if (readBy === 'meaning' && card.meaning?.trim()) return card.meaning
  return card.title
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  window.speechSynthesis.speak(u)
}

// カルタ：読み札（単語/説明）を手がかりに、正しい場札（画像）をタップして取る。
export function KarutaGame({
  target,
  readBy = 'word',
  cardCount = 'auto',
  onExit,
}: {
  target: QuizTarget
  readBy?: KarutaReadBy
  cardCount?: number | 'auto'
  onExit: () => void
}) {
  const [cards, setCards] = useState<PracticeCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [board, setBoard] = useState<PracticeCard[]>([])
  const [order, setOrder] = useState<string[]>([])
  const [ptr, setPtr] = useState(0)
  const [taken, setTaken] = useState<Set<string>>(new Set())
  const [mistakes, setMistakes] = useState(0)
  const [wrongId, setWrongId] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const label = targetLabel(target)

  const setup = (pool: PracticeCard[]) => {
    const count = cardCount === 'auto' ? Math.min(DEFAULT_COUNT, pool.length) : Math.min(cardCount, pool.length)
    const b = shuffle(pool).slice(0, count)
    setBoard(b)
    setOrder(shuffle(b.map((c) => c.id)))
    setPtr(0)
    setTaken(new Set())
    setMistakes(0)
    setWrongId(null)
  }

  useEffect(() => {
    loadPracticeCards(target)
      .then((loaded) => {
        if (loaded.length < MIN_CARDS) {
          setError(`カルタには画像付きカードが${MIN_CARDS}枚以上必要です。`)
          setCards([])
          return
        }
        setCards(loaded)
        setup(loaded)
      })
      .catch(() => {
        setError('カードの読み込みに失敗しました。時間を置いて再度お試しください。')
        setCards([])
      })
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const completed = board.length > 0 && taken.size === board.length
  const current = !completed && order.length > 0 ? board.find((c) => c.id === order[ptr]) ?? null : null
  const reading = current ? readingText(current, readBy) : ''

  const addRecord = useStudyRecordStore((s) => s.addRecord)
  // クリア時に履歴を1件保存する
  useEffect(() => {
    if (completed) {
      addRecord({ mode: 'game', game: 'karuta', targetLabel: label, total: board.length, correct: board.length, score: mistakes })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed])

  // 新しい読み札になったら自動で読み上げる
  useEffect(() => {
    if (reading) speak(reading)
     
  }, [reading])

  const tap = (card: PracticeCard) => {
    if (completed || taken.has(card.id) || !current) return
    if (card.id === current.id) {
      setTaken((prev) => new Set(prev).add(card.id))
      setPtr((p) => p + 1)
    } else {
      setMistakes((m) => m + 1)
      setWrongId(card.id)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setWrongId(null), 500)
    }
  }

  if (cards === null) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 size={18} className="animate-spin" /> 読み込み中…
      </div>
    )
  }
  if (error) {
    return (
      <div className="text-center">
        <p className="flex items-center justify-center gap-1.5 text-muted-foreground">
          <AlertTriangle size={16} /> {error}
        </p>
        <Button variant="outline" className="mt-6" onClick={onExit}>対象を選び直す</Button>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-semibold">クリア！</h2>
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <p className="text-4xl font-bold tabular-nums">{board.length}</p>
          <p className="mt-1 text-sm text-muted-foreground">枚すべて取りました ・ お手つき {mistakes}</p>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => cards && setup(cards)}>もう一度</Button>
          <Button variant="outline" onClick={onExit}>対象・ゲームを変える</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold truncate">{label}</h2>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {taken.size} / {board.length} ・ お手つき {mistakes}
        </span>
      </div>

      {/* 読み札 */}
      <div className="mt-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">読み札（{readBy === 'meaning' ? '説明' : '単語'}）</p>
          <button
            type="button"
            onClick={() => reading && speak(reading)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:border-[var(--palace)]"
          >
            <Volume2 size={14} /> もう一度読む
          </button>
        </div>
        <p className="mt-2 text-lg font-bold leading-snug">{reading}</p>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">読み札に合う画像をタップして取りましょう。</p>

      {/* 場札 */}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {board.map((card) => {
          const isTaken = taken.has(card.id)
          const isWrong = wrongId === card.id
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => tap(card)}
              disabled={isTaken}
              aria-label={isTaken ? `${card.title}（取得済み）` : '場札'}
              className="relative aspect-square overflow-hidden rounded-xl border-2 bg-muted transition disabled:cursor-default"
              style={{
                borderColor: isWrong ? 'var(--destructive)' : isTaken ? '#16a34a' : 'var(--border)',
                opacity: isTaken ? 0.45 : 1,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.image} alt="" className="h-full w-full object-cover" />
              {isTaken && (
                <span className="absolute right-1 top-1 rounded-full bg-green-600 p-0.5 text-white">
                  <Check size={12} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <Button variant="ghost" className="mt-6" onClick={onExit}>← 対象・ゲームを変える</Button>
    </div>
  )
}
