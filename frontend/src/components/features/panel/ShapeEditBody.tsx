'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRightPanelStore } from '@/stores/rightPanel'
import type { BoardShape, BoardShapeStyle } from '@/types/view'

/**
 * 図形の色は**選ばせる**。自由に選ばせない。
 *
 * 自由な色をひとつずつ選ばせると、盤の上で色が散らかる。
 * 少ない数から選ぶほうが、図として揃って見える。
 */
const FILLS: { value: string | null; label: string }[] = [
  { value: null, label: 'なし' },
  { value: '#FFF3B0', label: '黄' },
  { value: '#FFD6D6', label: '赤' },
  { value: '#D6E9FF', label: '青' },
  { value: '#D8F3D8', label: '緑' },
  { value: '#EDE4FF', label: '紫' },
  { value: '#F0F0F0', label: '灰' },
]

const STROKES: { value: string | null; label: string }[] = [
  { value: null, label: 'なし' },
  { value: '#333333', label: '濃' },
  { value: '#999999', label: '薄' },
]

const ALIGNS: { value: NonNullable<BoardShapeStyle['align']>; label: string }[] = [
  { value: 'left', label: '左' },
  { value: 'center', label: '中央' },
  { value: 'right', label: '右' },
]

/**
 * 右パネル: 図形の編集。
 *
 * 文字は**入れながら見える**ようにする（打ってから反映を待たせない）。
 * 保存は入力が止まってからで、押しっぱなしのたびには送らない。
 */
export function ShapeEditBody({
  shape,
  onChange,
  onRemove,
}: {
  shape: BoardShape
  onChange: (patch: { text?: string | null; style?: BoardShapeStyle }) => void
  onRemove: () => void
}) {
  const close = useRightPanelStore((s) => s.close)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const style = shape.style

  const isText = shape.kind === 'text'
  const isFrame = shape.kind === 'frame'

  return (
    <div className="space-y-5">
      {/* かこみの文字は見出しとして枠の外に出る。用途が違うので言い方を変える */}
      <div className="space-y-1.5">
        <Label htmlFor="shape-text">{isFrame ? '見出し' : '文字'}</Label>
        <Input
          id="shape-text"
          value={shape.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={isFrame ? '例: 前半のできごと' : '入れなくてもよい'}
        />
      </div>

      {/* 文字だけの図形は、塗りも枠も持たない（持たせると毎回消す手間が要る） */}
      {!isText && (
        <>
          <div className="space-y-2">
            <Label>塗り</Label>
            <div className="flex flex-wrap gap-1.5">
              {FILLS.map((fill) => (
                <Swatch
                  key={fill.label}
                  color={fill.value}
                  label={fill.label}
                  active={(style.fill ?? null) === fill.value}
                  onClick={() => onChange({ style: { fill: fill.value ?? undefined } })}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>枠</Label>
            <div className="flex flex-wrap gap-1.5">
              {STROKES.map((stroke) => (
                <Swatch
                  key={stroke.label}
                  color={stroke.value}
                  label={stroke.label}
                  active={(style.stroke ?? null) === stroke.value}
                  onClick={() =>
                    onChange({
                      style: { stroke: stroke.value ?? undefined, stroke_width: stroke.value ? 2 : 0 },
                    })
                  }
                />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label>文字の大きさ</Label>
        <Input
          type="number"
          min={8}
          max={96}
          value={style.font_size ?? 15}
          onChange={(e) => onChange({ style: { font_size: Number(e.target.value) } })}
          className="w-24"
        />
      </div>

      {!isFrame && (
        <div className="space-y-2">
          <Label>文字の寄せ</Label>
          <div className="flex gap-1.5">
            {ALIGNS.map((align) => (
              <Button
                key={align.value}
                size="sm"
                variant={(style.align ?? 'left') === align.value ? 'default' : 'outline'}
                onClick={() => onChange({ style: { align: align.value } })}
              >
                {align.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <Button
          size="sm"
          variant={confirmRemove ? 'destructive' : 'outline'}
          onClick={() => {
            if (!confirmRemove) {
              setConfirmRemove(true)
              return
            }
            onRemove()
            close()
          }}
          onBlur={() => setConfirmRemove(false)}
          className="flex items-center gap-1.5"
        >
          <Trash2 size={14} />
          {confirmRemove ? '本当に消す' : 'この図形を消す'}
        </Button>
      </div>
    </div>
  )
}

/** 色見本。**「なし」も同じ形で並べる**（別の見た目にすると、選べることが読めない） */
function Swatch({
  color,
  label,
  active,
  onClick,
}: {
  color: string | null
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`h-8 w-8 rounded-md border text-2xs transition-colors ${
        active ? 'border-[var(--palace)] ring-2 ring-[var(--palace)]/30' : 'border-border'
      }`}
      style={color ? { backgroundColor: color } : undefined}
    >
      {color ? '' : label}
    </button>
  )
}
