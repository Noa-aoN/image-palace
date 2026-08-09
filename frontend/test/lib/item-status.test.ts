import { describe, expect, it } from 'vitest'
import { isGenerating, isRegenerating } from '@/lib/item-status'
import { cardGridClass, CARD_GRID_CLASSES, DEFAULT_GRID_COLUMNS } from '@/lib/card-grid'

describe('isRegenerating', () => {
  // 作り直しは古い画像を消さずに新しい生成を始める。画像が残っているのに生成中なら
  // 「作り直し中」で、押したのに何も起きていないように見えてはいけない
  it('画像が残ったまま生成中なら作り直し中', () => {
    expect(isRegenerating('pending', true)).toBe(true)
    expect(isRegenerating('processing', true)).toBe(true)
  })

  // 初回生成は画像そのものが無い。こちらは別の見せ方（GeneratingOverlay）をする
  it('画像が無ければ作り直しではない', () => {
    expect(isRegenerating('pending', false)).toBe(false)
    expect(isRegenerating('processing', false)).toBe(false)
  })

  it('生成が終わっていれば作り直しではない', () => {
    expect(isRegenerating('completed', true)).toBe(false)
    expect(isRegenerating('failed', true)).toBe(false)
  })

  it('生成中の判定は従来どおり', () => {
    expect(isGenerating('pending')).toBe(true)
    expect(isGenerating('completed')).toBe(false)
  })
})

describe('cardGridClass', () => {
  // 読み込み中のスケルトンと読み込み後の一覧が同じ表を引くことが要点。
  // 別々に持つと、読み込みが終わった瞬間に列数が変わって画面が飛ぶ
  it('選べる列数すべてに対応表がある', () => {
    for (let columns = 2; columns <= 10; columns++) {
      expect(CARD_GRID_CLASSES[columns], `${columns} 列`).toBeTruthy()
      expect(cardGridClass(columns)).toBe(CARD_GRID_CLASSES[columns])
    }
  })

  it('未指定や範囲外でも既定に落ちて崩れない', () => {
    expect(cardGridClass()).toBe(CARD_GRID_CLASSES[DEFAULT_GRID_COLUMNS])
    expect(cardGridClass(999)).toBe(CARD_GRID_CLASSES[DEFAULT_GRID_COLUMNS])
  })
})
