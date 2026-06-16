'use client'

import { useState } from 'react'
import { Info, X } from 'lucide-react'
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
  const [open, setOpen] = useState(false)
  const info = item.media?.generation_info
  if (!info) return null

  const provider = info.provider ? (PROVIDER_LABEL[info.provider] ?? info.provider) : null
  const sizeQuality = [info.size, info.quality].filter(Boolean).join(' / ')
  const generatedAt = new Date(item.created_at).toLocaleString('ja-JP')

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="生成情報を表示"
        aria-expanded={open}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Info size={14} />
        生成情報
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 space-y-2 rounded-xl border border-border bg-card p-3 text-sm shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">生成情報</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <dl className="space-y-1 text-xs">
            {info.model && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground shrink-0">モデル</dt>
                <dd className="text-right break-all">{info.model}</dd>
              </div>
            )}
            {provider && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground shrink-0">プロバイダ</dt>
                <dd className="text-right">{provider}</dd>
              </div>
            )}
            {sizeQuality && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground shrink-0">サイズ / 品質</dt>
                <dd className="text-right">{sizeQuality}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground shrink-0">生成日時</dt>
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
        </div>
      )}
    </div>
  )
}
