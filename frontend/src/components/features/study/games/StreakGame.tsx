'use client'

import { useEffect, useState } from 'react'
import { Flame, Check, X, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStudyRecordStore } from '@/stores/studyRecords'
import {
  loadQuizCards,
  buildQuestions,
  MIN_CARDS,
  targetLabel,
  type QuizTarget,
  type QuizCard,
  type QuizQuestion,
  type QuizFormat,
} from '@/lib/quiz'

// 連続正解チャレンジ：正解を選び、間違えるまで続ける。format で出題形式を切り替える。
export function StreakGame({
  target,
  format = 'image_to_word',
  onExit,
}: {
  target: QuizTarget
  format?: QuizFormat
  onExit: () => void
}) {
  const [cards, setCards] = useState<QuizCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState<QuizQuestion | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const [over, setOver] = useState(false)

  const addRecord = useStudyRecordStore((s) => s.addRecord)
  const bestStreak = useStudyRecordStore((s) =>
    s.records.filter((r) => r.mode === 'game' && r.game === 'streak').reduce((max, r) => Math.max(max, r.total), 0)
  )
  const label = targetLabel(target)

  const load = () => {
    setError(null)
    setOver(false)
    setStreak(0)
    setSelectedId(null)
    setCards(null)
    setQuestion(null)
    loadQuizCards(target)
      .then((loaded) => {
        if (loaded.length < MIN_CARDS) {
          setError(`ゲームには画像付きカードが${MIN_CARDS}枚以上必要です。`)
          setCards([])
          return
        }
        setCards(loaded)
        setQuestion(buildQuestions(loaded, 1)[0])
      })
      .catch(() => {
        setError('カードの読み込みに失敗しました。時間を置いて再度お試しください。')
        setCards([])
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const endGame = () => {
    addRecord({ mode: 'game', game: 'streak', targetLabel: label, total: streak, correct: streak, score: streak })
    setOver(true)
  }

  const answer = (choiceId: string) => {
    if (selectedId || !question) return
    setSelectedId(choiceId)
    if (choiceId === question.card.id) {
      setStreak((s) => s + 1)
    } else {
      endGame()
    }
  }

  const nextQuestion = () => {
    if (!cards) return
    setQuestion(buildQuestions(cards, 1)[0])
    setSelectedId(null)
  }

  // ---- 読み込み中／エラー ----
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

  // ---- ゲームオーバー ----
  if (over) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-semibold">ゲームオーバー</h2>
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <p className="flex items-center justify-center gap-2 text-4xl font-bold tabular-nums">
            <Flame size={28} style={{ color: 'var(--palace)' }} /> {streak}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">連続正解 ／ ベスト {bestStreak}</p>
        </div>
        {question && (
          <p className="mt-4 text-sm text-muted-foreground">
            正解は「<span className="font-medium text-foreground">{question.card.title}</span>」でした。
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={load}>もう一度</Button>
          <Button variant="outline" onClick={onExit}>対象・ゲームを変える</Button>
        </div>
      </div>
    )
  }

  if (!question) return null
  const answered = selectedId !== null
  const choiceState = (id: string): 'correct' | 'wrong' | 'idle' => {
    if (!answered) return 'idle'
    if (id === question.card.id) return 'correct'
    if (id === selectedId) return 'wrong'
    return 'idle'
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold truncate">{label}</h2>
        <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums" style={{ color: 'var(--palace)' }}>
          <Flame size={16} /> {streak}
        </span>
      </div>

      {format === 'image_to_word' ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="aspect-square w-full bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={question.card.image} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      ) : (
        <div className="mt-6 flex min-h-32 items-center justify-center rounded-2xl border border-border bg-card p-8">
          <p className="text-center text-2xl font-bold">{question.card.title}</p>
        </div>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        {format === 'image_to_word' ? 'この画像の単語は？' : 'この単語の画像は？'}
      </p>

      {format === 'image_to_word' ? (
        <div className="mt-3 space-y-2">
          {question.choices.map((choice) => {
            const state = choiceState(choice.id)
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => answer(choice.id)}
                disabled={answered}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium transition enabled:hover:border-[var(--palace)] disabled:cursor-default"
                style={
                  state === 'correct'
                    ? { borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)' }
                    : state === 'wrong'
                      ? { borderColor: 'var(--destructive)', backgroundColor: 'rgba(220,38,38,0.06)' }
                      : undefined
                }
              >
                {choice.title}
                {state === 'correct' && <Check size={18} className="text-green-600" />}
                {state === 'wrong' && <X size={18} className="text-destructive" />}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {question.choices.map((choice) => {
            const state = choiceState(choice.id)
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => answer(choice.id)}
                disabled={answered}
                className="relative overflow-hidden rounded-xl border-2 border-border bg-muted transition enabled:hover:border-[var(--palace)] disabled:cursor-default"
                style={
                  state === 'correct'
                    ? { borderColor: '#16a34a' }
                    : state === 'wrong'
                      ? { borderColor: 'var(--destructive)' }
                      : undefined
                }
              >
                <div className="aspect-square w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={choice.image} alt="" className="h-full w-full object-cover" />
                </div>
                {state === 'correct' && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-green-600 p-1 text-white"><Check size={16} /></span>
                )}
                {state === 'wrong' && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-destructive p-1 text-white"><X size={16} /></span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        {/* 終わる(左・控えめ)と続ける(右・主)を常に固定位置で表示し、押し間違いを防ぐ */}
        <Button variant="outline" onClick={endGame} className="shrink-0">
          終わる
        </Button>
        <Button onClick={nextQuestion} disabled={!answered} className="flex flex-1 items-center justify-center">
          続ける
        </Button>
      </div>
    </div>
  )
}
