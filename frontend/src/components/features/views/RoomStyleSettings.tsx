'use client'

import type { RoomStyleOverrides } from '@/types/space'
import { ROOM_STYLE_PRESETS, ROOM_STYLE_KEYS, resolveRoomStyle, type RoomStyleKey, type RoomStyle } from '@/lib/room-style'

// 調整できる面。プリセット4色を選ぶか、右端の丸から自由に指定する。
// 稜線・枠はプリセットに任せる（項目を増やすと選ぶのが難しくなるため）。
type Field = { key: keyof RoomStyleOverrides; label: string; from: keyof Pick<RoomStyle, 'floor' | 'wall' | 'ceiling' | 'background' | 'gridLine'> }
const FIELDS: Field[] = [
  { key: 'floor_color', label: '床', from: 'floor' },
  { key: 'wall_color', label: '壁', from: 'wall' },
  { key: 'ceiling_color', label: '天井', from: 'ceiling' },
  { key: 'background_color', label: '部屋の外', from: 'background' },
  { key: 'grid_color', label: 'グリッド', from: 'gridLine' },
]

const sameColor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

type Props = {
  roomStyle: string
  overrides: RoomStyleOverrides | undefined
  onChange: (patch: { room_style?: string; style_overrides?: RoomStyleOverrides }) => void
}

export function RoomStyleSettings({ roomStyle, overrides, onChange }: Props) {
  // 古いレスポンスなどで欠けていても落とさない（ここで例外を投げると設定欄ごと消える）
  const safeOverrides = overrides ?? {}
  const resolved = resolveRoomStyle({ room_style: roomStyle, style_overrides: safeOverrides })
  const hasOverrides = Object.keys(safeOverrides).length > 0

  const setOverride = (key: keyof RoomStyleOverrides, value: string | number | boolean) => {
    onChange({ style_overrides: { ...safeOverrides, [key]: value } })
  }

  return (
    <div className="mt-2 space-y-3">
      {/* 配色セット（まとめて切り替え） */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">配色セット</span>
        {ROOM_STYLE_KEYS.map((key: RoomStyleKey) => {
          const preset = ROOM_STYLE_PRESETS[key]
          const active = roomStyle === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ room_style: key, style_overrides: {} })}
              aria-pressed={active}
              title={preset.description}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                active ? 'border-foreground/40 bg-background font-medium' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      {/* 面ごとの色。プリセット4色から選ぶか、右端の丸で自由に指定する */}
      <div className="space-y-1.5">
        {FIELDS.map((f) => {
          const current = resolved[f.from]
          const isCustom = !ROOM_STYLE_KEYS.some((k) => sameColor(ROOM_STYLE_PRESETS[k].style[f.from], current))
          return (
            <div key={f.key} className="space-y-1 text-xs">
              <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{f.label}</span>
                <span className="tabular-nums">{current}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
              {ROOM_STYLE_KEYS.map((k) => {
                const color = ROOM_STYLE_PRESETS[k].style[f.from]
                const active = sameColor(color, current)
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setOverride(f.key, color)}
                    aria-label={`${f.label}を${ROOM_STYLE_PRESETS[k].label}の色にする`}
                    aria-pressed={active}
                    title={ROOM_STYLE_PRESETS[k].label}
                    className={`h-6 w-6 shrink-0 rounded-full border transition-shadow ${
                      active ? 'border-foreground ring-2 ring-foreground/25' : 'border-black/15 hover:border-foreground/40'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                )
              })}
              {/* 自由指定（クリックで OS のカラーピッカー） */}
              <label
                className={`relative h-6 w-6 shrink-0 cursor-pointer rounded-full border ${
                  isCustom ? 'border-foreground ring-2 ring-foreground/25' : 'border-dashed border-foreground/40'
                }`}
                style={{ backgroundColor: isCustom ? current : 'transparent' }}
                title="自由に選ぶ"
              >
                {!isCustom && (
                  <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] leading-none text-muted-foreground">
                    +
                  </span>
                )}
                <input
                  type="color"
                  value={current}
                  onChange={(e) => setOverride(f.key, e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={`${f.label}の色を自由に指定`}
                />
              </label>
              </div>
            </div>
          )
        })}

        {/* グリッドは色に加えて 表示/濃さ も持つ */}
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={resolved.gridVisible}
              onChange={(e) => setOverride('grid_visible', e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--palace)]"
            />
            <span className="text-muted-foreground">表示</span>
          </label>
          <input
            type="range"
            min={0.05}
            max={0.5}
            step={0.01}
            value={resolved.gridOpacity}
            onChange={(e) => setOverride('grid_opacity', Number(e.target.value))}
            disabled={!resolved.gridVisible}
            className="flex-1 accent-[var(--palace)] disabled:opacity-40"
            aria-label="床グリッドの濃さ"
          />
          <span className="w-9 shrink-0 text-right tabular-nums">{Math.round(resolved.gridOpacity * 100)}%</span>
        </div>
      </div>

      {hasOverrides && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onChange({ style_overrides: {} })}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            配色セットの色に戻す
          </button>
        </div>
      )}
    </div>
  )
}
