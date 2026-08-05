import { describe, it, expect } from 'vitest'
import {
  WORD_DIFFICULTIES,
  WORD_DIFFICULTY_LABELS,
  WORD_DIFFICULTY_DESCRIPTIONS,
  DEFAULT_WORD_DIFFICULTY,
  normalizeWordDifficulty,
} from '@/lib/word-difficulty'

describe('normalizeWordDifficulty', () => {
  it('知っている値はそのまま', () => {
    expect(normalizeWordDifficulty('expert')).toBe('expert')
    expect(normalizeWordDifficulty('easy')).toBe('easy')
  })

  it('知らない値は既定へ丸める（設定が古くても壊れない）', () => {
    expect(normalizeWordDifficulty('とても難しい')).toBe(DEFAULT_WORD_DIFFICULTY)
    expect(normalizeWordDifficulty(undefined)).toBe(DEFAULT_WORD_DIFFICULTY)
    expect(normalizeWordDifficulty(null)).toBe(DEFAULT_WORD_DIFFICULTY)
    expect(normalizeWordDifficulty('')).toBe(DEFAULT_WORD_DIFFICULTY)
  })
})

describe('難しさの定義', () => {
  it('4段階すべてに表示名と説明がある', () => {
    for (const level of WORD_DIFFICULTIES) {
      expect(WORD_DIFFICULTY_LABELS[level]).toBeTruthy()
      expect(WORD_DIFFICULTY_DESCRIPTIONS[level]).toBeTruthy()
    }
  })

  it('易しい順に並んでいる（選択肢の並びがそのまま段階になる）', () => {
    expect(WORD_DIFFICULTIES).toEqual(['easy', 'normal', 'hard', 'expert'])
  })

  it('既定は真ん中寄り（いきなり尖らせない）', () => {
    expect(DEFAULT_WORD_DIFFICULTY).toBe('normal')
  })
})
