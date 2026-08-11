'use client'

import { useRef, useState } from 'react'
import { GalleryHorizontal, LayoutGrid, ImageUp, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CoverGenerator } from '@/components/features/shared/CoverGenerator'
import type { CoverType } from '@/types/cover'

/**
 * カバーの決め方。**「どうやって絵を用意するか」で4つに割る。**
 *
 * 以前は「カスタム画像」の1つにアップロードと生成が同居していて、
 * 選んだ先でもう一度選ぶ形になっていた。どちらも custom を作る道筋なので
 * 中では同じだが、選ぶ人にとっては別の作業。ここで並べる。
 */
const OPTIONS = [
  { type: 'first_card', label: '先頭', icon: <GalleryHorizontal size={14} /> },
  { type: 'collage', label: 'コラージュ', icon: <LayoutGrid size={14} /> },
  { type: 'upload', label: 'アップロード', icon: <ImageUp size={14} /> },
  { type: 'generate', label: '画像を生成', icon: <Sparkles size={14} /> },
] as const

type CoverChoice = (typeof OPTIONS)[number]['type']

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
  onGenerate,
  generating = false,
  generateError,
}: {
  coverType: CoverType
  busy: boolean
  helpText?: string
  hasCustom: boolean
  onSelectType: (type: CoverType) => void
  onUpload: (file: File) => void
  onRemove: () => void
  /** ことばからカバー画像を作る。渡さなければ「AIで作る」は出さない */
  onGenerate?: (prompt: string, style: string) => void
  generating?: boolean
  generateError?: string | null
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  // 「アップロード」と「画像を生成」は、どちらも custom を作る道筋。
  // どちらを選んだかは保存されないので、画面のあいだだけ覚えておく
  const [choice, setChoice] = useState<CoverChoice>(coverType === 'custom' ? 'upload' : coverType)

  const select = (next: CoverChoice) => {
    setChoice(next)
    onSelectType(next === 'upload' || next === 'generate' ? 'custom' : next)
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">カバー表示</p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <Button
            key={o.type}
            size="sm"
            variant={choice === o.type ? 'default' : 'outline'}
            disabled={busy || (o.type === 'generate' && !onGenerate)}
            onClick={() => select(o.type)}
            className="flex items-center gap-1.5"
          >
            {o.icon}
            {o.label}
          </Button>
        ))}
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
      {choice === 'upload' && (
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
      {choice === 'generate' && onGenerate && (
        <CoverGenerator generating={generating} error={generateError} onGenerate={onGenerate} />
      )}
    </div>
  )
}
