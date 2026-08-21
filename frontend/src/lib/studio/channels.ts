import type { Delivery, StudioPackage } from '@/lib/api/studio'

/**
 * 工房室の部屋分け。**届け先で分ける。**
 *
 * 同じ荷物が両方に出ることはある（体験の宮殿にも置き、デルフォイでも配る）。
 * それは重複ではない。**部屋ごとに触っている栓が違う**ので、
 * それぞれの問いに答えている。
 *
 * 名前も分ける。置くもの（配置物）と、人に渡すもの（配布物）は役割が違う。
 */
export const DEMO_CHANNELS: Delivery['channel'][] = ['demo']

export const DELIVERY_CHANNELS: Delivery['channel'][] = [
  'delphi',
  'campaign',
  'mission',
  'purchase',
]

/** 部屋ごとの、荷物の呼び方 */
export const ROOM_NOUN = {
  demo: '配置物',
  delivery: '配布物',
} as const

export type StudioRoom = keyof typeof ROOM_NOUN

export function channelsFor(room: StudioRoom): Delivery['channel'][] {
  return room === 'demo' ? DEMO_CHANNELS : DELIVERY_CHANNELS
}

/**
 * その部屋に関わる届け先だけを取り出す。
 *
 * 荷物は全部の届け先を持って返ってくるが、
 * **部屋で触れるのは、その部屋の栓だけ**にする
 */
export function deliveriesFor(pkg: StudioPackage, room: StudioRoom): Delivery[] {
  const wanted = new Set<string>(channelsFor(room))
  return pkg.deliveries.filter((d) => wanted.has(d.channel))
}

/** その部屋で、いくつ出しているか */
export function enabledCountFor(packages: StudioPackage[], room: StudioRoom): number {
  return packages.filter((pkg) => deliveriesFor(pkg, room).some((d) => d.enabled)).length
}

/**
 * 概要に出す要約。**いま何がどこへ出ているか、ひと目で。**
 *
 * 数えるのは「出している荷物」だけ。下書きや止めたものを混ぜると、
 * 実際には誰にも届いていないものが「出している」に見える
 */
export type ChannelSummary = {
  channel: Delivery['channel']
  label: string
  /** その届け先で配っている荷物の数 */
  packages: number
  /** その届け先で配っているカードの合計 */
  items: number
  /** 受け取る側の仕組みがまだ無い */
  pending: boolean
}

export function summarize(packages: StudioPackage[]): ChannelSummary[] {
  const all = [...DEMO_CHANNELS, ...DELIVERY_CHANNELS]

  return all.map((channel) => {
    const live = packages.filter(
      (pkg) =>
        pkg.status === 'published' &&
        pkg.deliveries.some((d) => d.channel === channel && d.enabled)
    )
    const meta = packages[0]?.deliveries.find((d) => d.channel === channel)

    return {
      channel,
      label: meta?.label ?? channel,
      packages: live.length,
      items: live.reduce((sum, pkg) => sum + pkg.counts.items, 0),
      pending: meta?.pending ?? false,
    }
  })
}
