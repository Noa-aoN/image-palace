import { describe, expect, it } from 'vitest'
import {
  ONBOARDING_STEPS,
  ONBOARDING_STEP_COUNT,
  clampIndex,
  draftToPayloads,
  isLastStep,
  progressLabel,
  progressRatio,
  stepAt,
  EMPTY_DRAFT,
} from '@/lib/onboarding/steps'

describe('ステップの並び', () => {
  it('5枚を超えない', () => {
    expect(ONBOARDING_STEP_COUNT).toBeLessThanOrEqual(5)
  })

  // 読むだけのステップに「スキップ」を出すと、読まずに進む導線を増やすだけになる
  it('飛ばせるのは入力を求めるステップだけ', () => {
    const skippable = ONBOARDING_STEPS.filter((s) => s.skippable).map((s) => s.key)
    expect(skippable).toEqual(['profile', 'palace', 'settings'])
  })

  it('鍵が重複していない', () => {
    expect(new Set(ONBOARDING_STEPS.map((s) => s.key)).size).toBe(ONBOARDING_STEP_COUNT)
  })
})

describe('行き来', () => {
  it('端の外へは出ない', () => {
    expect(clampIndex(-3)).toBe(0)
    expect(clampIndex(99)).toBe(ONBOARDING_STEP_COUNT - 1)
  })

  it('範囲の外を渡されても落ちない', () => {
    expect(stepAt(0)?.key).toBe('welcome')
    expect(stepAt(99)).toBeNull()
    expect(stepAt(-1)).toBeNull()
  })

  it('最後の1枚だけが最後', () => {
    expect(isLastStep(ONBOARDING_STEP_COUNT - 1)).toBe(true)
    expect(isLastStep(0)).toBe(false)
  })
})

describe('進捗', () => {
  it('1枚目から数える', () => {
    expect(progressLabel(0)).toBe(`1 / ${ONBOARDING_STEP_COUNT}`)
  })

  // 0 だと、1枚目で「何も進んでいない」ように見える
  it('1枚目でも 0 にしない', () => {
    expect(progressRatio(0)).toBeGreaterThan(0)
    expect(progressRatio(ONBOARDING_STEP_COUNT - 1)).toBe(1)
  })
})

describe('保存する中身の割り振り', () => {
  it('名前を入れたら profile も送る', () => {
    const p = draftToPayloads({ ...EMPTY_DRAFT, name: ' のあ ' })
    expect(p.profile).toEqual({ name: 'のあ' })
  })

  // 飛ばした人の名前を空で上書きすると、OAuth が持ってきた名前が消える
  it('飛ばした（空欄）なら profile は送らない', () => {
    expect(draftToPayloads({ ...EMPTY_DRAFT, name: '   ' }).profile).toBeNull()
  })

  it('もとの名前と同じなら送らない', () => {
    const p = draftToPayloads({ ...EMPTY_DRAFT, name: 'のあ' }, { name: 'のあ' })
    expect(p.profile).toBeNull()
  })

  it('もとが空なら、入力した名前は送る', () => {
    const p = draftToPayloads({ ...EMPTY_DRAFT, name: 'のあ' }, { name: null })
    expect(p.profile).toEqual({ name: 'のあ' })
  })

  // 空文字のまま置くと「名前のない宮殿」として扱われる
  it('宮殿名の空欄は null にする', () => {
    expect(draftToPayloads({ ...EMPTY_DRAFT, palaceName: '  ' }).settings.palace_name).toBeNull()
  })

  it('宮殿名は前後の空白を落とす', () => {
    expect(draftToPayloads({ ...EMPTY_DRAFT, palaceName: ' 記憶の宮殿 ' }).settings.palace_name).toBe('記憶の宮殿')
  })

  it('最後まで来たら onboarded を立てる', () => {
    expect(draftToPayloads(EMPTY_DRAFT).settings.onboarded).toBe(true)
  })
})
