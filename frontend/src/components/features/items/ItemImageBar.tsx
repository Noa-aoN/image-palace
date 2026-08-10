'use client'

import { GenerationInfo } from '@/components/features/items/GenerationInfo'
import { PromptInfo } from '@/components/features/items/PromptInfo'
import { RegeneratePanel } from '@/components/features/items/RegeneratePanel'
import type { Item } from '@/types/item'

/**
 * イメージの操作列。**イメージのプロパティ枠の中**、画像のすぐ下に置く。
 *
 * 以前は枠の外に出ていたため、どのプロパティに対する操作なのかが曖昧だった。
 * 生成情報もプロンプト情報も作り直しも、すべて「この絵」への操作なので、
 * 絵と同じ枠に収める。
 *
 * 並びは中央寄せで等間隔。左右に振り分けると、項目が2つのときと3つのときで
 * 位置が動き、押す場所を覚えられない。
 *
 * 画像を見る面積を削らないよう一行に収める。横スクロールには逃がさない
 * （隠れたものは無いのと同じなので）。入りきらない幅では折り返す。
 */
export function ItemImageBar({ item, onUpdated }: { item: Item; onUpdated: (item: Item) => void }) {
  const canRegenerate = item.generation_status === 'failed' || item.generation_status === 'completed'

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border/60 pt-2.5">
      <GenerationInfo item={item} />
      <PromptInfo item={item} onUpdated={onUpdated} />
      {canRegenerate && <RegeneratePanel item={item} onUpdated={onUpdated} />}
    </div>
  )
}
