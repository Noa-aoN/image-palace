'use client'

import { useState } from 'react'
import { Wand2, Undo2, Redo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { aiEditView, redoView, undoView } from '@/lib/api/views'
import type { AiEditMode, AiEditSummary, ViewDetail } from '@/types/view'

const PANEL_KEY = 'canvas-ai-edit'
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
 * ページ上はボタンと「戻る／進む」だけにして、指示の入力は右パネルで行う。
 * 盤そのものを見る面積を、設定のために削らないため。
 *
 * 戻る／進むは一手で効いてほしいので、ページ側に置いたままにする。
 */
export function AiEditPanel({
  viewId,
  viewType,
  canUndo,
  canRedo,
  onApplied,
}: {
  viewId: string
  viewType: string
  canUndo: boolean
  canRedo: boolean
  /** 編集後のキャンバス。呼び出し側で描き直す */
  onApplied: (view: ViewDetail) => void
}) {
  const panel = usePanelForm(PANEL_KEY, 'AIに整えてもらう')
  const [instruction, setInstruction] = useState('')
  const [mode, setMode] = useState<AiEditMode>('placed_only')
  const [busy, setBusy] = useState<'edit' | 'undo' | 'redo' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiEditSummary | null>(null)

  const run = async () => {
    const trimmed = instruction.trim()
    if (!trimmed || busy) return
    setBusy('edit')
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
      setBusy(null)
    }
  }

  const step = async (direction: 'undo' | 'redo') => {
    if (busy) return
    setBusy(direction)
    setError(null)
    try {
      onApplied(await (direction === 'undo' ? undoView(viewId) : redoView(viewId)))
      setResult(null)
    } catch {
      setError(direction === 'undo' ? '戻せませんでした' : '進めませんでした')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={panel.open}
          className="flex items-center gap-1.5"
          aria-expanded={panel.isOpen}
        >
          <Wand2 size={15} />
          AIに整えてもらう
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => step('undo')}
          disabled={!canUndo || busy !== null}
          aria-label="AI調整を戻す"
          title="AI調整を戻す"
          className="flex items-center gap-1"
        >
          {busy === 'undo' ? <Spinner size={14} /> : <Undo2 size={15} />}
          戻る
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => step('redo')}
          disabled={!canRedo || busy !== null}
          aria-label="AI調整をやり直す"
          title="AI調整をやり直す"
          className="flex items-center gap-1"
        >
          {busy === 'redo' ? <Spinner size={14} /> : <Redo2 size={15} />}
          進む
        </Button>

        {error && !panel.isOpen && <span className="text-sm text-destructive">{error}</span>}
      </div>

      <PanelSlotContent sectionKey={PANEL_KEY}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            やりたいことをことばで書くと、AI が並べ替え
            {viewType === 'freeboard' && '・配置・線つなぎ'}を代わりに行います。
            結果が違ったときは「戻る」で元に戻せます。
          </p>

          <div>
            <label htmlFor="ai-edit-instruction" className="mb-1 block text-xs text-muted-foreground">
              指示
            </label>
            <Input
              id="ai-edit-instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                // 日本語入力の変換確定 Enter で実行してしまわないようにする
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) run()
              }}
              placeholder={EXAMPLES[viewType] ?? '例: 意味のまとまりごとに並べて'}
              maxLength={MAX_INSTRUCTION}
              disabled={busy !== null}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {instruction.length} / {MAX_INSTRUCTION}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">使うカード</p>
            <div className="flex flex-wrap gap-2">
              {MODES.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={mode === option.value ? 'default' : 'outline'}
                  disabled={busy !== null}
                  onClick={() => setMode(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {MODES.find((option) => option.value === mode)?.description}
            </p>
          </div>

          <Button
            onClick={run}
            disabled={busy !== null || !instruction.trim()}
            className="flex w-full items-center justify-center gap-1.5"
          >
            {busy === 'edit' ? <Spinner size={14} /> : <Wand2 size={14} />}
            {busy === 'edit' ? '編集中…' : '整える'}
          </Button>

          {result && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-sm">{result.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                追加 {result.added} / 取り外し {result.removed} / 配置 {result.placed}
                {viewType === 'freeboard' && <> / 線 {result.connected}</>}
              </p>
              {result.notes && (
                <p className="mt-2 border-t border-border/60 pt-2 text-xs leading-relaxed text-muted-foreground">
                  AIからの補足: {result.notes}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </PanelSlotContent>
    </>
  )
}
