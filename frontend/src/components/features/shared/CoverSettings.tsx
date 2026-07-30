'use client'

import { useRef } from 'react'
import { GalleryHorizontal, LayoutGrid, ImageUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CoverType } from '@/types/cover'

const OPTIONS = [
  { type: 'first_card', label: '先頭', icon: <GalleryHorizontal size={14} /> },
  { type: 'collage', label: 'コラージュ', icon: <LayoutGrid size={14} /> },
  { type: 'custom', label: 'カスタム画像', icon: <ImageUp size={14} /> },
] as const

/**
 * カバー（ヘッダー）設定パネル（デッキ踏襲・共通）。
 * 表示モードの切替と、custom モードのカスタム画像アップロード/削除を提供する。
 */
export function CoverSettings({
  coverType,
  busy,
  helpText,
  hasCustom,
  onSelectType,
  onUpload,
  onRemove,
}: {
  coverType: CoverType
  busy: boolean
  helpText?: string
  hasCustom: boolean
  onSelectType: (type: CoverType) => void
  onUpload: (file: File) => void
  onRemove: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">カバー表示</p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <Button
            key={o.type}
            size="sm"
            variant={coverType === o.type ? 'default' : 'outline'}
            disabled={busy}
            onClick={() => onSelectType(o.type)}
            className="flex items-center gap-1.5"
          >
            {o.icon}
            {o.label}
          </Button>
        ))}
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
      {coverType === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            // サーバー側は PNG/JPEG/WebP のみ受け付ける（libvips に渡す形式を限定するため）
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = ''
            }}
          />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} />}
            画像を選択
          </Button>
          {hasCustom && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onRemove}>
              削除
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
