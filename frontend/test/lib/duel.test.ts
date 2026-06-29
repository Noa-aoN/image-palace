import { describe, it, expect } from 'vitest'
import {
  DUEL_TYPES,
  typeMultiplier,
  toMonster,
  cpuPick,
  recallChoices,
  resolveClash,
  type Monster,
} from '@/lib/duel'
import type { QuizCard } from '@/lib/quiz'

const card = (id: string, title = id): QuizCard => ({ id, title, image: `img-${id}` })

describe('typeMultiplier（5すくみ）', () => {
  it('同属性は等倍', () => {
    for (const t of DUEL_TYPES) expect(typeMultiplier(t, t)).toBe(1)
  })

  it('隣（i→i+1）は相性勝ちで 1.5 倍', () => {
    for (let i = 0; i < DUEL_TYPES.length; i++) {
      const a = DUEL_TYPES[i]
      const b = DUEL_TYPES[(i + 1) % DUEL_TYPES.length]
      expect(typeMultiplier(a, b)).toBe(1.5)
    }
  })

  it('逆向き（相性負け）は 0.67 倍', () => {
    for (let i = 0; i < DUEL_TYPES.length; i++) {
      const a = DUEL_TYPES[i]
      const b = DUEL_TYPES[(i + 1) % DUEL_TYPES.length]
      expect(typeMultiplier(b, a)).toBe(0.67)
    }
  })

  it('勝ちと負けは対称（fire→grass=1.5, grass→fire=0.67）', () => {
    expect(typeMultiplier('fire', 'grass')).toBe(1.5)
    expect(typeMultiplier('grass', 'fire')).toBe(0.67)
  })
})

describe('toMonster', () => {
  it('同じカード・タグなら決定的に同じ属性・ATK', () => {
    const c = card('x1', 'apple')
    const m1 = toMonster(c, ['fruit'])
    const m2 = toMonster(c, ['fruit'])
    expect(m1.type).toBe(m2.type)
    expect(m1.atk).toBe(m2.atk)
  })

  it('ATK は 3〜9 の範囲に収まる', () => {
    for (let i = 0; i < 50; i++) {
      const m = toMonster(card(`id-${i}`, `t${i}`), i % 2 ? ['a', 'b'] : [])
      expect(m.atk).toBeGreaterThanOrEqual(3)
      expect(m.atk).toBeLessThanOrEqual(9)
    }
  })

  it('type は DUEL_TYPES のいずれか、元カードの情報を保持', () => {
    const m = toMonster(card('z9', 'zebra'), [])
    expect(DUEL_TYPES).toContain(m.type)
    expect(m.id).toBe('z9')
    expect(m.title).toBe('zebra')
  })
})

describe('cpuPick', () => {
  it('手札から最大 ATK のモンスターを選ぶ', () => {
    const hand: Monster[] = [
      { ...card('a'), type: 'fire', atk: 4 },
      { ...card('b'), type: 'water', atk: 8 },
      { ...card('c'), type: 'wind', atk: 6 },
    ]
    expect(cpuPick(hand).id).toBe('b')
  })
})

describe('recallChoices', () => {
  it('正解を含み、指定数の選択肢を返す', () => {
    const pool: Monster[] = Array.from({ length: 6 }, (_, i) => ({ ...card(`m${i}`), type: 'fire', atk: 5 }))
    const choices = recallChoices(pool[0], pool, 4)
    expect(choices).toHaveLength(4)
    expect(choices.some((c) => c.id === pool[0].id)).toBe(true)
  })
})

describe('resolveClash', () => {
  const fire: Monster = { ...card('f'), type: 'fire', atk: 5 }
  const grass: Monster = { ...card('g'), type: 'grass', atk: 5 }

  it('属性勝ち＋想起成功（×2）で勝てる', () => {
    const r = resolveClash(fire, grass, 2) // fire→grass は 1.5、recall 2
    expect(r.winner).toBe('player')
    expect(r.damage).toBeGreaterThanOrEqual(1)
  })

  it('想起失敗（×1）でも属性勝ちなら有利', () => {
    const r = resolveClash(fire, grass, 1)
    expect(r.playerEff).toBeGreaterThan(r.cpuEff)
    expect(r.winner).toBe('player')
  })

  it('同属性・同ATK・想起失敗は引き分け（ダメージ1）', () => {
    const a: Monster = { ...card('a'), type: 'water', atk: 5 }
    const b: Monster = { ...card('b'), type: 'water', atk: 5 }
    const r = resolveClash(a, b, 1)
    expect(r.winner).toBe('draw')
    expect(r.damage).toBe(1)
  })
})
