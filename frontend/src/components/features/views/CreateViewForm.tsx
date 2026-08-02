'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createView } from '@/lib/api/views'
import { getSpaces } from '@/lib/api/spaces'
import { VIEW_TYPES, viewTypeLabel, IMPLEMENTED_VIEW_TYPES, viewTypeDescription } from '@/lib/view-types'
import { spaceTypeLabel } from '@/lib/space-types'
import type { View } from '@/types/view'
import type { Space } from '@/types/space'

interface Props {
  onCreated?: (view: View) => void
  redirectBase?: string
  onCancel?: () => void
  // 初期種別（ライブラリの ?type 導線などから）。
  defaultType?: string
}

/**
 * キャンバス作成フォーム。一覧ページのインライン作成と /views/new で共有する。
 * space_map（スペース配置）選択時は配置先スペースの選択を要求する。
 */
export function CreateViewForm({ onCreated, redirectBase, onCancel, defaultType }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [viewType, setViewType] = useState(
    // 指定が無ければ先頭（＝いちばんよく使う種別）を選んでおく
    defaultType && (VIEW_TYPES as readonly string[]).includes(defaultType) ? defaultType : VIEW_TYPES[0]
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [spaces, setSpaces] = useState<Space[]>([])
  const [selectedSpaceId, setSelectedSpaceId] = useState('')

  useEffect(() => {
    if (viewType !== 'space_map' || spaces.length > 0) return
    getSpaces()
      .then(setSpaces)
      .catch(() => setError('スペースの取得に失敗しました'))
  }, [viewType, spaces.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('キャンバス名を入力してください')
      return
    }
    if (viewType === 'space_map' && !selectedSpaceId) {
      setError('配置先のスペースを選択してください')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await createView(
        trimmed,
        viewType,
        viewType === 'space_map' ? selectedSpaceId : undefined
      )
      setName('')
      setViewType('freeboard')
      setSelectedSpaceId('')
      onCreated?.(created)
      if (redirectBase) router.push(`${redirectBase}/${created.id}`)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: string[] } } }
      setError(axiosErr?.response?.data?.errors?.[0] ?? 'キャンバスの作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="種別" hint={viewTypeDescription(viewType)}>
        <select
          value={viewType}
          onChange={(e) => setViewType(e.target.value)}
          disabled={submitting}
          aria-label="キャンバスの種別"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {VIEW_TYPES.map((t) => (
            <option key={t} value={t}>
              {viewTypeLabel(t)}
              {IMPLEMENTED_VIEW_TYPES.has(t) ? '' : '（準備中）'}
            </option>
          ))}
        </select>
      </Field>

      {viewType === 'space_map' && (
        <Field label="配置先のスペース" hint="カードを置く場所です。あとから変更できます。">
          <select
            value={selectedSpaceId}
            onChange={(e) => setSelectedSpaceId(e.target.value)}
            disabled={submitting}
            aria-label="配置先のスペース"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">スペースを選択…</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>{s.name}（{spaceTypeLabel(s.space_type)}）</option>
            ))}
          </select>
        </Field>
      )}

      <Field label="名前">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 関係図、学習マップ"
          autoFocus
          disabled={submitting}
          aria-label="キャンバス名"
        />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
            キャンセル
          </Button>
        )}
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? '作成中...' : '作成'}
        </Button>
      </div>
    </form>
  )
}

/**
 * 1 項目分の枠。ラベルを上、操作を下に置いて縦に積む。
 * 横 1 行に詰めると右パネルのような狭い幅で潰れるため、幅に依存しない形にしている。
 */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}
