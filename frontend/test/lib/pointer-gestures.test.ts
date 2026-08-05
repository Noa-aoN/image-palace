import { describe, expect, it } from 'vitest'
import {
  DOUBLE_PRESS_MS,
  DRAG_THRESHOLD_PX,
  isDoublePress,
  movedEnough,
} from '@/lib/pointer-gestures'

describe('isDoublePress（続けて2回押したか）', () => {
  it('はじめての押下は続きではない', () => {
    expect(isDoublePress(null, 'a', 1000)).toBe(false)
  })

  it('同じ点を短い間隔で押したら続き＝設定を開く', () => {
    expect(isDoublePress({ id: 'a', at: 1000 }, 'a', 1000 + DOUBLE_PRESS_MS - 1)).toBe(true)
  })

  it('間隔が空いたら続きではない（置き直しで開かせない）', () => {
    expect(isDoublePress({ id: 'a', at: 1000 }, 'a', 1000 + DOUBLE_PRESS_MS)).toBe(false)
    expect(isDoublePress({ id: 'a', at: 1000 }, 'a', 1000 + DOUBLE_PRESS_MS + 500)).toBe(false)
  })

  // 隣の点を続けて押すのは「2つ選び直した」であって、開く操作ではない
  it('別の点なら、間隔が短くても続きではない', () => {
    expect(isDoublePress({ id: 'a', at: 1000 }, 'b', 1010)).toBe(false)
  })

  it('時刻が巻き戻っても続きとは扱わない', () => {
    expect(isDoublePress({ id: 'a', at: 1000 }, 'a', 900)).toBe(false)
  })
})

describe('movedEnough（掴んで動かしたか）', () => {
  // ここが false のときは座標を書き戻さない。押しただけで毎回保存が走るのを防ぐ
  it('まったく動いていなければ、動かしたことにしない', () => {
    expect(movedEnough(100, 100, 100, 100)).toBe(false)
  })

  it('手ぶれ程度（しきい値未満）は動かしたことにしない', () => {
    expect(movedEnough(100, 100, 100 + DRAG_THRESHOLD_PX - 1, 100)).toBe(false)
  })

  it('しきい値ぶん動いたら、動かしたと認める', () => {
    expect(movedEnough(100, 100, 100 + DRAG_THRESHOLD_PX, 100)).toBe(true)
  })

  it('斜めの動きも距離で見る（縦横それぞれは小さくても動きは大きい）', () => {
    expect(movedEnough(0, 0, 3, 3)).toBe(true) // √18 ≒ 4.24
  })

  it('どちら向きに動いても同じに扱う', () => {
    expect(movedEnough(100, 100, 90, 100)).toBe(true)
    expect(movedEnough(100, 100, 100, 90)).toBe(true)
  })
})
