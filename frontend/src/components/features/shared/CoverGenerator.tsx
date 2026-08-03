'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { STYLE_OPTIONS } from '@/lib/item-styles'
import { useBillingStore } from '@/stores/billing'

const MAX_PROMPT = 300

/**
 * カバー画像をことばから作る。
 *
 * カバーはこれまで「先頭カード / コラージュ / 自分でアップロード」の3択で、
 * 中身がまだ無い入れ物には見せられる絵が無かった。
 * プロフィールアイコンと同じように、ことばから作れるようにする。
 *
 * 画像を作る＝クレジットを使うので、残量と消費量を押す前に見せる。
 */
export function CoverGenerator({
  generating,
  error,
  onGenerate,
}: {
  generating: boolean
  error?: string | null
  onGenerate: (prompt: string, style: string) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('photo')
  const available = useBillingStore((s) => s.summary?.available_credits) ?? null
  const insufficient = available != null && available < 1

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-3">
      <p className="text-sm font-medium">AIで作る</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="cover-prompt" className="mb-1 block text-xs text-muted-foreground">
            どんな絵にするか
          </label>
          <Input
            id="cover-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例: 朝もやの中の石造りの門"
            maxLength={MAX_PROMPT}
            disabled={generating}
          />
        </div>
        <div className="w-32">
          <label htmlFor="cover-style" className="mb-1 block text-xs text-muted-foreground">
            スタイル
          </label>
          <select
            id="cover-style"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            disabled={generating}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STYLE_OPTIONS.filter((o) => o.value).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          onClick={() => onGenerate(prompt.trim(), style)}
          disabled={generating || insufficient || !prompt.trim()}
          className="flex items-center justify-center gap-1.5 sm:w-28"
        >
          {generating ? <Spinner size={14} /> : <Sparkles size={14} />}
          {generating ? '生成中…' : '生成する'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        生成には1クレジット消費します{available != null ? `（残り ${available} cr）` : ''}。
      </p>
      {insufficient && (
        <p className="text-xs text-destructive">
          クレジットが不足しています。
          <Link href="/billing" className="ml-1 underline">
            プランを見る
          </Link>
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
