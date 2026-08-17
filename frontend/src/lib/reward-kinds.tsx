import { Award, Crown, Gem, Medal } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * 獲得物の種類と、その意味。
 *
 * **説明は1か所で持つ。** 同じ語の説明が画面ごとに違うと、
 * どれが本当なのかを読む側が考えることになる。
 * アチーブメントの `?` と、宮殿の主人カードから開く説明は、ここを共有する。
 */
export type RewardKindHelp = {
  kind: 'title' | 'medal' | 'treasure' | 'honor'
  label: string
  /** 何をするものか（名乗る・掲げる・飾る・選ばれる） */
  verb: string
  icon: ReactNode
  description: string
}

export const REWARD_KIND_HELP: RewardKindHelp[] = [
  {
    kind: 'title',
    label: '称号',
    verb: '名乗るもの',
    icon: <Crown size={16} />,
    description: '1つだけ選んで名乗れます。エントランスの「宮殿の主人」にも出ます。',
  },
  {
    kind: 'medal',
    label: '勲章',
    verb: '掲げるもの',
    icon: <Medal size={16} />,
    description: '功績のしるし。いくつか選んで並べて掲げられます。',
  },
  {
    kind: 'treasure',
    label: '宝物',
    verb: '飾るもの',
    icon: <Gem size={16} />,
    description: '手に入れた品。マイルームに飾れるようにする準備をしています。',
  },
  {
    kind: 'honor',
    label: '表彰',
    verb: '選ばれたこと',
    icon: <Award size={16} />,
    description: '運営が選んで贈るもの。条件では手に入りません。',
  },
]

export function rewardKindHelp(kind: RewardKindHelp['kind']): RewardKindHelp | undefined {
  return REWARD_KIND_HELP.find((entry) => entry.kind === kind)
}
