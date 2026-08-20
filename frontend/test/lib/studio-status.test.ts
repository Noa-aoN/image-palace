import { describe, it, expect } from 'vitest'
import {
  actionsFor,
  canPreview,
  deliveryNoteFor,
  STATUS_LABEL,
  STATUS_TONE,
  validateKey,
} from '@/lib/studio/status'
import type { PackageStatus } from '@/lib/api/studio'

const ALL: PackageStatus[] = ['draft', 'published', 'suspended', 'archived']

// 荷物の扱いは4つ。**止めるのと終えるのを分けてある。**
//
// 誤って出したときに「削除」で応えると、何を出していたのかが分からなくなる。
// 止めるのは戻せる。終えるのは戻せない。
describe('荷物の扱い', () => {
  it('4つとも言い方がある', () => {
    for (const status of ALL) {
      expect(STATUS_LABEL[status]).toBeTruthy()
      expect(STATUS_TONE[status]).toBeTruthy()
    }
  })

  // **扱いと届け先は別のこと。**
  // 出していても届け先がゼロなら、誰にも届かない
  describe('次にできること', () => {
    it('下書きは、外へ出せる', () => {
      expect(actionsFor('draft').map((a) => a.action)).toEqual(['publish'])
    })

    // **誤って出したときは、削除ではなく止める**
    it('出しているものは、止めるか終えるか', () => {
      expect(actionsFor('published').map((a) => a.action)).toEqual(['suspend', 'archive'])
    })

    it('止めているものは、戻せる', () => {
      expect(actionsFor('suspended').map((a) => a.action)).toContain('resume')
    })

    it('終えたものは、もう何もできない', () => {
      expect(actionsFor('archived')).toEqual([])
    })

    // **戻せない操作だけ、押す前に確かめる**
    it('終えるときだけ確認を挟む', () => {
      for (const status of ALL) {
        for (const spec of actionsFor(status)) {
          if (spec.action === 'archive') expect(spec.confirm).toBeTruthy()
          else expect(spec.confirm).toBeUndefined()
        }
      }
    })
  })

  describe('下見', () => {
    it('終えたもの以外は見られる', () => {
      expect(canPreview('draft')).toBe(true)
      expect(canPreview('published')).toBe(true)
      expect(canPreview('suspended')).toBe(true)
    })

    it('終えたものは見ない（見ても出せない）', () => {
      expect(canPreview('archived')).toBe(false)
    })
  })
})

// **サーバー側と同じ決まり。** 片方だけ緩めると、送ってから断られる
describe('鍵の形', () => {
  it('英小文字ではじまり、英小文字・数字・_ で3〜50字', () => {
    expect(validateKey('starter_it')).toBeNull()
    expect(validateKey('demo_showcase')).toBeNull()
    expect(validateKey('abc')).toBeNull()
  })

  it('扱いにくい字は断る', () => {
    expect(validateKey('ST')).toBeTruthy()
    expect(validateKey('Starter')).toBeTruthy()
    expect(validateKey('starter it')).toBeTruthy()
    expect(validateKey('ことば')).toBeTruthy()
    expect(validateKey('ab')).toBeTruthy()
    expect(validateKey('1starter')).toBeTruthy()
    expect(validateKey('a'.repeat(51))).toBeTruthy()
  })

  it('空なら促す', () => {
    expect(validateKey('')).toBe('鍵を入れてください')
  })
})

// **扱いだけを見て「配っていません」と言わない。**
//
// 新しい下書きを起こしただけで「届きません」と出すと嘘になる。
// 実際にはひとつ前の版が届き続けている
describe('届け先に添える一言', () => {
  it('出している版がそのまま届いているときは、何も言わない', () => {
    expect(deliveryNoteFor({ version: 3, delivering_version: 3 })).toBeNull()
  })

  it('どの版も出していないときは、届かないと言う', () => {
    expect(deliveryNoteFor({ version: 2, delivering_version: null })).toContain('届きません')
  })

  it('下書きを起こした直後は、いま届く版を言う', () => {
    expect(deliveryNoteFor({ version: 4, delivering_version: 3 })).toContain('v3')
  })
})
