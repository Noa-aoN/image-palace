'use client'

import { Button } from '@/components/ui/button'
import { updateView } from '@/lib/api/views'
import { useBoardSettingsStore } from '@/stores/boardSettings'
import { useRightPanelStore } from '@/stores/rightPanel'
import { cn } from '@/lib/utils'
import type { BoardSettings } from '@/types/view'

const BG_COLORS = [
  { label: '既定（白系）', value: '' },
  { label: 'クリーム', value: '#f4efe6' },
  { label: '純白', value: '#ffffff' },
  { label: 'グレー', value: '#e9e9ec' },
  { label: 'ダーク', value: '#2a2a2e' },
  { label: '黒板', value: '#2f4030' },
]
const PATTERNS: { label: string; value: NonNullable<BoardSettings['bg_pattern']> }[] = [
  { label: 'ドット', value: 'dots' },
  { label: 'グリッド', value: 'grid' },
  { label: '無地', value: 'none' },
]
const PATTERN_COLORS = [
  { label: '白', value: '#ffffff' },
  { label: 'グレー', value: '#c9c9cf' },
  { label: 'ゴールド', value: '#c6a75e' },
  { label: 'ダーク', value: '#555555' },
]

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--palace)]"
      />
    </label>
  )
}

// 右パネル: フリーボード全体の設定（背景色・背景模様・カード文字サイズ・表示トグル）。
export function BoardSettingsBody() {
  const viewId = useRightPanelStore((s) => s.viewId)
  const settings = useBoardSettingsStore((s) => s.settings)
  const setSettings = useBoardSettingsStore((s) => s.setSettings)

  if (!viewId) return null

  // 即時反映（store）＋永続化（settings jsonb 全体を送る）
  const patch = (partial: Partial<BoardSettings>) => {
    setSettings(partial)
    updateView(viewId, { settings: { ...settings, ...partial } }).catch(() => {})
  }

  const pattern = settings.bg_pattern ?? 'dots'
  const bgColor = settings.bg_color ?? ''

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground">背景色</h3>
        <div className="flex flex-wrap gap-2">
          {BG_COLORS.map((c) => (
            <button
              key={c.value || 'default'}
              type="button"
              onClick={() => patch({ bg_color: c.value || undefined })}
              aria-label={c.label}
              className={cn('h-7 w-7 rounded-full border-2', bgColor === c.value ? 'border-foreground' : 'border-border')}
              style={{ backgroundColor: c.value || 'var(--board-bg)' }}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground">背景模様</h3>
        <div className="flex gap-2">
          {PATTERNS.map((p) => (
            <Button
              key={p.value}
              variant={pattern === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => patch({ bg_pattern: p.value })}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {pattern !== 'none' && (
          <div className="space-y-1.5 pt-1">
            <span className="text-xs text-muted-foreground">模様の色</span>
            <div className="flex flex-wrap gap-2">
              {PATTERN_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => patch({ pattern_color: c.value })}
                  aria-label={c.label}
                  className={cn(
                    'h-6 w-6 rounded-full border-2',
                    (settings.pattern_color ?? '#ffffff') === c.value ? 'border-foreground' : 'border-border'
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <h3 className="text-xs font-semibold text-muted-foreground">カード</h3>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">単語の文字サイズ</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={8}
              max={32}
              value={settings.card_font_size ?? 12}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) patch({ card_font_size: Math.max(8, Math.min(32, Math.round(n))) })
              }}
              aria-label="カードの単語文字サイズ"
              className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
        </div>

        {/* 縦横比の違うカードが並ぶと、切り取りのせいで見えている範囲がまちまちになる */}
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">画像の見せ方</span>
          <div className="flex gap-1.5">
            {[
              { value: 'cover' as const, label: '埋める', hint: 'カードいっぱいに広げ、はみ出す分は切り取る' },
              { value: 'contain' as const, label: '全景', hint: '切り取らずに全体を収める（見える範囲が揃う）' },
            ].map((option) => {
              const active = (settings.card_image_fit ?? 'cover') === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  title={option.hint}
                  aria-pressed={active}
                  onClick={() => patch({ card_image_fit: option.value })}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                    active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                  style={active ? { backgroundColor: 'var(--palace)' } : undefined}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {(settings.card_image_fit ?? 'cover') === 'contain'
              ? '切り取らずに全体を収めます。カードの大きさが違っても見える範囲が揃います。'
              : 'カードいっぱいに広げます。縦横比が違うカードでは切り取られる範囲が変わります。'}
          </p>
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <h3 className="text-xs font-semibold text-muted-foreground">表示</h3>
        <ToggleRow label="ミニマップ" checked={settings.minimap !== false} onChange={(v) => patch({ minimap: v })} />
        <ToggleRow label="操作パネル" checked={settings.controls !== false} onChange={(v) => patch({ controls: v })} />
      </section>
    </div>
  )
}
