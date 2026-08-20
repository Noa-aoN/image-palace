import { describe, it, expect, beforeEach } from 'vitest'
import {
  endedPreviewIds,
  forgetEndedPreviews,
  rememberEnded,
  wasEndedPreview,
} from '@/lib/studio/previewTombstone'

// 下見を終えるとカードごと消えるので、開いていたタブを再読み込みすると
// ただの「見つかりません」になる。**意図して終えたことが伝わらない。**
//
// 消えたものを呼び戻しはしない（それでは終えたことにならない）。
// 終わったと分かる形で言えるように、行き先だけ覚えておく
describe('終えた下見の行き先', () => {
  beforeEach(() => forgetEndedPreviews())

  it('はじめは何も覚えていない', () => {
    expect(endedPreviewIds()).toEqual([])
    expect(wasEndedPreview('b1')).toBe(false)
  })

  it('箱もキャンバスも覚える', () => {
    rememberEnded({ boxId: 'b1', viewId: 'v1' })

    expect(wasEndedPreview('b1')).toBe(true)
    expect(wasEndedPreview('v1')).toBe(true)
  })

  it('片方しか無くても覚える', () => {
    rememberEnded({ boxId: 'b1', viewId: null })

    expect(wasEndedPreview('b1')).toBe(true)
  })

  it('どちらも無ければ、何も覚えない', () => {
    rememberEnded({ boxId: null, viewId: null })

    expect(endedPreviewIds()).toEqual([])
  })

  it('覚えていない id には反応しない', () => {
    rememberEnded({ boxId: 'b1', viewId: null })

    expect(wasEndedPreview('b2')).toBe(false)
  })

  it('空の id には反応しない', () => {
    expect(wasEndedPreview('')).toBe(false)
    expect(wasEndedPreview(null)).toBe(false)
    expect(wasEndedPreview(undefined)).toBe(false)
  })

  it('同じものを2回終えても、二重に持たない', () => {
    rememberEnded({ boxId: 'b1', viewId: null })
    rememberEnded({ boxId: 'b1', viewId: null })

    expect(endedPreviewIds()).toEqual(['b1'])
  })

  // **際限なく貯めない。** 古いものから捨てる
  it('覚える数に上限がある', () => {
    for (let i = 0; i < 30; i += 1) rememberEnded({ boxId: `b${i}`, viewId: null })

    expect(endedPreviewIds()).toHaveLength(20)
    expect(wasEndedPreview('b29')).toBe(true)
    expect(wasEndedPreview('b0')).toBe(false)
  })

  // 壊れた値が入っていても落ちない（別のタブや古い版が書いた可能性がある）
  it('壊れた値が入っていても落ちない', () => {
    window.localStorage.setItem('studio.preview.ended', 'not json')

    expect(endedPreviewIds()).toEqual([])
    expect(wasEndedPreview('b1')).toBe(false)
  })

  it('数字が混じっていても落ちない', () => {
    window.localStorage.setItem('studio.preview.ended', '[1, "b1", null]')

    expect(endedPreviewIds()).toEqual(['b1'])
  })
})
