'use client'

import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BlockEmpty, BlockError } from '@/components/features/items/PropertyBlock'
import { Tooltip } from '@/components/ui/tooltip'
import { updateMeaning, getItem } from '@/lib/api/items'
import type { Item } from '@/types/item'

/**
 * 例文。意味・説明とは別のカードプロパティとして並べる。
 *
 * データは意味（meanings.example_sentence）に紐づいたままにしてある。
 * 番号を意味・説明と揃えることで「1 の意味に対する 1 の例」と読めるようにし、
 * 別々のブロックでも対応が追える形にした。
 */
export function ExampleList({ item, onUpdated }: { item: Item; onUpdated: (item: Item) => void }) {
  const entries = item.meanings
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!entries || entries.length === 0) {
    return <BlockEmpty>意味・説明を追加すると、それぞれに例文を書けます</BlockEmpty>
  }

  const startEdit = (id: string, current: string | null) => {
    setEditingId(id)
    setDraft(current ?? '')
    setError(null)
  }

  const save = async (id: string) => {
    setSaving(true)
    setError(null)
    try {
      await updateMeaning(item.id, id, { example_sentence: draft.trim() || null })
      onUpdated(await getItem(item.id))
      setEditingId(null)
    } catch {
      setError('保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <div key={entry.id} className="rounded-lg border border-border/70 bg-background px-3 py-2">
          <div className="flex items-start gap-2">
            {/* 意味・説明と同じ番号。どの意味に対する例かを揃える */}
            <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">{index + 1}.</span>

            {editingId === entry.id ? (
              <div className="min-w-0 flex-1 space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder="例文"
                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => save(entry.id)} disabled={saving}>
                    {saving ? <Spinner size={14} /> : <Check size={14} />}
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={saving}>
                    <X size={14} />
                    やめる
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {entry.example_sentence || <span className="text-muted-foreground">未設定</span>}
                </p>
                <Tooltip label={entry.example_sentence ? '例文を編集' : '例文を書く'}>
                  <button
                    type="button"
                    onClick={() => startEdit(entry.id, entry.example_sentence ?? null)}
                    aria-label={entry.example_sentence ? '例文を編集' : '例文を書く'}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil size={14} />
                  </button>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      ))}

      <BlockError message={error} />
    </div>
  )
}
