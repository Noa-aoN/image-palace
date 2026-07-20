'use client'

import { useState } from 'react'
import { ArrowLeftRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateViewEdge, removeViewEdge, type ViewEdgeInput } from '@/lib/api/views'
import { useRightPanelStore } from '@/stores/rightPanel'
import { cn } from '@/lib/utils'
import type { ViewEdge, ViewEdgeStyle, EdgeMarker } from '@/types/view'

const MARKERS: { label: string; value: EdgeMarker }[] = [
  { label: 'なし', value: 'none' },
  { label: '矢印', value: 'arrow' },
]

type SwatchOption = { label: string; value: string; swatch?: string; none?: boolean }

// 線の色（既定＝黒）
const COLORS: SwatchOption[] = [
  { label: '既定（黒）', value: '', swatch: '#1a1a1a' },
  { label: '赤', value: '#e5484d' },
  { label: '青', value: '#3b82f6' },
  { label: '緑', value: '#22a06b' },
  { label: '灰', value: '#8b8b8b' },
]
// ラベル文字色（既定＝黒。白も選べる）
const LABEL_TEXT_COLORS: SwatchOption[] = [
  { label: '既定（黒）', value: '', swatch: '#111111' },
  { label: '白', value: '#ffffff' },
  { label: '赤', value: '#e5484d' },
  { label: '青', value: '#3b82f6' },
  { label: '緑', value: '#22a06b' },
  { label: '灰', value: '#8b8b8b' },
]
// ラベル背景（なし＝透明。蛍光マーカー系の淡色）
const LABEL_BGS: SwatchOption[] = [
  { label: 'なし', value: '', none: true },
  { label: '白', value: '#ffffff' },
  { label: '黒', value: '#111111' },
  { label: '黄', value: '#fde68a' },
  { label: '赤', value: '#e5484d' },
  { label: '青', value: '#3b82f6' },
  { label: '緑', value: '#22a06b' },
]
function toApiInput(c: Partial<ViewEdge>): ViewEdgeInput {
  const out: ViewEdgeInput = {}
  if (c.label !== undefined) out.label = c.label
  if (c.style !== undefined) out.style = c.style ?? {}
  if (c.source !== undefined) out.source_node_id = c.source
  if (c.target !== undefined) out.target_node_id = c.target
  if (c.source_handle !== undefined) out.source_handle = c.source_handle
  if (c.target_handle !== undefined) out.target_handle = c.target_handle
  return out
}

// 選択式の丸スウォッチ列
function Swatches({
  options,
  active,
  onSelect,
}: {
  options: SwatchOption[]
  active: string
  onSelect: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value || 'default'}
          type="button"
          onClick={() => onSelect(o.value)}
          aria-label={o.label}
          className={cn(
            'relative h-7 w-7 overflow-hidden rounded-full border-2 transition-colors',
            active === o.value ? 'border-foreground' : 'border-border'
          )}
          style={{ backgroundColor: o.none ? '#ffffff' : o.swatch ?? o.value ?? 'var(--muted)' }}
        >
          {/* 透明（なし）は斜め線で示す */}
          {o.none && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top right, transparent calc(50% - 1px), #e5484d calc(50% - 1px), #e5484d calc(50% + 1px), transparent calc(50% + 1px))',
              }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

// 数値入力（px / % など単位付き）
function NumberField({
  label,
  value,
  min,
  max,
  unit = 'px',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.round(n))))
          }}
          aria-label={label}
          className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  )
}

// 選択式のセグメントボタン列
function Segmented<T extends string | number>({
  options,
  active,
  onSelect,
}: {
  options: { label: string; value: T }[]
  active: T | undefined
  onSelect: (v: T) => void
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <Button key={String(o.value)} variant={active === o.value ? 'default' : 'outline'} size="sm" onClick={() => onSelect(o.value)}>
          {o.label}
        </Button>
      ))}
    </div>
  )
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
    updateViewEdge(viewId, current.id, toApiInput(changes)).catch(() => {})
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
    })
  const del = () => {
    requestEdgeRemove(current.id)
    removeViewEdge(viewId, current.id).catch(() => {})
    close()
  }

  const s = current.style ?? {}

  return (
    <div className="space-y-6">
      {/* ラベル */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground">ラベル</h3>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={saveLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              saveLabel()
            }
          }}
          placeholder="（なし）"
          aria-label="接続線のラベル"
        />
        <NumberField label="文字サイズ" value={s.label_size ?? 13} min={8} max={48} onChange={(v) => patchStyle({ label_size: v })} />
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">文字色</span>
          <Swatches options={LABEL_TEXT_COLORS} active={s.label_color ?? ''} onSelect={(v) => patchStyle({ label_color: v || undefined })} />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">背景色</span>
          <Swatches options={LABEL_BGS} active={s.label_bg ?? ''} onSelect={(v) => patchStyle({ label_bg: v || undefined })} />
        </div>
        <NumberField label="不透明度" value={s.label_opacity ?? 100} min={0} max={100} unit="%" onChange={(v) => patchStyle({ label_opacity: v })} />
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">向き</span>
          <Segmented
            options={[
              { label: '横書き', value: 'h' },
              { label: '縦書き', value: 'v' },
            ]}
            active={s.label_vertical ? 'v' : 'h'}
            onSelect={(v) => patchStyle({ label_vertical: v === 'v' })}
          />
        </div>
      </section>

      {/* 線 */}
      <section className="space-y-3 border-t border-border pt-4">
        <h3 className="text-xs font-semibold text-muted-foreground">線</h3>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">色</span>
          <Swatches options={COLORS} active={s.color ?? ''} onSelect={(v) => patchStyle({ color: v || undefined })} />
        </div>
        <NumberField label="太さ" value={s.width ?? 2} min={1} max={12} onChange={(v) => patchStyle({ width: v })} />
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">線種</span>
          <Segmented
            options={[
              { label: '実線', value: 'solid' },
              { label: '破線', value: 'dashed' },
            ]}
            active={s.dashed ? 'dashed' : 'solid'}
            onSelect={(v) => patchStyle({ dashed: v === 'dashed' })}
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">始端</span>
          <Segmented options={MARKERS} active={s.marker_start ?? 'none'} onSelect={(v) => patchStyle({ marker_start: v })} />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">終端</span>
          <Segmented options={MARKERS} active={s.marker_end ?? 'arrow'} onSelect={(v) => patchStyle({ marker_end: v })} />
        </div>
        <NumberField label="不透明度" value={s.opacity ?? 100} min={0} max={100} unit="%" onChange={(v) => patchStyle({ opacity: v })} />
      </section>

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
