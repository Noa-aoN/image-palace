import { describe, it, expect } from 'vitest'
import { shouldShowSkeleton } from '@/lib/items/list-loading'

// 1枚作っただけで一覧ぜんぶが骨組みに戻り、出来ているカードまで消えて見えた。
// **裏での取り直しでは、並んでいるものを消さない。**
describe('一覧を骨組みに戻すか', () => {
  it('頁・絞り込み・並び順を変えたときは戻す（中身が入れ替わるため）', () => {
    expect(shouldShowSkeleton({ background: false, hasItems: true })).toBe(true)
  })

  it('生成中を追いかける取り直しでは戻さない', () => {
    expect(shouldShowSkeleton({ background: true, hasItems: true })).toBe(false)
  })

  it('まだ何も出ていなければ、裏の取り直しでも骨組みでよい', () => {
    expect(shouldShowSkeleton({ background: true, hasItems: false })).toBe(true)
  })

  it('初回の読み込みは必ず骨組み', () => {
    expect(shouldShowSkeleton({ background: false, hasItems: false })).toBe(true)
  })
})
