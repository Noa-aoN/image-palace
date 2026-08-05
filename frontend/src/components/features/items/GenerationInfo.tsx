'use client'

import { Info } from 'lucide-react'
import { InfoPopover } from '@/components/features/shared/InfoPopover'
import type { Item } from '@/types/item'

const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
}

/**
 * 画像生成のメタ情報（モデル・プロバイダ・revised_prompt 等）を ⓘ ボタンで開いて表示する。
 * 学習対象のコンテンツではないため常時表示はせず、クリック時のみ見せる。
 * generation_info が無いカード（pending/failed・旧データ）ではボタン自体を出さない。
 */
export function GenerationInfo({ item }: { item: Item }) {
  const info = item.media?.generation_info
  if (!info) return null

  const provider = info.provider ? (PROVIDER_LABEL[info.provider] ?? info.provider) : null
  const sizeQuality = [info.size, info.quality].filter(Boolean).join(' / ')
  const generatedAt = new Date(item.created_at).toLocaleString('ja-JP')

  return (
    <InfoPopover label="生成情報" icon={<Info size={14} />}>
      <dl className="space-y-1 text-xs">
        {info.model && (
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">モデル</dt>
            <dd className="break-all text-right">{info.model}</dd>
          </div>
        )}
        {provider && (
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">プロバイダ</dt>
            <dd className="text-right">{provider}</dd>
          </div>
        )}
        {sizeQuality && (
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">サイズ / 品質</dt>
            <dd className="text-right">{sizeQuality}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">生成日時</dt>
          <dd className="text-right">{generatedAt}</dd>
        </div>
      </dl>

      {info.revised_prompt && (
        <div className="space-y-1 border-t border-border/60 pt-2">
          <p className="text-xs text-muted-foreground">revised_prompt（生成時にAIが補正した指示）</p>
          <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground">
            {info.revised_prompt}
          </p>
        </div>
      )}
    </InfoPopover>
  )
}
