'use client'

import { GenerationInfo } from '@/components/features/items/GenerationInfo'
import { PromptInfo } from '@/components/features/items/PromptInfo'
import { RegeneratePanel } from '@/components/features/items/RegeneratePanel'
import type { Item } from '@/types/item'

/**
 * 画像のすぐ下に置く一行。
 *
 * 画像まわりの情報と操作は、置き場所が増えると散らばる。実際
 * 詳細ページでは「生成情報」だけが右に浮き、「画像を作り直す」は別の行に落ち、
 * 「プロンプト情報」は出てすらいなかった。同じものを2箇所で組み立てていたため。
 * 組み立てはここ1箇所にして、詳細ページと右パネルで同じ並びにする。
 *
 * 並びは「見るだけのもの」を左、「するもの」を右。
 *   [生成情報 ⓘ] [プロンプト情報 ⓘ] ……… [作り直す]
 *
 * 画像を見る面積を削らないよう一行に収める。横スクロールには逃がさない
 * （隠れたものは無いのと同じなので）。入りきらない幅では折り返す。
 */
export function ItemImageBar({ item, onUpdated }: { item: Item; onUpdated: (item: Item) => void }) {
  const canRegenerate = item.generation_status === 'failed' || item.generation_status === 'completed'

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-4">
        <GenerationInfo item={item} />
        <PromptInfo item={item} />
      </div>
      {canRegenerate && <RegeneratePanel item={item} onUpdated={onUpdated} />}
    </div>
  )
}
