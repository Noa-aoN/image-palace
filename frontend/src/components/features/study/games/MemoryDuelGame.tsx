'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertTriangle, Swords, Heart, Check, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStudyRecordStore } from '@/stores/studyRecords'
import { targetLabel, type QuizTarget } from '@/lib/quiz'
import { shuffle } from '@/lib/shuffle'
import {
  loadDuelMonsters,
  recallChoices,
  resolveClash,
  typeMultiplier,
  TYPE_META,
  DUEL_MIN_CARDS,
  type Monster,
  type ClashResult,
} from '@/lib/duel'

const START_LIFE = 20
type Phase = 'battle' | 'recall' | 'clash' | 'result'

function TypeBadge({ m }: { m: Monster }) {
  const t = TYPE_META[m.type]
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: t.color }}>
      {t.emoji} {t.label}
    </span>
  )
}

function LifeBar({ label, life, side }: { label: string; life: number; side: 'player' | 'cpu' }) {
  const pct = Math.max(0, Math.min(100, (life / START_LIFE) * 100))
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="flex items-center gap-1 font-semibold tabular-nums">
          <Heart size={12} className={side === 'player' ? 'text-green-600' : 'text-destructive'} /> {life}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: side === 'player' ? '#16a34a' : '#dc2626' }}
        />
      </div>
    </div>
  )
}

// 場のモンスター表示。faceWord=false なら単語を伏せる（プレイヤーは想起で当てる）。
function MonsterCard({ m, faceWord, hint }: { m: Monster; faceWord: boolean; hint?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-square w-full bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.image} alt="" className="h-full w-full object-cover" />
        <span className="absolute left-1.5 top-1.5">
          <TypeBadge m={m} />
        </span>
        <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white">
          <Swords size={11} /> {m.atk}
        </span>
        {hint && <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">{hint}</span>}
      </div>
      <p className="truncate px-2 py-1 text-center text-xs font-medium">{faceWord ? m.title : '？？？'}</p>
    </div>
  )
}

export function MemoryDuelGame({ target, onExit }: { target: QuizTarget; onExit: () => void }) {
  const [cards, setCards] = useState<Monster[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>('battle')
  const [deck, setDeck] = useState<Monster[]>([])
  const [hand, setHand] = useState<Monster[]>([])
  const [cpu, setCpu] = useState<Monster | null>(null)
  const [chosen, setChosen] = useState<Monster | null>(null)
  const [choices, setChoices] = useState<Monster[]>([])
  const [recallPicked, setRecallPicked] = useState<string | null>(null)
  const [recallMult, setRecallMult] = useState(1)
  const [clash, setClash] = useState<ClashResult | null>(null)
  const [playerLife, setPlayerLife] = useState(START_LIFE)
  const [cpuLife, setCpuLife] = useState(START_LIFE)
  const [winner, setWinner] = useState<'player' | 'cpu' | null>(null)

  const addRecord = useStudyRecordStore((s) => s.addRecord)
  const label = targetLabel(target)

  const pickCpu = (pool: Monster[]) => {
    const sample = shuffle(pool).slice(0, 3)
    return sample.reduce((best, m) => (m.atk > best.atk ? m : best), sample[0])
  }

  const startMatch = (pool: Monster[]) => {
    const d = shuffle(pool)
    setDeck(d.slice(3))
    setHand(d.slice(0, 3))
    setCpu(pickCpu(pool))
    setPlayerLife(START_LIFE)
    setCpuLife(START_LIFE)
    setWinner(null)
    setChosen(null)
    setRecallPicked(null)
    setRecallMult(1)
    setClash(null)
    setPhase('battle')
  }

  useEffect(() => {
    loadDuelMonsters(target)
      .then((ms) => {
        if (ms.length < DUEL_MIN_CARDS) {
          setError(`メモリーデュエルには画像付きカードが${DUEL_MIN_CARDS}枚以上必要です。`)
          setCards([])
          return
        }
        setCards(ms)
        startMatch(ms)
      })
      .catch(() => {
        setError('カードの読み込みに失敗しました。時間を置いて再度お試しください。')
        setCards([])
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chooseHand = (m: Monster) => {
    if (!cards) return
    setChosen(m)
    setChoices(recallChoices(m, cards))
    setRecallPicked(null)
    setRecallMult(1)
    setPhase('recall')
  }

  const answerRecall = (id: string) => {
    if (recallPicked || !chosen) return
    setRecallPicked(id)
    setRecallMult(id === chosen.id ? 2 : 1)
  }

  const toClash = () => {
    if (!chosen || !cpu) return
    const result = resolveClash(chosen, cpu, recallMult)
    if (result.winner === 'player') setCpuLife((l) => Math.max(0, l - result.damage))
    else if (result.winner === 'cpu') setPlayerLife((l) => Math.max(0, l - result.damage))
    else {
      setPlayerLife((l) => Math.max(0, l - 1))
      setCpuLife((l) => Math.max(0, l - 1))
    }
    setClash(result)
    setPhase('clash')
  }

  const proceed = () => {
    if (cpuLife <= 0 || playerLife <= 0) {
      const w = cpuLife <= 0 && playerLife > 0 ? 'player' : 'cpu'
      setWinner(w)
      addRecord({ mode: 'game', game: 'duel', targetLabel: label, total: 1, correct: w === 'player' ? 1 : 0, score: w === 'player' ? playerLife : 0 })
      setPhase('result')
      return
    }
    // 次のラウンド
    let d = [...deck]
    const newHand = hand.filter((c) => c.id !== chosen!.id)
    while (newHand.length < 3) {
      if (d.length === 0) d = shuffle(cards!)
      newHand.push(d.shift()!)
    }
    setDeck(d)
    setHand(newHand)
    setCpu(pickCpu(cards!))
    setChosen(null)
    setRecallPicked(null)
    setRecallMult(1)
    setClash(null)
    setPhase('battle')
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

  if (phase === 'result') {
    const win = winner === 'player'
    return (
      <div className="text-center">
        <div className="dz-pop">
          <p className="text-5xl">{win ? '🏆' : '💧'}</p>
          <h2 className="mt-2 text-2xl font-semibold">{win ? '勝利！' : '敗北…'}</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">残ライフ {Math.max(0, playerLife)} / {START_LIFE}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => startMatch(cards)}>もう一度</Button>
          <Button variant="outline" onClick={onExit}>対象・ゲームを変える</Button>
        </div>
        <DuelStyles />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold truncate">{label}</h2>
        <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--palace)' }}>
          <Swords size={15} /> メモリーデュエル
        </span>
      </div>

      {/* ライフ */}
      <div className="mt-4 flex items-end gap-4">
        <LifeBar label="あなた" life={playerLife} side="player" />
        <span className="pb-1 text-xs font-bold text-muted-foreground">VS</span>
        <LifeBar label="CPU" life={cpuLife} side="cpu" />
      </div>

      {/* 相手の場 */}
      {cpu && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">相手のモンスター</p>
          <div className={`mx-auto w-40 ${phase === 'clash' && clash?.winner === 'player' ? 'dz-shake' : phase === 'clash' && clash?.winner === 'cpu' ? 'dz-pop' : ''}`}>
            <MonsterCard m={cpu} faceWord />
          </div>
        </div>
      )}

      {/* バトル：手札から相性を選ぶ */}
      {phase === 'battle' && cpu && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">手札（相性を考えて1枚選ぶ）</p>
          <div className="grid grid-cols-3 gap-2">
            {hand.map((m) => {
              const mult = typeMultiplier(m.type, cpu.type)
              const hint = mult > 1 ? '有利' : mult < 1 ? '不利' : '互角'
              return (
                <button key={m.id} type="button" onClick={() => chooseHand(m)} className="text-left transition hover:-translate-y-0.5">
                  <MonsterCard m={m} faceWord={false} hint={hint} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 想起チャレンジ */}
      {phase === 'recall' && chosen && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles size={15} style={{ color: 'var(--palace)' }} /> 想起チャレンジ — このカードの単語は？
          </p>
          <div className="mx-auto mb-3 w-32">
            <MonsterCard m={chosen} faceWord={recallPicked !== null} />
          </div>
          <div className="space-y-2">
            {choices.map((c) => {
              const picked = recallPicked === c.id
              const isAnswer = c.id === chosen.id
              const show = recallPicked !== null
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => answerRecall(c.id)}
                  disabled={recallPicked !== null}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-left text-sm font-medium transition enabled:hover:border-[var(--palace)] disabled:cursor-default"
                  style={show && isAnswer ? { borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)' } : show && picked ? { borderColor: 'var(--destructive)', backgroundColor: 'rgba(220,38,38,0.06)' } : undefined}
                >
                  {c.title}
                  {show && isAnswer && <Check size={16} className="text-green-600" />}
                  {show && picked && !isAnswer && <X size={16} className="text-destructive" />}
                </button>
              )
            })}
          </div>
          {recallPicked !== null && (
            <div className="mt-3">
              {recallMult > 1 ? (
                <p className="dz-pop mb-2 text-center text-sm font-bold" style={{ color: 'var(--palace)' }}>✨ 覚醒！ATK ×2 必殺！</p>
              ) : (
                <p className="mb-2 text-center text-sm text-muted-foreground">通常威力でバトルします。</p>
              )}
              <Button onClick={toClash} className="w-full">バトル！</Button>
            </div>
          )}
        </div>
      )}

      {/* クラッシュ結果 */}
      {phase === 'clash' && clash && chosen && cpu && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="w-28">
              <MonsterCard m={chosen} faceWord />
              <p className="mt-1 text-xs">威力 <span className="font-bold">{clash.playerEff}</span></p>
            </div>
            <Swords size={22} className="text-muted-foreground" />
            <div className="w-28">
              <MonsterCard m={cpu} faceWord />
              <p className="mt-1 text-xs">威力 <span className="font-bold">{clash.cpuEff}</span></p>
            </div>
          </div>
          <p className="dz-pop mt-3 text-base font-bold">
            {clash.winner === 'player' ? `勝ち！ CPU に ${clash.damage} ダメージ` : clash.winner === 'cpu' ? `負け… ${clash.damage} ダメージを受けた` : '引き分け（相打ち）'}
          </p>
          <Button onClick={proceed} className="mt-4 w-full">
            {cpuLife <= 0 || playerLife <= 0 ? '結果へ' : '次のラウンドへ'}
          </Button>
        </div>
      )}

      <Button variant="ghost" className="mt-6" onClick={onExit}>← 対象・ゲームを変える</Button>
      <DuelStyles />
    </div>
  )
}

function DuelStyles() {
  return (
    <style>{`
      @keyframes dz-shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
      @keyframes dz-pop { 0%{transform:scale(.7);opacity:0} 60%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }
      .dz-shake { animation: dz-shake .4s ease-in-out; }
      .dz-pop { animation: dz-pop .45s ease-out; }
    `}</style>
  )
}
