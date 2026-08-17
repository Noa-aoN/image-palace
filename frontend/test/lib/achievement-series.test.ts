import { describe, expect, it } from 'vitest'
import { buildSeries, seriesName } from '@/lib/achievements/series'
import type { AchievementRow } from '@/lib/api/achievements'

const row = (over: Partial<AchievementRow> & { key: string; condition_target: number }): AchievementRow => ({
  name: `${over.condition_target}枚のカード`,
  description: `カードを${over.condition_target}枚作る`,
  category: '作成',
  condition_type: 'cards_created',
  progress: 0,
  completed_at: null,
  rewards: [],
  ...over,
})

describe('段のある実績を1本の道にまとめる', () => {
  const cards = [
    row({ key: 'first_card', condition_target: 1, progress: 7, completed_at: '2026-08-01T00:00:00Z' }),
    row({ key: 'ten_cards', condition_target: 10, progress: 7 }),
    row({ key: 'fifty_cards', condition_target: 50, progress: 7 }),
  ]

  it('同じものを数える実績が1本になる', () => {
    const series = buildSeries(cards)

    expect(series).toHaveLength(1)
    expect(series[0].steps).toHaveLength(3)
    expect(series[0].single).toBe(false)
  })

  it('段は目標の小さい順に並ぶ', () => {
    const series = buildSeries([cards[2], cards[0], cards[1]])

    expect(series[0].steps.map((s) => s.condition_target)).toEqual([1, 10, 50])
  })

  it('いまの数・達成した段・次の段が出る', () => {
    const [series] = buildSeries(cards)

    expect(series.progress).toBe(7)
    expect(series.doneCount).toBe(1)
    expect(series.next?.condition_target).toBe(10)
    expect(series.remaining).toBe(3)
  })

  it('全部達成していれば、次の段は無い', () => {
    const done = cards.map((c) => ({ ...c, completed_at: '2026-08-01T00:00:00Z', progress: 100 }))
    const [series] = buildSeries(done)

    expect(series.next).toBeNull()
    expect(series.remaining).toBeNull()
    expect(series.doneCount).toBe(3)
  })

  // 名前が似ているだけの別の道を、混ぜてはいけない
  it('数えるものが違えば、別の道になる', () => {
    const series = buildSeries([
      ...cards,
      row({ key: 'ten_reviews', condition_target: 10, condition_type: 'reviews_total', name: '10回の見返し' }),
    ])

    expect(series).toHaveLength(2)
    expect(series[1].steps).toHaveLength(1)
    expect(series[1].single).toBe(true)
  })

  // 目印を持たない実績（古い版のAPI）でも壊れない
  it('目印が無ければ、それ自身で1本になる', () => {
    const series = buildSeries([
      { ...cards[0], condition_type: undefined },
      { ...cards[1], condition_type: undefined },
    ])

    expect(series).toHaveLength(2)
    expect(series.every((s) => s.single)).toBe(true)
  })

  it('元の並びは崩さない', () => {
    const series = buildSeries([
      row({ key: 'r1', condition_target: 1, condition_type: 'reviews_total' }),
      ...cards,
    ])

    expect(series.map((s) => s.key)).toEqual(['reviews_total', 'cards_created'])
  })
})

describe('道の名前', () => {
  // 段の名前をそのまま使うと「10000枚のカード」が道の名前になる
  it('説明から数を落として作る', () => {
    expect(seriesName([row({ key: 'a', condition_target: 10 })])).toBe('カードを作る')
  })

  it('助数詞ごと落とす', () => {
    const streak = row({
      key: 's',
      condition_target: 7,
      description: '7日続ける',
      name: '7日continuous',
      condition_type: 'streak_days',
    })

    expect(seriesName([streak])).toBe('続ける')
  })

  // 落としきると何も残らないものは、段の名前に戻す
  it('落としきれないときは段の名前を使う', () => {
    const odd = row({ key: 'x', condition_target: 1, description: '100', name: 'はじめての一歩' })

    expect(seriesName([odd])).toBe('はじめての一歩')
  })
})
