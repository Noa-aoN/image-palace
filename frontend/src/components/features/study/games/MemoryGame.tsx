'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertTriangle, Sparkles, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStudyRecordStore } from '@/stores/studyRecords'
import { loadQuizCards, targetLabel, type QuizTarget, type QuizCard } from '@/lib/quiz'
import { shuffle } from '@/lib/shuffle'

const MIN_PAIRS = 4
const DEFAULT_MAX_PAIRS = 6

export type MemoryPairType = 'image_word' | 'image_image' | 'word_word'

type Tile = { uid: number; itemId: string; kind: 'image' | 'word'; image: string; title: string }

// 1アイテムの2タイルの中身を pairType で決める。一致判定は itemId なので種類は問わない。
function tileKinds(pairType: MemoryPairType): ['image' | 'word', 'image' | 'word'] {
  if (pairType === 'image_image') return ['image', 'image']
  if (pairType === 'word_word') return ['word', 'word']
  return ['image', 'word']
}

// カードからペアのタイルを作り、シャッフルして並べる。
function buildTiles(cards: QuizCard[], pairs: number, pairType: MemoryPairType): Tile[] {
  const chosen = shuffle(cards).slice(0, pairs)
  const [k1, k2] = tileKinds(pairType)
  const tiles: Omit<Tile, 'uid'>[] = []
  for (const c of chosen) {
    tiles.push({ itemId: c.id, kind: k1, image: c.image, title: c.title })
    tiles.push({ itemId: c.id, kind: k2, image: c.image, title: c.title })
  }
  return shuffle(tiles).map((t, i) => ({ ...t, uid: i }))
}

// 神経衰弱：裏返したカードのペアを記憶しながらそろえる。
export function MemoryGame({
  target,
  pairType = 'image_word',
  pairCount = 'auto',
  onExit,
}: {
  target: QuizTarget
  pairType?: MemoryPairType
  pairCount?: number | 'auto'
  onExit: () => void
}) {
  const [cards, setCards] = useState<QuizCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [pairs, setPairs] = useState(0)
  const [matched, setMatched] = useState<Set<string>>(new Set())
  const [flipped, setFlipped] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [locked, setLocked] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const label = targetLabel(target)
  const addRecord = useStudyRecordStore((s) => s.addRecord)

  // クリア時に履歴を1件保存する
  useEffect(() => {
    if (pairs > 0 && matched.size === pairs) {
      addRecord({ mode: 'game', game: 'memory', targetLabel: label, total: pairs, correct: pairs, score: moves })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, pairs])

  const setup = (pool: QuizCard[]) => {
    const requested = pairCount === 'auto' ? DEFAULT_MAX_PAIRS : pairCount
    const p = Math.min(requested, pool.length)
    setPairs(p)
    setTiles(buildTiles(pool, p, pairType))
    setMatched(new Set())
    setFlipped([])
    setMoves(0)
    setLocked(false)
  }

  useEffect(() => {
    loadQuizCards(target)
      .then((loaded) => {
        if (loaded.length < MIN_PAIRS) {
          setError(`神経衰弱には画像付きカードが${MIN_PAIRS}枚以上必要です。`)
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
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flip = (tile: Tile) => {
    if (locked || matched.has(tile.itemId) || flipped.includes(tile.uid)) return
    const next = [...flipped, tile.uid]
    setFlipped(next)
    if (next.length < 2) return

    setLocked(true)
    setMoves((m) => m + 1)
    const [a, b] = next.map((uid) => tiles.find((t) => t.uid === uid)!)
    if (a.itemId === b.itemId) {
      timer.current = setTimeout(() => {
        setMatched((prev) => new Set(prev).add(a.itemId))
        setFlipped([])
        setLocked(false)
      }, 450)
    } else {
      timer.current = setTimeout(() => {
        setFlipped([])
        setLocked(false)
      }, 850)
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

  const completed = pairs > 0 && matched.size === pairs

  if (completed) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-semibold">クリア！</h2>
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <p className="text-4xl font-bold tabular-nums">{moves}</p>
          <p className="mt-1 text-sm text-muted-foreground">手数（{pairs} ペア）</p>
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
          {matched.size} / {pairs} ペア ・ {moves} 手
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">画像と単語のペアをそろえましょう。</p>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => {
          const isMatched = matched.has(tile.itemId)
          const isFaceUp = isMatched || flipped.includes(tile.uid)
          return (
            <button
              key={tile.uid}
              type="button"
              onClick={() => flip(tile)}
              disabled={isFaceUp || locked}
              aria-label={isFaceUp ? tile.title : '裏向きのカード'}
              className="relative aspect-square overflow-hidden rounded-xl border bg-card transition disabled:cursor-default"
              style={{
                borderColor: isMatched ? '#16a34a' : 'var(--border)',
                opacity: isMatched ? 0.7 : 1,
              }}
            >
              {isFaceUp ? (
                tile.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tile.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center break-words px-1.5 text-center text-xs font-semibold leading-tight">
                    {tile.title}
                  </span>
                )
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-[rgba(198,167,94,0.06)]">
                  <Sparkles size={20} style={{ color: 'var(--palace)', opacity: 0.5 }} />
                </span>
              )}
              {isMatched && (
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
