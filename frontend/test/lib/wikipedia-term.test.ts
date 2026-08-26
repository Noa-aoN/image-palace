import { describe, it, expect } from 'vitest'
import { MAX_TERM_LENGTH, canLookup, resolveLookupTerm } from '@/lib/wikipedia-term'

// 見出し語は短い呼び名で置くことが多く（DNS・国連・東大）、
// そのままだと目的の記事に当たらないことがある
describe('Wikipedia を引く語', () => {
  it('書いてあれば、それで引く', () => {
    expect(resolveLookupTerm('Domain Name System', 'DNS')).toBe('Domain Name System')
  })

  // 消しただけで引けなくなる、を避ける
  it('空欄なら見出し語のまま', () => {
    expect(resolveLookupTerm('', 'DNS')).toBe('DNS')
    expect(resolveLookupTerm('   ', 'DNS')).toBe('DNS')
  })

  it('前後の空白は落とす', () => {
    expect(resolveLookupTerm('  アポロ計画 ', 'アポロ')).toBe('アポロ計画')
  })

  describe('引けるか', () => {
    it('書いてあれば引ける', () => {
      expect(canLookup('アポロ計画', 'アポロ')).toBe(true)
    })

    it('空欄でも、見出し語があれば引ける', () => {
      expect(canLookup('', 'アポロ')).toBe(true)
    })

    it('どちらも空なら引けない', () => {
      expect(canLookup('', '')).toBe(false)
      expect(canLookup('  ', '   ')).toBe(false)
    })

    it('長すぎるものは断る', () => {
      expect(canLookup('あ'.repeat(MAX_TERM_LENGTH), 'x')).toBe(true)
      expect(canLookup('あ'.repeat(MAX_TERM_LENGTH + 1), 'x')).toBe(false)
    })
  })
})
