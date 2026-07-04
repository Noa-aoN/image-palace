import { describe, it, expect } from 'vitest'
import { targetKey, targetLabel, buildQuestions, MIN_CARDS, type QuizCard } from '@/lib/quiz'

const card = (id: string): QuizCard => ({ id, title: id, image: `img-${id}` })
const cards = (n: number) => Array.from({ length: n }, (_, i) => card(`c${i}`))

describe('targetKey', () => {
  it('all は "all"', () => {
    expect(targetKey({ kind: 'all' })).toBe('all')
  })
  it('box/view は kind:id', () => {
    expect(targetKey({ kind: 'box', id: 'x', name: 'X' })).toBe('box:x')
    expect(targetKey({ kind: 'view', id: 'y', name: 'Y' })).toBe('view:y')
  })
})

describe('targetLabel', () => {
  it('all は固定ラベル、その他は name', () => {
    expect(targetLabel({ kind: 'all' })).toBe('すべてのカード')
    expect(targetLabel({ kind: 'box', id: 'x', name: 'マイ単語帳' })).toBe('マイ単語帳')
  })
})

describe('buildQuestions', () => {
  it('カードが MIN_CARDS 未満なら空配列', () => {
    expect(buildQuestions(cards(MIN_CARDS - 1))).toEqual([])
  })

  it('count と枚数の小さい方の数だけ設問を作る', () => {
    expect(buildQuestions(cards(10), 5)).toHaveLength(5)
    expect(buildQuestions(cards(4), 10)).toHaveLength(4)
  })

  it('各設問は4択で正解を含み、選択肢に重複がない', () => {
    const qs = buildQuestions(cards(8), 8)
    for (const q of qs) {
      expect(q.choices).toHaveLength(4)
      expect(q.choices.some((c) => c.id === q.card.id)).toBe(true)
      const ids = q.choices.map((c) => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
