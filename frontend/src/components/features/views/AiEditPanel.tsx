'use client'

import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { aiEditView } from '@/lib/api/views'
import type { AiEditMode, AiEditSummary, ViewDetail } from '@/types/view'

const MAX_INSTRUCTION = 500

const MODES: { value: AiEditMode; label: string; description: string }[] = [
  {
    value: 'placed_only',
    label: 'いまある札だけ',
    description: 'すでに置いてあるカードだけで組み直します。',
  },
  {
    value: 'select',
    label: '札を選ぶところから',
    description: '手持ちのカードから、指示に合うものを探して足します。',
  },
]

const EXAMPLES: Record<string, string> = {
  deck: '例: 覚えやすい順に並べ替えて',
  freeboard: '例: 原因と結果が分かるように並べて、線でつないで',
}

/**
 * ことばの指示でキャンバスを組み立て直す。
 *
 * 並べ替え・配置・線つなぎは、やることは決まっているのに手数が多い。
 * そこを代わりにやってもらう。
 *
 * 何が変わったかは結果として返し、勝手に進めた感じにならないようにする。
 */
export function AiEditPanel({
  viewId,
  viewType,
  onApplied,
}: {
  viewId: string
  viewType: string
  /** 編集後のキャンバス。呼び出し側で描き直す */
  onApplied: (view: ViewDetail) => void
}) {
  const [instruction, setInstruction] = useState('')
  const [mode, setMode] = useState<AiEditMode>('placed_only')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiEditSummary | null>(null)

  const run = async () => {
    const trimmed = instruction.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const updated = await aiEditView(viewId, trimmed, mode)
      setResult(updated.ai_edit ?? null)
      onApplied(updated)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? '編集できませんでした。時間を置いてお試しください。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-6 space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Wand2 size={16} style={{ color: 'var(--palace)' }} />
        <p className="text-sm font-medium">AIに整えてもらう</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run()
          }}
          placeholder={EXAMPLES[viewType] ?? '例: 意味のまとまりごとに並べて'}
          maxLength={MAX_INSTRUCTION}
          disabled={busy}
          aria-label="AIへの指示"
        />
        <Button onClick={run} disabled={busy || !instruction.trim()} className="flex items-center gap-1.5 sm:w-32">
          {busy ? <Spinner size={14} /> : <Wand2 size={14} />}
          {busy ? '編集中…' : '整える'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {MODES.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={mode === option.value ? 'default' : 'outline'}
            disabled={busy}
            onClick={() => setMode(option.value)}
            title={option.description}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {MODES.find((option) => option.value === mode)?.description}
      </p>

      {result && (
        <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
          <p className="text-sm">{result.summary}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            追加 {result.added} / 取り外し {result.removed} / 配置 {result.placed}
            {viewType === 'freeboard' && <> / 線 {result.connected}</>}
          </p>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
