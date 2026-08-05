'use client'

import { useState } from 'react'
import { FileText, X, Sparkles } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { regenerateBrief } from '@/lib/api/items'
import type { Item } from '@/types/item'

/**
 * この画像がどんな指示から作られたかを ⓘ ボタンで開いて見せる。
 *
 * 画像は単語からいきなり作られるのではなく、いちど
 *   ① 単語を噛み砕いた説明文 → ② そこから起こした情景
 * を経由する。学習そのものの中身ではないので、生成情報と同じく畳んでおく。
 *
 * 直すのは「画像を作り直す」側で行う。見るだけの場所と、直して作り直す場所を分ける。
 */
export function PromptInfo({ item, onUpdated }: { item: Item; onUpdated: (item: Item) => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = item.brief_status ?? 'none'
  const preparing = status === 'pending' || status === 'processing'
  // まだ何も無く、これから作られる気配も無いカード（機能オフ・旧データ）は出さない
  if (status === 'none' && !item.scene_prompt && !item.image_description) return null

  const regenerate = async () => {
    setBusy(true)
    setError(null)
    try {
      onUpdated(await regenerateBrief(item.id))
    } catch {
      setError('作り直せませんでした。時間を置いてお試しください')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="プロンプト情報を表示"
        aria-expanded={open}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {preparing ? <Spinner size={13} /> : <FileText size={14} />}
        プロンプト情報
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 space-y-2 rounded-xl border border-border bg-card p-3 text-sm shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">プロンプト情報</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            単語をいちど説明文にしてから、絵にできる情景へ言い換えています。
          </p>

          <Field label="① 説明文">
            <Text value={item.image_description} placeholder={preparing ? '作成中...' : '未作成'} />
          </Field>
          <Field label="② 情景（画像への指示）">
            <Text
              value={item.scene_prompt}
              placeholder={preparing ? '作成中...' : '未作成（単語をそのまま使用）'}
              mono
            />
          </Field>

          <div className="flex items-center justify-between border-t border-border/60 pt-2">
            <button
              type="button"
              onClick={regenerate}
              disabled={busy || preparing}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {busy ? <Spinner size={12} /> : <Sparkles size={12} />}
              AIで作り直す
            </button>
            {item.brief_edited && <span className="text-xs text-muted-foreground">編集済み</span>}
          </div>

          <p className="text-xs text-muted-foreground">
            直すときは「画像を作り直す」から。
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function Text({ value, placeholder, mono }: { value?: string | null; placeholder: string; mono?: boolean }) {
  if (!value) return <p className="text-xs text-muted-foreground">{placeholder}</p>

  return (
    <p
      className={`max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed ${
        mono ? 'font-mono text-[11px]' : 'text-xs'
      }`}
    >
      {value}
    </p>
  )
}
