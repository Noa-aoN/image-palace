'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getSettings, updateSettings } from '@/lib/api/settings'
import { useSettingsStore } from '@/stores/settings'
import {
  DISPLAY_STYLES,
  DISPLAY_STYLE_KEYS,
  DEFAULT_DISPLAY_STYLE,
  type DisplayStyle,
} from '@/lib/display-style'

/**
 * 新規登録後の初回アクセスで、一覧の見せ方を一度だけ確認する。
 *
 * オンボーディングは今後広げる予定（最低限のステップ表示、ミッション達成の案内など）。
 * その入口をここに集約できるよう、表示条件の判定と保存だけを持つ独立部品にしている。
 * 判定は設定の onboarded で行い、一度選んだら再表示しない。
 */
export function DisplayStyleOnboarding() {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<DisplayStyle>(DEFAULT_DISPLAY_STYLE)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    getSettings()
      .then((s) => {
        if (!alive || s.onboarded) return
        setChoice((s.display_style as DisplayStyle) || DEFAULT_DISPLAY_STYLE)
        setOpen(true)
      })
      .catch(() => {
        // 設定が取れないときは何も出さない（初回体験を邪魔しない）
      })
    return () => {
      alive = false
    }
  }, [])

  if (!open) return null

  const decide = async () => {
    setSaving(true)
    try {
      await updateSettings({ display_style: choice, onboarded: true })
      // 共有ストアにも反映して、閉じた直後の画面から選んだ見せ方で描く
      await useSettingsStore.getState().fetchSettings()
    } catch {
      // 保存に失敗しても閉じる。設定画面からいつでも変更できる
    } finally {
      setOpen(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="表示スタイルの選択"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-6"
    >
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">一覧の見せ方を選んでください</h2>
          <p className="text-sm text-muted-foreground">
            あとから環境設定でいつでも変更できます。
          </p>
        </div>

        <div className="space-y-2">
          {DISPLAY_STYLE_KEYS.map((key) => {
            const opt = DISPLAY_STYLES[key]
            const active = choice === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setChoice(key)}
                aria-pressed={active}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  active ? 'border-[var(--palace)] bg-[var(--palace)]/10' : 'border-border hover:bg-muted'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {opt.label}
                  {key === DEFAULT_DISPLAY_STYLE && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      おすすめ
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{opt.description}</span>
              </button>
            )
          })}
        </div>

        <Button onClick={decide} disabled={saving} className="w-full">
          この見せ方ではじめる
        </Button>
      </div>
    </div>
  )
}
