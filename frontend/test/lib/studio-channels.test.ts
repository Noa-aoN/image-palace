import { describe, it, expect } from 'vitest'
import {
  channelsFor,
  deliveriesFor,
  enabledCountFor,
  ROOM_NOUN,
  summarize,
} from '@/lib/studio/channels'
import type { Delivery, StudioPackage } from '@/lib/api/studio'

const LABELS: Record<Delivery['channel'], string> = {
  demo: '体験の宮殿に置く',
  delphi: 'デルフォイで受け取れる',
  campaign: '引き換えコードで渡す',
  mission: 'ミッションの報酬にする',
  purchase: '購入で手に入る',
}

const PENDING: Delivery['channel'][] = ['campaign', 'mission', 'purchase']

function deliveries(enabled: Delivery['channel'][]): Delivery[] {
  return (Object.keys(LABELS) as Delivery['channel'][]).map((channel) => ({
    channel,
    label: LABELS[channel],
    note: '',
    enabled: enabled.includes(channel),
    pending: PENDING.includes(channel),
  }))
}

function pkg(over: Partial<StudioPackage> & { on?: Delivery['channel'][] } = {}): StudioPackage {
  const { on = [], ...rest } = over
  return {
    id: 'a',
    key: 'starter_it',
    version: 1,
    kind: 'starter',
    status: 'published',
    name: 'ITのことば',
    summary: null,
    counts: { items: 10, boxes: 1, views: 0, tags: 0 },
    published_at: null,
    updated_at: '',
    deliveries: deliveries(on),
    delivering_version: 1,
    installs: 0,
    history: [],
    ...rest,
  }
}

// **届け先で部屋を分ける。**
// 同じ荷物が両方に出ることはあるが、部屋ごとに触っている栓が違う
describe('部屋ごとの届け先', () => {
  it('体験宮殿の部屋は、体験の栓だけを扱う', () => {
    expect(channelsFor('demo')).toEqual(['demo'])
  })

  it('配布の部屋は、残りの栓を扱う', () => {
    expect(channelsFor('delivery')).toEqual(['delphi', 'campaign', 'mission', 'purchase'])
  })

  // **名前を分ける。** 置くものと、人に渡すものは役割が違う
  it('部屋ごとに呼び方が違う', () => {
    expect(ROOM_NOUN.demo).toBe('配置物')
    expect(ROOM_NOUN.delivery).toBe('配布物')
  })

  it('その部屋の栓だけを取り出す', () => {
    expect(deliveriesFor(pkg(), 'demo').map((d) => d.channel)).toEqual(['demo'])
    expect(deliveriesFor(pkg(), 'delivery')).toHaveLength(4)
  })

  it('同じ荷物が両方の部屋に出てよい', () => {
    const both = pkg({ on: ['demo', 'delphi'] })

    expect(enabledCountFor([both], 'demo')).toBe(1)
    expect(enabledCountFor([both], 'delivery')).toBe(1)
  })

  it('どこへも出していない荷物は、どちらにも数えない', () => {
    expect(enabledCountFor([pkg()], 'demo')).toBe(0)
    expect(enabledCountFor([pkg()], 'delivery')).toBe(0)
  })
})

// 概要は「いま何がどこへ出ているか」をひと目で出す
describe('概要の要約', () => {
  it('届け先ごとに、荷物とカードの数を出す', () => {
    const rows = summarize([
      pkg({ id: '1', on: ['demo', 'delphi'], counts: { items: 10, boxes: 1, views: 0, tags: 0 } }),
      pkg({ id: '2', on: ['delphi'], counts: { items: 5, boxes: 1, views: 0, tags: 0 } }),
    ])
    const byChannel = Object.fromEntries(rows.map((r) => [r.channel, r]))

    expect(byChannel.demo.packages).toBe(1)
    expect(byChannel.demo.items).toBe(10)
    expect(byChannel.delphi.packages).toBe(2)
    expect(byChannel.delphi.items).toBe(15)
  })

  // **出しているものだけ数える。**
  // 止めた荷物を混ぜると、誰にも届いていないものが「出している」に見える
  it('止めた荷物は数えない', () => {
    const rows = summarize([pkg({ status: 'suspended', on: ['delphi'] })])

    expect(rows.find((r) => r.channel === 'delphi')?.packages).toBe(0)
  })

  it('下書きも数えない', () => {
    const rows = summarize([pkg({ status: 'draft', on: ['delphi'] })])

    expect(rows.find((r) => r.channel === 'delphi')?.packages).toBe(0)
  })

  it('5つの届け先を全部並べる（0 のものも）', () => {
    expect(summarize([]).map((r) => r.channel)).toEqual([
      'demo',
      'delphi',
      'campaign',
      'mission',
      'purchase',
    ])
  })

  it('受け取る側の仕組みが無いものは、そうと分かる', () => {
    const rows = summarize([pkg({ on: ['delphi'] })])
    const byChannel = Object.fromEntries(rows.map((r) => [r.channel, r]))

    expect(byChannel.delphi.pending).toBe(false)
    expect(byChannel.campaign.pending).toBe(true)
  })

  it('荷物が1つも無くても落ちない', () => {
    expect(summarize([])).toHaveLength(5)
    expect(summarize([])[0].items).toBe(0)
  })
})
