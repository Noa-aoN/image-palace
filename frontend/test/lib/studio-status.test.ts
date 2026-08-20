import { describe, it, expect } from 'vitest'
import {
  actionsFor,
  canPreview,
  countByStatus,
  filterPackages,
  PACKAGE_FILTERS,
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

// 荷物が増えると一覧が長くなる。**大きな検索は要らない。**
// 扱いで分かれて、数が見えれば、どこを見ればよいか分かる
describe('荷物の絞り込み', () => {
  const packages = [
    { status: 'draft' as const },
    { status: 'published' as const },
    { status: 'published' as const },
    { status: 'suspended' as const },
  ]

  it('5つの栓がある（すべて＋4つの扱い）', () => {
    expect(PACKAGE_FILTERS.map((f) => f.value)).toEqual([
      'all',
      'draft',
      'published',
      'suspended',
      'archived',
    ])
  })

  it('言い方は一覧の印と同じ', () => {
    const published = PACKAGE_FILTERS.find((f) => f.value === 'published')
    expect(published?.label).toBe(STATUS_LABEL.published)
  })

  it('はじめは全部見せる', () => {
    expect(filterPackages(packages, 'all')).toHaveLength(4)
  })

  it('扱いで絞れる', () => {
    expect(filterPackages(packages, 'published')).toHaveLength(2)
  })

  it('無いものは空になる', () => {
    expect(filterPackages(packages, 'archived')).toEqual([])
  })

  it('件数を数える', () => {
    expect(countByStatus(packages)).toEqual({
      draft: 1,
      published: 2,
      suspended: 1,
      archived: 0,
    })
  })
})
