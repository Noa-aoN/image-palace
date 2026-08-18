'use client'

import { useState } from 'react'
import { ArrowLeftRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateViewEdge, removeViewEdge, type ViewEdgeInput } from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import { EdgeStyleControls } from './EdgeStyleControls'
import type { ViewEdge, ViewEdgeStyle } from '@/types/view'
import { isSubmitEnter } from '@/lib/enter-key'
import { persist } from '@/lib/api/persist'

function toApiInput(c: Partial<ViewEdge>): ViewEdgeInput {
  const out: ViewEdgeInput = {}
  if (c.label !== undefined) out.label = c.label
  if (c.style !== undefined) out.style = c.style ?? {}
  if (c.source !== undefined) out.source_node_id = c.source
  if (c.target !== undefined) out.target_node_id = c.target
  if (c.source_handle !== undefined) out.source_handle = c.source_handle
  if (c.target_handle !== undefined) out.target_handle = c.target_handle
  if (c.points !== undefined) out.points = c.points ?? []
  return out
}

// 右パネル: 接続線の編集（ラベル＋そのスタイル・線の色/太さ/線種・向き反転・削除）。
export function EdgePropertiesBody({ viewId }: { viewId: string }) {
  const edge = useRightPanelStore((s) => s.edge)
  const requestEdgePatch = useRightPanelStore((s) => s.requestEdgePatch)
  const requestEdgeRemove = useRightPanelStore((s) => s.requestEdgeRemove)
  const close = useRightPanelStore((s) => s.close)

  // 別の edge を開くと親が key を変えて再マウントするので、初期値は useState で十分。
  const [current, setCurrent] = useState<ViewEdge | null>(edge)
  const [label, setLabel] = useState(edge?.label ?? '')

  if (!current) return null

  const applyPatch = (changes: Partial<ViewEdge>) => {
    setCurrent((c) => (c ? { ...c, ...changes } : c))
    requestEdgePatch(current.id, changes)
    persist(() => updateViewEdge(viewId, current.id, toApiInput(changes)))
  }

  // style は毎回フルで送る（jsonb 全体を置換するため、既存フィールドを保持してマージ）
  const patchStyle = (partial: Partial<ViewEdgeStyle>) =>
    applyPatch({ style: { ...(current.style ?? {}), ...partial } })

  const saveLabel = () => {
    const v = label.trim()
    if ((current.label ?? '') === v) return
    applyPatch({ label: v || null })
  }
  const reverse = () =>
    applyPatch({
      source: current.target,
      target: current.source,
      source_handle: current.target_handle ?? null,
      target_handle: current.source_handle ?? null,
      points: [...(current.points ?? [])].reverse(),
    })
  const del = () => {
    requestEdgeRemove(current.id)
    persist(() => removeViewEdge(viewId, current.id))
    close()
  }

  return (
    <div className="space-y-6">
      <EdgeStyleControls
        value={current.style ?? {}}
        onChange={patchStyle}
        labelSlot={
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => {
              if (isSubmitEnter(e)) {
                e.preventDefault()
                saveLabel()
              }
            }}
            placeholder="（なし）"
            aria-label="接続線のラベル"
          />
        }
      />

      <section className="space-y-2 border-t border-border pt-4">
        <Button variant="outline" size="sm" onClick={reverse} className="flex w-full items-center justify-center gap-1.5">
          <ArrowLeftRight size={14} />
          向きを反転
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={del}
          className="flex w-full items-center justify-center gap-1.5 text-destructive hover:text-destructive"
        >
          <Trash2 size={14} />
          接続線を削除
        </Button>
      </section>
    </div>
  )
}
