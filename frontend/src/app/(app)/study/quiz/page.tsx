'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, AlertTriangle, Check, X, Loader2, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { TargetPicker, ComingSoonTargets } from '@/components/features/study/TargetPicker'
import { RecentTargets } from '@/components/features/study/RecentTargets'
import { StudyArea } from '@/components/features/study/StudyArea'
import { StudyStatsArea } from '@/components/features/study/StudyStatsArea'
import { useStudyRecordStore } from '@/stores/studyRecords'
import { recordReviews, type ReviewEntry } from '@/lib/api/reviews'
import {
  loadQuizCards,
  buildQuestions,
  targetKey,
  targetLabel,
  MIN_CARDS,
  type QuizTarget,
  type QuizFormat,
  type QuizQuestion,
} from '@/lib/quiz'
import { bodyFor } from '@/lib/page-help'

type Step = 'select' | 'play' | 'result'

const FORMATS: { value: QuizFormat; label: string }[] = [
  { value: 'image_to_word', label: '画像 → 単語' },
  { value: 'word_to_image', label: '単語 → 画像' },
]

const QUESTION_COUNTS: { value: number | 'all'; label: string }[] = [
  { value: 5, label: '5問' },
  { value: 10, label: '10問' },
  { value: 20, label: '20問' },
  { value: 'all', label: 'すべて' },
]

export default function QuizPage() {
  const [step, setStep] = useState<Step>('select')
  const [target, setTarget] = useState<QuizTarget | null>(null)
  const [format, setFormat] = useState<QuizFormat>('image_to_word')
  const [questionCount, setQuestionCount] = useState<number | 'all'>(10)

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [missed, setMissed] = useState<QuizQuestion[]>([])
  const [correctCount, setCorrectCount] = useState(0)
  // 1問ずつ送らず、終わってからまとめて送る（20問で20往復させない）
  const [reviewLog, setReviewLog] = useState<ReviewEntry[]>([])

  const addRecord = useStudyRecordStore((s) => s.addRecord)

  const label = target ? targetLabel(target) : ''
  const formatLabel = format === 'image_to_word' ? '画像→単語' : '単語→画像'

  // 結果に到達したら履歴を1件保存する
  useEffect(() => {
    if (step === 'result' && questions.length > 0) {
      addRecord({ mode: 'quiz', targetLabel: label, format: formatLabel, total: questions.length, correct: correctCount })
      // カードごとの記録はサーバーへ。端末を変えても残り、確認回数が出せる
      recordReviews(reviewLog)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const startQuiz = async () => {
    if (!target) return
    setLoading(true)
    setLoadError(null)
    try {
      const cards = await loadQuizCards(target)
      const count = questionCount === 'all' ? cards.length : questionCount
      const qs = buildQuestions(cards, count)
      if (qs.length === 0) {
        setLoadError(`クイズには画像付きカードが${MIN_CARDS}枚以上必要です。`)
        return
      }
      setQuestions(qs)
      setQIndex(0)
      setSelectedId(null)
      setMissed([])
      setCorrectCount(0)
      setReviewLog([])
      setStep('play')
    } catch {
      setLoadError('クイズの読み込みに失敗しました。時間を置いて再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const answer = (choiceId: string) => {
    if (selectedId) return
    setSelectedId(choiceId)
    const q = questions[qIndex]
    const correct = choiceId === q.card.id
    if (correct) setCorrectCount((c) => c + 1)
    else setMissed((m) => [...m, q])
    setReviewLog((log) => [...log, { item_id: q.card.id, result: correct ? 'correct' : 'incorrect', mode: 'quiz' }])
  }

  const nextQuestion = () => {
    if (qIndex + 1 >= questions.length) {
      setStep('result')
      return
    }
    setQIndex((i) => i + 1)
    setSelectedId(null)
  }

  const backToSelect = () => {
    setStep('select')
    setQuestions([])
    setQIndex(0)
    setSelectedId(null)
    setMissed([])
    setCorrectCount(0)
    setLoadError(null)
  }

  // ---- 選択（3エリア） ----
  if (step === 'select') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <div>
          <Breadcrumb items={[{ href: '/study', label: 'スタディ' }, { label: 'クイズ' }]} />
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <HelpCircle size={26} style={{ color: 'var(--palace)' }} />
            クイズ
          </h1>
          <p className="mt-2 text-muted-foreground">{bodyFor('/study/quiz')}</p>
        </div>

        <StudyArea title="① 出題対象" description="クイズにするカードの範囲を選びます。">
          <div className="space-y-5">
            {/* 検索して選ぶ */}
            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">検索して選ぶ</p>
              <TargetPicker hideComingSoon selectedKey={target ? targetKey(target) : undefined} onSelect={setTarget} />
            </div>

            {/* 保存から選ぶ */}
            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">保存から選ぶ</p>
              <RecentTargets selectedKey={target ? targetKey(target) : undefined} onSelect={setTarget} />
            </div>

            {/* その他から選ぶ */}
            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">その他から選ぶ</p>
              <ComingSoonTargets />
            </div>
          </div>
        </StudyArea>

        <StudyArea title="② 出題設定" description="出題形式と問題数を選びます。">
          <div className="space-y-4">
            {/* 出題形式 */}
            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">出題形式</p>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <SegButton key={f.value} active={format === f.value} onClick={() => setFormat(f.value)}>
                    {f.label}
                  </SegButton>
                ))}
              </div>
            </div>

            {/* 出題数 */}
            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">出題数</p>
              <div className="flex flex-wrap gap-2">
                {QUESTION_COUNTS.map((opt) => (
                  <SegButton key={opt.label} active={questionCount === opt.value} onClick={() => setQuestionCount(opt.value)}>
                    {opt.label}
                  </SegButton>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">対象のカードが少ない場合は、その枚数までで出題します。</p>
            </div>
          </div>
        </StudyArea>

        {/* 開始ボタン（②の下） */}
        <div>
          {loadError && (
            <p className="mb-3 flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle size={15} /> {loadError}
            </p>
          )}
          <Button onClick={startQuiz} disabled={!target || loading} className="flex items-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? '準備中…' : target ? `「${label}」でクイズを開始` : '対象を選んでください'}
          </Button>
        </div>

        <StudyArea title="③ 記録・分析・応用">
          <StudyStatsArea mode="quiz" />
        </StudyArea>
      </div>
    )
  }

  // ---- 結果 ----
  if (step === 'result') {
    const total = questions.length
    const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold">結果</h1>
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-4xl font-bold tabular-nums">
            {correctCount}
            <span className="text-xl font-normal text-muted-foreground"> / {total}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">正答率 {rate}%</p>
        </div>

        {missed.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">間違えたカード（{missed.length}）</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {missed.map((q, i) => (
                <li key={`${q.card.id}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={q.card.image} alt="" className="h-full w-full object-cover" />
                  </div>
                  <span className="text-sm font-medium">{q.card.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={startQuiz} disabled={loading}>もう一度</Button>
          <Button variant="outline" onClick={backToSelect}>対象・設定を変える</Button>
          <Link href="/study"><Button variant="ghost">スタディへ戻る</Button></Link>
        </div>
      </div>
    )
  }

  // ---- 出題（play） ----
  const q = questions[qIndex]
  const answered = selectedId !== null
  const choiceState = (choiceId: string): 'correct' | 'wrong' | 'idle' => {
    if (!answered) return 'idle'
    if (choiceId === q.card.id) return 'correct'
    if (choiceId === selectedId) return 'wrong'
    return 'idle'
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold truncate">{label}</h1>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {qIndex + 1} / {questions.length}
        </span>
      </div>

      {format === 'image_to_word' ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="aspect-square w-full bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={q.card.image} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      ) : (
        <div className="mt-6 flex min-h-32 items-center justify-center rounded-2xl border border-border bg-card p-8">
          <p className="text-center text-2xl font-bold">{q.card.title}</p>
        </div>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        {format === 'image_to_word' ? 'この画像の単語は？' : 'この単語の画像は？'}
      </p>

      {format === 'image_to_word' ? (
        <div className="mt-3 space-y-2">
          {q.choices.map((choice) => (
            <ChoiceTextButton
              key={choice.id}
              label={choice.title}
              state={choiceState(choice.id)}
              disabled={answered}
              onClick={() => answer(choice.id)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {q.choices.map((choice) => (
            <ChoiceImageButton
              key={choice.id}
              image={choice.image}
              state={choiceState(choice.id)}
              disabled={answered}
              onClick={() => answer(choice.id)}
            />
          ))}
        </div>
      )}

      {answered && (
        <div className="mt-6">
          <Button onClick={nextQuestion} className="flex w-full items-center justify-center gap-2">
            {qIndex + 1 >= questions.length ? '結果を見る' : '次へ'}
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  )
}

function SegButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-lg border px-4 py-1.5 text-sm font-medium transition"
      style={{
        borderColor: active ? 'var(--palace)' : 'var(--border)',
        color: active ? 'var(--palace)' : undefined,
        backgroundColor: active ? 'rgba(198,167,94,0.08)' : undefined,
      }}
    >
      {children}
    </button>
  )
}

function choiceClasses(state: 'correct' | 'wrong' | 'idle'): React.CSSProperties {
  if (state === 'correct') return { borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)' }
  if (state === 'wrong') return { borderColor: 'var(--destructive)', backgroundColor: 'rgba(220,38,38,0.06)' }
  return {}
}

function ChoiceTextButton({
  label,
  state,
  disabled,
  onClick,
}: {
  label: string
  state: 'correct' | 'wrong' | 'idle'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium transition enabled:hover:border-[var(--palace)] disabled:cursor-default"
      style={choiceClasses(state)}
    >
      {label}
      {state === 'correct' && <Check size={18} className="text-green-600" />}
      {state === 'wrong' && <X size={18} className="text-destructive" />}
    </button>
  )
}

function ChoiceImageButton({
  image,
  state,
  disabled,
  onClick,
}: {
  image: string
  state: 'correct' | 'wrong' | 'idle'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative overflow-hidden rounded-xl border-2 border-border bg-muted transition enabled:hover:border-[var(--palace)] disabled:cursor-default"
      style={choiceClasses(state)}
    >
      <div className="aspect-square w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="h-full w-full object-cover" />
      </div>
      {state === 'correct' && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-green-600 p-1 text-white"><Check size={16} /></span>
      )}
      {state === 'wrong' && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-destructive p-1 text-white"><X size={16} /></span>
      )}
    </button>
  )
}
