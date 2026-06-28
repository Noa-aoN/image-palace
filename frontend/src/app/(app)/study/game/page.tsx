'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Flame, BarChart3, Check, Volume2, Copy, Compass, Crosshair, Swords, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TargetPicker } from '@/components/features/study/TargetPicker'
import { StudyArea } from '@/components/features/study/StudyArea'
import { Segmented } from '@/components/features/study/Segmented'
import { ComingSoon } from '@/components/features/myroom/ComingSoon'
import { StreakGame } from '@/components/features/study/games/StreakGame'
import { MemoryGame, type MemoryPairType } from '@/components/features/study/games/MemoryGame'
import { KarutaGame, type KarutaReadBy } from '@/components/features/study/games/KarutaGame'
import { MemoryDuelGame } from '@/components/features/study/games/MemoryDuelGame'
import { useStudyRecordStore } from '@/stores/studyRecords'
import { useStudyTargetStore } from '@/stores/studyTargets'
import { targetKey, targetLabel, type QuizTarget, type QuizFormat } from '@/lib/quiz'

// ゲームタイトル一覧。連続正解・神経衰弱は実装済み、他は準備中（タイトルは仮）。
type GameTitle = { key: string; icon: ReactNode; title: string; description: string; playable?: boolean }
const GAME_TITLES: GameTitle[] = [
  {
    key: 'streak',
    icon: <Flame size={18} />,
    title: '連続正解チャレンジ',
    description: '画像を見て正しい単語を選び、間違えるまで何問続けられるか挑戦します。',
    playable: true,
  },
  {
    key: 'memory',
    icon: <Copy size={18} />,
    title: '神経衰弱',
    description: '裏返したカードの「画像」と「単語」のペアを記憶しながらそろえます。',
    playable: true,
  },
  {
    key: 'karuta',
    icon: <Volume2 size={18} />,
    title: 'カルタ',
    description: '読み上げ（単語／説明を選べる）を聞いて、正しいカードをすばやく取ります。',
    playable: true,
  },
  {
    key: 'quest',
    icon: <Compass size={18} />,
    title: 'ワードクエスト（アドベンチャー）',
    description: 'カードの単語を手がかりに、ステージを進んでいく探索ゲーム。',
  },
  {
    key: 'shooter',
    icon: <Crosshair size={18} />,
    title: 'ワードシューター（シューティング）',
    description: '流れてくる選択肢から、正しい単語／画像を狙って撃ち抜きます。',
  },
  {
    key: 'duel',
    icon: <Swords size={18} />,
    title: 'メモリーデュエル（トレーディングカード）',
    description: 'カードをモンスター化し、属性相性＋想起でCPUと戦う頭脳戦カードバトル。',
    playable: true,
  },
]

const GAMES_WITH_OPTIONS = ['streak', 'memory', 'karuta']

const COUNT_OPTIONS: { value: number | 'auto'; label: string }[] = [
  { value: 4, label: '4' },
  { value: 6, label: '6' },
  { value: 8, label: '8' },
  { value: 'auto', label: 'おまかせ' },
]
const KARUTA_COUNT_OPTIONS: { value: number | 'auto'; label: string }[] = [
  { value: 6, label: '6' },
  { value: 8, label: '8' },
  { value: 12, label: '12' },
  { value: 'auto', label: 'おまかせ' },
]

// ゲーム別ハイスコアの指標（streak=連続正解は大きいほど良い／memory・karutaは小さいほど良い）
const HIGH_SCORE: Record<string, { label: string; better: 'max' | 'min'; suffix?: string }> = {
  streak: { label: '最高連続', better: 'max' },
  memory: { label: '最少手数', better: 'min', suffix: '手' },
  karuta: { label: '最少お手つき', better: 'min' },
  duel: { label: '最高残ライフ', better: 'max' },
}

export default function GamePage() {
  const [target, setTarget] = useState<QuizTarget | null>(null)
  const [selectedGame, setSelectedGame] = useState<string>('streak')
  const [optionsOpenKey, setOptionsOpenKey] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  // ゲーム固有オプション（既定値あり＝未操作でも開始できる）
  const [streakFormat, setStreakFormat] = useState<QuizFormat>('image_to_word')
  const [memoryPairType, setMemoryPairType] = useState<MemoryPairType>('image_word')
  const [memoryCount, setMemoryCount] = useState<number | 'auto'>('auto')
  const [karutaReadBy, setKarutaReadBy] = useState<KarutaReadBy>('word')
  const [karutaCount, setKarutaCount] = useState<number | 'auto'>('auto')

  const touchTarget = useStudyTargetStore((s) => s.touch)
  const records = useStudyRecordStore((s) => s.records)
  const games = records.filter((r) => r.mode === 'game')
  const playCount = games.length
  const bestStreak = games.filter((r) => r.game === 'streak').reduce((max, r) => Math.max(max, r.total), 0)
  const gameCount = (key: string) => games.filter((r) => r.game === key).length
  const bestScore = (key: string): number | null => {
    const cfg = HIGH_SCORE[key]
    const scores = games.filter((r) => r.game === key && typeof r.score === 'number').map((r) => r.score as number)
    if (!cfg || scores.length === 0) return null
    return cfg.better === 'max' ? Math.max(...scores) : Math.min(...scores)
  }
  // よくプレイする対象ランキング（上位5）
  const targetRanking = (() => {
    const counts = new Map<string, number>()
    for (const r of games) counts.set(r.targetLabel, (counts.get(r.targetLabel) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  })()

  const gameDef = GAME_TITLES.find((g) => g.key === selectedGame)
  const canStart = !!target && !!gameDef?.playable
  const label = target ? targetLabel(target) : ''

  const start = () => {
    if (!canStart || !target) return
    touchTarget(target)
    setStarted(true)
  }

  // 選択中ゲームの固有オプション（既定値あり）
  const renderOptions = (key: string) => {
    if (key === 'streak') {
      return (
        <Segmented<QuizFormat>
          label="出題形式"
          value={streakFormat}
          onChange={setStreakFormat}
          options={[
            { value: 'image_to_word', label: '画像→単語' },
            { value: 'word_to_image', label: '単語→画像' },
          ]}
        />
      )
    }
    if (key === 'memory') {
      return (
        <>
          <Segmented<MemoryPairType>
            label="ペアの種類"
            value={memoryPairType}
            onChange={setMemoryPairType}
            options={[
              { value: 'image_word', label: '画像と単語' },
              { value: 'image_image', label: '画像と画像' },
              { value: 'word_word', label: '単語と単語' },
            ]}
          />
          <Segmented<number | 'auto'>
            label="ペア数"
            value={memoryCount}
            onChange={setMemoryCount}
            options={COUNT_OPTIONS}
          />
        </>
      )
    }
    if (key === 'karuta') {
      return (
        <>
          <Segmented<KarutaReadBy>
            label="読み上げ"
            value={karutaReadBy}
            onChange={setKarutaReadBy}
            options={[
              { value: 'word', label: '単語' },
              { value: 'meaning', label: '説明' },
            ]}
          />
          <Segmented<number | 'auto'>
            label="枚数"
            value={karutaCount}
            onChange={setKarutaCount}
            options={KARUTA_COUNT_OPTIONS}
          />
        </>
      )
    }
    return null
  }

  // ---- プレイ中：選択したゲーム本体を表示 ----
  if (started && target) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        {selectedGame === 'memory' ? (
          <MemoryGame target={target} pairType={memoryPairType} pairCount={memoryCount} onExit={() => setStarted(false)} />
        ) : selectedGame === 'karuta' ? (
          <KarutaGame target={target} readBy={karutaReadBy} cardCount={karutaCount} onExit={() => setStarted(false)} />
        ) : selectedGame === 'duel' ? (
          <MemoryDuelGame target={target} onExit={() => setStarted(false)} />
        ) : (
          <StreakGame target={target} format={streakFormat} onExit={() => setStarted(false)} />
        )}
      </div>
    )
  }

  // ---- 選択（3エリア） ----
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      <div>
        <Link href="/study">
          <Button variant="ghost" className="text-sm px-0 mb-4">← スタディへ戻る</Button>
        </Link>
        <h1 className="text-2xl font-semibold">プレイ</h1>
        <p className="mt-2 text-muted-foreground">楽しみながら反復できる学習モードです。対象とゲームを選んで始めましょう。</p>
      </div>

      <StudyArea title="① 対象を選ぶ" description="ゲームに使うカードの範囲を選びます。">
        <TargetPicker selectedKey={target ? targetKey(target) : undefined} onSelect={setTarget} />
      </StudyArea>

      <StudyArea title="② ゲームを選ぶ" description="あそべるゲームです。新しいゲームは順次追加予定です。">
        <div className="grid gap-2 sm:grid-cols-2">
          {GAME_TITLES.map((g) => {
            const active = g.key === selectedGame
            if (!g.playable) {
              return (
                <div key={g.key} className="rounded-xl border border-dashed border-border bg-card/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <span style={{ color: 'var(--palace)' }}>{g.icon}</span>
                      {g.title}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">準備中</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{g.description}</p>
                </div>
              )
            }
            const optionsOpen = optionsOpenKey === g.key
            return (
              // カード全体（オプション領域の余白を含む）クリックで選択。
              <div
                key={g.key}
                onClick={() => setSelectedGame(g.key)}
                className="cursor-pointer overflow-hidden rounded-xl border bg-card transition"
                style={{
                  borderColor: active ? 'var(--palace)' : 'var(--border)',
                  backgroundColor: active ? 'rgba(198,167,94,0.08)' : undefined,
                }}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span style={{ color: 'var(--palace)' }}>{g.icon}</span>
                      {g.title}
                    </span>
                    {active && <Check size={16} className="shrink-0 text-[var(--palace)]" />}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{g.description}</p>
                </div>

                {/* オプションは専用トグルでのみ開閉する（オプションのあるゲームのみ） */}
                {GAMES_WITH_OPTIONS.includes(g.key) && (
                  <div className="border-t border-border">
                    <button
                      type="button"
                      onClick={() => setOptionsOpenKey((cur) => (cur === g.key ? null : g.key))}
                      aria-expanded={optionsOpen}
                      className="flex w-full items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                    >
                      <SlidersHorizontal size={14} /> オプション
                      <ChevronDown size={14} className={`ml-auto transition-transform ${optionsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {optionsOpen && <div className="space-y-3 px-4 pb-4">{renderOptions(g.key)}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 開始ボタン（②の下） */}
        <Button onClick={start} disabled={!canStart} className="mt-5">
          {!target
            ? '対象を選んでください'
            : `「${label}」で${gameDef?.title ?? 'ゲーム'}を始める`}
        </Button>
      </StudyArea>

      <StudyArea title="③ 記録・分析・応用">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">プレイ回数</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{playCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Flame size={13} style={{ color: 'var(--palace)' }} /> ハイスコア（連続正解）
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{bestStreak}</p>
          </div>
        </div>

        {/* ゲーム別の実施回数・ハイスコア */}
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">ゲーム別の記録</p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {GAME_TITLES.filter((g) => g.playable).map((g) => {
              const cfg = HIGH_SCORE[g.key]
              const best = bestScore(g.key)
              return (
                <li key={g.key} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                  <span style={{ color: 'var(--palace)' }}>{g.icon}</span>
                  <span className="flex-1 truncate font-medium">{g.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">実施 {gameCount(g.key)}回</span>
                  <span className="shrink-0 tabular-nums">
                    <span className="text-xs text-muted-foreground">{cfg?.label ?? 'ハイスコア'} </span>
                    <span className="font-semibold">{best === null ? '—' : `${best}${cfg?.suffix ?? ''}`}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        {/* よくプレイする対象ランキング */}
        {targetRanking.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">よくプレイする対象（上位5）</p>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {targetRanking.map(([name, count], i) => (
                <li key={name} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{count}回</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href="/study/record"
          className="mt-3 inline-flex items-center gap-1.5 text-sm hover:underline"
          style={{ color: 'var(--palace)' }}
        >
          <BarChart3 size={15} /> レコード（詳しい履歴・統計）を見る
        </Link>
        <div className="mt-3">
          <ComingSoon description="タイムアタックやランキングなど、ゲームモードの拡張は順次対応予定です。" items={['タイムアタック', 'デイリーチャレンジ', 'ランキング']} />
        </div>
      </StudyArea>
    </div>
  )
}
