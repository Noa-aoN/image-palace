'use client'

import { useRightPanelStore } from '@/stores/rightPanel'
import { ImageInfoPanel } from '@/components/features/items/ImageInfoPanel'
import { RegeneratePanel } from '@/components/features/items/RegeneratePanel'
import { ImageHistoryPanel, IMAGE_HISTORY_PANEL_KEY } from '@/components/features/items/ImageHistoryPanel'
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
  const openSection = useRightPanelStore((s) => s.openSection)

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border/60 pt-2.5">
      {/* 「この絵がどう作られたか」は1つにまとめる。
          生成情報とプロンプト情報に分けていたころは、出す条件がそれぞれ違い、
          カードの状態によって片方だけ消えた（出たり出なかったりに見えた） */}
      <ImageInfoPanel
        item={item}
        onUpdated={onUpdated}
        onOpenHistory={
          canRegenerate ? () => openSection({ key: IMAGE_HISTORY_PANEL_KEY, title: '生成履歴' }) : undefined
        }
      />
      {/*
        これまでに使った絵。**指示の話と、作り直しの間**に置く。
        「どんな指示で出たか」を見て、「前のほうが良かった」と思い、
        それでも無ければ作り直す、という順で手が動く。
        作り直しの後ろに置くと、戻す道があることに気づかないまま1枚使うことになる。
      */}
      {canRegenerate && <ImageHistoryPanel item={item} onUpdated={onUpdated} />}
      {canRegenerate && <RegeneratePanel item={item} onUpdated={onUpdated} />}
    </div>
  )
}
