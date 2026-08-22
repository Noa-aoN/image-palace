import { describe, it, expect } from 'vitest'
import {
  languageLabel,
  normalizeLanguage,
  otherReadings,
  primaryReading,
} from '@/lib/items/reading'

const rows = (...pairs: [string, string][]) =>
  pairs.map(([language, text]) => ({ language, text }))

// **値は動かさない。** 基本の言語を変えても、並び替えたり移したりはしない。
// 変わるのは「どれを主として出すか」だけ
describe('主に出す読み', () => {
  it('基本の言語に合うものを主にする', () => {
    const value = rows(['ja', 'かな'], ['en', 'dee-en-ess'])

    expect(primaryReading(value, 'en')?.text).toBe('dee-en-ess')
  })

  it('基本の言語を変えると、主も変わる', () => {
    const value = rows(['ja', 'かな'], ['en', 'en'])

    expect(primaryReading(value, 'ja')?.text).toBe('かな')
    expect(primaryReading(value, 'en')?.text).toBe('en')
  })

  // **書いた順の先頭に落とす。** 何も出ないより、1つ出ているほうがよい
  it('合うものが無ければ、書いた順の先頭', () => {
    expect(primaryReading(rows(['ja', 'かな'], ['en', 'en']), 'es')?.language).toBe('ja')
  })

  it('綴りが揃っていなくても合う', () => {
    expect(primaryReading(rows(['JA', 'かな']), 'ja')?.text).toBe('かな')
    expect(primaryReading(rows(['ja', 'かな']), ' JA ')?.text).toBe('かな')
  })

  it('何も無ければ null', () => {
    expect(primaryReading([], 'ja')).toBeNull()
    expect(primaryReading(null, 'ja')).toBeNull()
  })

  it('基本の言語が分からなくても、先頭を出す', () => {
    expect(primaryReading(rows(['ja', 'かな']), null)?.text).toBe('かな')
  })
})

// **主を2度出さない**
describe('主以外の読み', () => {
  it('主を除いたものを、書いた順で返す', () => {
    const value = rows(['ja', 'かな'], ['en', 'en'], ['es', 'es'])

    expect(otherReadings(value, 'en').map((r) => r.language)).toEqual(['ja', 'es'])
  })

  it('1つしか無ければ空', () => {
    expect(otherReadings(rows(['ja', 'かな']), 'ja')).toEqual([])
  })

  it('何も無ければ空', () => {
    expect(otherReadings(null, 'ja')).toEqual([])
  })
})

describe('言語の綴り', () => {
  it('小文字にして、使えない字を落とす', () => {
    expect(normalizeLanguage(' JA ')).toBe('ja')
    expect(normalizeLanguage('zh-Hant')).toBe('zh-hant')
    expect(normalizeLanguage('j@a!')).toBe('ja')
  })

  it('空でも落ちない', () => {
    expect(normalizeLanguage(null)).toBe('')
  })
})

describe('言語の呼び名', () => {
  it('知っている言語は日本語で出す', () => {
    expect(languageLabel('ja')).toBe('日本語')
    expect(languageLabel('grc')).toBe('古典ギリシア語')
  })

  // **知らない綴りは、そのまま出す。**
  // 学ぶ言語は人によって違い、「不明」と出すのは失礼にあたる
  it('知らない言語は、綴りをそのまま出す', () => {
    expect(languageLabel('xyz')).toBe('xyz')
  })
})
