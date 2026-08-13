import { describe, expect, it } from 'vitest'

/**
 * 作成時の「できる限り自動で生成」の決まり。
 *
 * 包括は**いま全部入っているかを映す鏡**。押すと全部入り、もう一度押すと全部外れる。
 * 1つでも外せば印も外れる。こうしておくと「全部にしたのに一部が作られない」が起こらない。
 */
const PROPERTY_KEYS = ['reading', 'aliases', 'pronunciation']

type Enrich = { meaning: boolean; tags: boolean; properties: string[] }

const allOn = (s: Enrich) =>
  s.meaning && s.tags && PROPERTY_KEYS.every((key) => s.properties.includes(key))

const toggleAll = (on: boolean): Enrich => ({
  meaning: on,
  tags: on,
  properties: on ? [...PROPERTY_KEYS] : [],
})

describe('できる限り自動で生成', () => {
  it('押すと、対象がまとめて入る', () => {
    const next = toggleAll(true)

    expect(next.meaning).toBe(true)
    expect(next.tags).toBe(true)
    expect(next.properties).toEqual(PROPERTY_KEYS)
    expect(allOn(next)).toBe(true)
  })

  it('もう一度押すと、まとめて外れる', () => {
    expect(allOn(toggleAll(false))).toBe(false)
    expect(toggleAll(false).properties).toEqual([])
  })

  it('1つでも外せば、包括の印も外れる', () => {
    const state = { ...toggleAll(true), properties: ['reading', 'aliases'] }

    expect(allOn(state)).toBe(false)
  })

  it('外したあとで押し直すと、また全部そろう', () => {
    const partial = { ...toggleAll(true), tags: false }
    expect(allOn(partial)).toBe(false)

    expect(allOn(toggleAll(true))).toBe(true)
  })

  it('項目を1つも選ばなければ、項目の生成は起こらない', () => {
    const state = toggleAll(false)

    expect(state.properties.length > 0).toBe(false)
  })
})
