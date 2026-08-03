'use client'

import { useState } from 'react'
import { ChevronDown, Sparkles, Check, X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { regenerateBrief, updateItem } from '@/lib/api/items'
import type { Item } from '@/types/item'

/**
 * 「この画像がどう作られたか」を開いて見せる。
 *
 * 画像は単語からいきなり作られるのではなく、いちど
 *   ① 単語を噛み砕いた説明文 → ② そこから起こした情景
 * を経由する。概念語をそれらしい絵にするための工程で、
 * 納得のいく絵にならなかったときはここを直すのが一番効く。
 *
 * ただし学習そのものの中身ではないので、既定では畳んでおく。
 */
export function ImageBriefPanel({ item, onUpdated }: { item: Item; onUpdated: (item: Item) => void }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [sceneDraft, setSceneDraft] = useState('')
  const [busy, setBusy] = useState<'saving' | 'regenerating' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const status = item.brief_status ?? 'none'
  const preparing = status === 'pending' || status === 'processing'
  // まだ何も無く、これから作られる気配も無いカード（機能オフ・旧データ）は出さない
  if (status === 'none' && !item.scene_prompt && !item.image_description) return null

  const startEdit = () => {
    setDescriptionDraft(item.image_description ?? '')
    setSceneDraft(item.scene_prompt ?? '')
    setError(null)
    setEditing(true)
  }

  const save = async () => {
    setBusy('saving')
    setError(null)
    try {
      const updated = await updateItem(item.id, {
        image_description: descriptionDraft,
        scene_prompt: sceneDraft,
      })
      onUpdated(updated)
      setEditing(false)
    } catch {
      setError('保存できませんでした')
    } finally {
      setBusy(null)
    }
  }

  const regenerate = async () => {
    setBusy('regenerating')
    setError(null)
    try {
      onUpdated(await regenerateBrief(item.id))
      setEditing(false)
    } catch {
      setError('作り直せませんでした。時間を置いてお試しください')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/40"
      >
        <span className="flex items-center gap-2">
          <span className="font-medium">画像の作られ方</span>
          {preparing && <Spinner size={13} />}
          {item.brief_edited && <span className="text-xs text-muted-foreground">編集済み</span>}
          {status === 'failed' && <span className="text-xs text-muted-foreground">作成できず、単語をそのまま使用</span>}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            単語をいちど説明文にしてから、絵にできる情景へ言い換えています。思った絵にならないときは、ここを直して再生成してください。
          </p>

          {editing ? (
            <>
              <Field label="① 説明文">
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={5}
                  aria-label="説明文"
                  className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </Field>
              <Field label="② 情景（画像への指示）">
                <textarea
                  value={sceneDraft}
                  onChange={(e) => setSceneDraft(e.target.value)}
                  rows={4}
                  aria-label="情景プロンプト"
                  className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  空にすると、単語をそのまま画像の指示に使います。
                </p>
              </Field>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={save} disabled={busy !== null} className="flex items-center gap-1.5">
                  {busy === 'saving' ? <Spinner size={14} /> : <Check size={14} />}
                  保存
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy !== null}>
                  <X size={14} />
                  キャンセル
                </Button>
              </div>
            </>
          ) : (
            <>
              <Field label="① 説明文">
                <Text value={item.image_description} placeholder={preparing ? '作成中...' : '未作成'} />
              </Field>
              <Field label="② 情景（画像への指示）">
                <Text value={item.scene_prompt} placeholder={preparing ? '作成中...' : '未作成（単語をそのまま使用）'} mono />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={startEdit} disabled={busy !== null || preparing} className="flex items-center gap-1.5">
                  <Pencil size={14} />
                  編集
                </Button>
                <Button size="sm" variant="ghost" onClick={regenerate} disabled={busy !== null || preparing} className="flex items-center gap-1.5">
                  {busy === 'regenerating' ? <Spinner size={14} /> : <Sparkles size={14} />}
                  AIで作り直す
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                変更しただけでは画像は変わりません。下の「再生成」で新しい画像を作れます。
              </p>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function Text({ value, placeholder, mono }: { value?: string | null; placeholder: string; mono?: boolean }) {
  if (!value) return <p className="text-sm text-muted-foreground">{placeholder}</p>

  return (
    <p className={`whitespace-pre-wrap leading-relaxed ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</p>
  )
}
