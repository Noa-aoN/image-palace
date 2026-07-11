'use client'

import { useState } from 'react'
import { Shuffle, ArrowRight, ImageIcon, Type, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { TargetPicker, ComingSoonTargets } from '@/components/features/study/TargetPicker'
import { RecentTargets } from '@/components/features/study/RecentTargets'
import { StudyArea } from '@/components/features/study/StudyArea'
import { StudyStatsArea } from '@/components/features/study/StudyStatsArea'
import { useStudyRecordStore } from '@/stores/studyRecords'
import { loadPracticeCards, targetKey, targetLabel, type QuizTarget, type PracticeCard } from '@/lib/quiz'
import { shuffle } from '@/lib/shuffle'

type Step = 'select' | 'study'
type FrontMode = 'image' | 'word'

export default function PracticePage() {
  const [step, setStep] = useState<Step>('select')
  const [target, setTarget] = useState<QuizTarget | null>(null)
  const [cards, setCards] = useState<PracticeCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [mode, setMode] = useState<FrontMode>('image')

  const addRecord = useStudyRecordStore((s) => s.addRecord)
  const label = target ? targetLabel(target) : ''

  const start = async () => {
    if (!target) return
    setLoading(true)
    setError(null)
    try {
      const loaded = await loadPracticeCards(target)
      if (loaded.length === 0) {
        setError('この対象には学習できる画像付きカードがありません。')
        return
      }
      addRecord({ mode: 'practice', targetLabel: label, total: loaded.length, correct: 0 })
      setCards(shuffle(loaded))
      setIndex(0)
      setRevealed(false)
      setStep('study')
    } catch {
      setError('カードの読み込みに失敗しました。時間を置いて再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const reshuffle = () => {
    setCards((current) => shuffle(current))
    setIndex(0)
    setRevealed(false)
  }

  const next = () => {
    setRevealed(false)
    setIndex((i) => (cards.length > 0 ? (i + 1) % cards.length : 0))
  }

  const changeMode = (m: FrontMode) => {
    setMode(m)
    setRevealed(false)
  }

  const backToSelect = () => {
    setStep('select')
    setCards([])
    setIndex(0)
    setRevealed(false)
    setError(null)
  }

  // ---- 選択（3エリア） ----
  if (step === 'select') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <div>
          <Breadcrumb items={[{ href: '/study', label: 'スタディ' }, { label: 'プラクティス' }]} />
          <h1 className="text-2xl font-semibold">プラクティス</h1>
          <p className="mt-2 text-muted-foreground">カードを見返しながら、低負担で練習します。</p>
        </div>

        <StudyArea title="① 練習する対象" description="練習するカードの範囲を選びます。">
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

            {/* 開始 */}
            <div>
              {error && (
                <p className="mb-3 flex items-center gap-1.5 text-sm text-destructive">
                  <AlertTriangle size={15} /> {error}
                </p>
              )}
              <Button onClick={start} disabled={!target || loading} className="flex items-center gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? '準備中…' : target ? `「${label}」で練習を始める` : '対象を選んでください'}
              </Button>
            </div>
          </div>
        </StudyArea>

        <StudyArea title="③ 記録・分析・応用">
          <StudyStatsArea mode="practice" />
        </StudyArea>
      </div>
    )
  }

  const card = cards[index]

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <Button variant="ghost" className="text-sm px-0 mb-4" onClick={backToSelect}>← 対象を変える</Button>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold truncate">{label}</h1>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {index + 1} / {cards.length}
        </span>
      </div>

      {/* 表示モード切替 */}
      <div className="mt-4 inline-flex rounded-lg border border-border p-0.5 text-sm">
        <button
          type="button"
          onClick={() => changeMode('image')}
          aria-pressed={mode === 'image'}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition"
          style={mode === 'image' ? { backgroundColor: 'rgba(198,167,94,0.12)', color: 'var(--palace)' } : undefined}
        >
          <ImageIcon size={15} /> 画像から
        </button>
        <button
          type="button"
          onClick={() => changeMode('word')}
          aria-pressed={mode === 'word'}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition"
          style={mode === 'word' ? { backgroundColor: 'rgba(198,167,94,0.12)', color: 'var(--palace)' } : undefined}
        >
          <Type size={15} /> 単語から
        </button>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {mode === 'image' ? '画像を見て単語を思い出し、タップで答え合わせ。' : '単語から画像を思い出し、タップで答え合わせ。'}
      </p>

      {/* フラッシュカード（タップで裏返す） */}
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="mt-4 block w-full overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:shadow-md"
        aria-label={revealed ? '表に戻す' : '答えを表示'}
      >
        {mode === 'image' ? (
          <>
            <div className="aspect-square w-full bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.image} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="px-5 py-4">
              {revealed ? (
                <>
                  <p className="text-xl font-bold">{card.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{card.meaning ?? '（意味は未登録）'}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">タップして答えを表示</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex min-h-40 items-center justify-center px-6 py-8">
              <p className="text-center text-2xl font-bold">{card.title}</p>
            </div>
            {revealed && (
              <>
                <div className="aspect-square w-full bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.image} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="px-5 py-4">
                  <p className="text-sm leading-6 text-muted-foreground">{card.meaning ?? '（意味は未登録）'}</p>
                </div>
              </>
            )}
            {!revealed && <div className="px-5 pb-4 text-sm text-muted-foreground">タップして画像を表示</div>}
          </>
        )}
      </button>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={next} className="flex flex-1 items-center justify-center gap-2">
          次へ
          <ArrowRight size={16} />
        </Button>
        <Button variant="outline" onClick={reshuffle} className="flex items-center gap-2" aria-label="シャッフル">
          <Shuffle size={16} />
          シャッフル
        </Button>
      </div>
    </div>
  )
}
