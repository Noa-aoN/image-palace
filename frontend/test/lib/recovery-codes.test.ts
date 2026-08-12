import { describe, it, expect } from 'vitest'
import {
  formatRecoveryCodes,
  recoveryCodesFilename,
  recoveryCodesRunningLow,
} from '@/lib/recovery-codes'

const codes = ['aaa111bbb2', 'ccc333ddd4', 'eee555fff6']
const now = new Date(2026, 7, 12) // 2026-08-12

describe('復旧コードの控え', () => {
  it('コードを1行に1つ並べる（貼り付けても崩れない）', () => {
    const lines = formatRecoveryCodes(codes, now).split('\n')

    for (const code of codes) expect(lines).toContain(code)
  })

  it('1つのコードは一度しか使えないことを添える', () => {
    expect(formatRecoveryCodes(codes, now)).toContain('一度しか使えません')
  })

  // 後から見て「いつ発行したものか」が分からないと、古い控えと区別が付かない
  it('発行日を入れる', () => {
    expect(formatRecoveryCodes(codes, now)).toContain('2026-08-12')
  })

  it('コードを1つも落とさない', () => {
    const text = formatRecoveryCodes(codes, now)

    expect(codes.every((c) => text.includes(c))).toBe(true)
  })

  it('ファイル名に日付を入れる', () => {
    expect(recoveryCodesFilename(now)).toBe('imagepalace-recovery-codes-20260812.txt')
  })
})

describe('残りが少ないか', () => {
  // 1本になってから言われても、作り直す手間は同じで余裕だけが無い
  it('半分を切ったら伝える', () => {
    expect(recoveryCodesRunningLow(5)).toBe(true)
    expect(recoveryCodesRunningLow(1)).toBe(true)
  })

  it('半分より多ければ伝えない', () => {
    expect(recoveryCodesRunningLow(6)).toBe(false)
    expect(recoveryCodesRunningLow(10)).toBe(false)
  })

  // 0本は「少ない」ではなく「無い」。別の伝え方をする
  it('0本のときは対象外', () => {
    expect(recoveryCodesRunningLow(0)).toBe(false)
  })
})
