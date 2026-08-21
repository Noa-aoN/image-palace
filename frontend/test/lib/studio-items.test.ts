import { describe, it, expect } from 'vitest'
import {
  blocksDraft,
  countByState,
  filterItems,
  ITEM_STATE_LABEL,
  ITEM_STATE_TONE,
  noteFor,
  stateFor,
} from '@/lib/studio/items'
import type { StudioItem } from '@/lib/api/studio'

function item(over: Partial<StudioItem> = {}): StudioItem {
  return {
    id: 'a',
    title: 'DNS',
    item_type: '単語',
    thumb_url: null,
    boxes: [],
    views: [],
    packages: [],
    excluded: false,
    blockers: [],
    ...over,
  }
}

// **公式宮殿にあるもの全部が公開物ではない。**
// 並べただけでは「これは出ているのか」が分からないので、状態にして言う
describe('カード1枚の状態', () => {
  it('箱にもキャンバスにも入っていなければ、選びようがない', () => {
    expect(stateFor(item())).toBe('loose')
  })

  it('箱に入っていれば、次の下書きに入る', () => {
    expect(stateFor(item({ boxes: ['ITのことば'] }))).toBe('ready')
  })

  it('キャンバスだけに置かれていても、出せる', () => {
    expect(stateFor(item({ views: ['神々の系図'] }))).toBe('ready')
  })

  it('荷物に入っていれば、出している', () => {
    expect(stateFor(item({ boxes: ['箱'], packages: ['starter_it'] }))).toBe('shipped')
  })

  // **順番が意味を持つ。**
  // 外した1枚が「出している」に見えると、押した操作が効いていないように読める
  it('外したものは、荷物に入っていても「出さない」と言う', () => {
    expect(stateFor(item({ excluded: true, packages: ['starter_it'] }))).toBe('excluded')
  })

  it('欠けがあれば、出せないと言う', () => {
    expect(stateFor(item({ boxes: ['箱'], blockers: ['絵がありません'] }))).toBe('blocked')
  })

  it('外してあるなら、欠けよりそちらを先に言う', () => {
    expect(stateFor(item({ excluded: true, blockers: ['絵がありません'] }))).toBe('excluded')
  })

  it('5つとも言い方と見た目がある', () => {
    for (const state of ['excluded', 'blocked', 'shipped', 'ready', 'loose'] as const) {
      expect(ITEM_STATE_LABEL[state]).toBeTruthy()
      expect(ITEM_STATE_TONE[state]).toBeTruthy()
    }
  })
})

// **すでに出した荷物は動かない。** そこを黙っていると
// 「外したのに配られている」と見える
describe('添える一言', () => {
  it('外したものは、次の下書きから外れると言う', () => {
    expect(noteFor(item({ excluded: true }))).toContain('次に起こす下書き')
  })

  it('すでに出している荷物には残ることを、隠さない', () => {
    const note = noteFor(item({ excluded: true, packages: ['starter_it'] }))

    expect(note).toContain('starter_it')
    expect(note).toContain('残ります')
  })

  // **箱は袋、キャンバスは構造。**
  // キャンバスは節を抜くと穴が開くので、サーバー側はそこで止める。
  // 押した場所で先に言っておかないと、下書きを起こしてから気づくことになる
  it('キャンバスに置いたまま外したら、下書きが止まると言う', () => {
    const note = noteFor(item({ excluded: true, views: ['神々の系図'] }))

    expect(note).toContain('神々の系図')
    expect(note).toContain('止まります')
  })

  it('箱に入っているだけなら、止まるとは言わない', () => {
    expect(noteFor(item({ excluded: true, boxes: ['ITのことば'] }))).not.toContain('止まります')
  })

  it('キャンバスにも荷物にも入っていたら、両方言う', () => {
    const note = noteFor(item({ excluded: true, views: ['神々の系図'], packages: ['starter_it'] }))

    expect(note).toContain('止まります')
    expect(note).toContain('残ります')
  })

  it('欠けは理由をそのまま言う', () => {
    expect(noteFor(item({ blockers: ['絵がありません', '意味がありません'] }))).toContain('絵がありません')
  })

  it('出しているものは、どの荷物かを言う', () => {
    expect(noteFor(item({ packages: ['starter_it', 'demo_showcase'] }))).toContain('demo_showcase')
  })
})

// 外したのにキャンバスに置いたままなら、そのキャンバスを選ぶと止まる
describe('下書きを止めてしまう1枚', () => {
  it('外して、キャンバスに置いたままなら、止める側', () => {
    expect(blocksDraft(item({ excluded: true, views: ['神々の系図'] }))).toBe(true)
  })

  it('外していなければ、止めない', () => {
    expect(blocksDraft(item({ views: ['神々の系図'] }))).toBe(false)
  })

  // 箱は袋なので、抜いても小さい袋のままでよい
  it('箱に入っているだけなら、止めない', () => {
    expect(blocksDraft(item({ excluded: true, boxes: ['ITのことば'] }))).toBe(false)
  })
})

describe('絞り込み', () => {
  const items = [
    item({ id: '1', title: 'DNS', boxes: ['ITのことば'], packages: ['starter_it'] }),
    item({ id: '2', title: 'ルーター', boxes: ['ITのことば'], blockers: ['絵がありません'] }),
    item({ id: '3', title: 'つくりかけ' }),
    item({ id: '4', title: 'やめたもの', boxes: ['ITのことば'], excluded: true }),
  ]

  it('はじめは全部見せる', () => {
    expect(filterItems(items, 'all', '')).toHaveLength(4)
  })

  // 数が多いので、まず「出せない」だけを見たいことが多い
  it('状態で絞れる', () => {
    expect(filterItems(items, 'blocked', '').map((i) => i.title)).toEqual(['ルーター'])
  })

  it('題で探せる', () => {
    expect(filterItems(items, 'all', 'ルー').map((i) => i.title)).toEqual(['ルーター'])
  })

  it('大文字小文字は問わない', () => {
    expect(filterItems(items, 'all', 'dns').map((i) => i.title)).toEqual(['DNS'])
  })

  // 「あの箱に入っているのはどれだったか」から探せる
  it('箱の名前でも探せる', () => {
    expect(filterItems(items, 'all', 'ITのことば')).toHaveLength(3)
  })

  it('荷物の鍵でも探せる', () => {
    expect(filterItems(items, 'all', 'starter_it').map((i) => i.title)).toEqual(['DNS'])
  })

  it('絞り込みと言葉は重ねられる', () => {
    expect(filterItems(items, 'shipped', 'ITのことば').map((i) => i.title)).toEqual(['DNS'])
  })

  it('内訳を数える', () => {
    expect(countByState(items)).toEqual({
      shipped: 1,
      blocked: 1,
      loose: 1,
      excluded: 1,
      ready: 0,
    })
  })
})
