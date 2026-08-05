'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings'
import {
  WORD_DIFFICULTIES,
  WORD_DIFFICULTY_LABELS,
  WORD_DIFFICULTY_DESCRIPTIONS,
  normalizeWordDifficulty,
  type WordDifficulty,
} from '@/lib/word-difficulty'

/**
 * 単語を作ってもらうときの、既定の難しさ。
 *
 * アクロポリスとデルフォイの初期値になる。
 * 同じ水準の語ばかり出ると使い道が狭まるので、学ぶ段階に合わせて選べるようにする。
 * アクロポリス側ではその場で変えられるので、ここは「いつもの設定」にあたる。
 */
export function WordDifficultySetting() {
  const settings = useSettingsStore((s) => s.settings)
  const patchSettings = useSettingsStore((s) => s.patchSettings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = normalizeWordDifficulty(settings?.word_difficulty)

  const change = async (value: WordDifficulty) => {
    if (saving || value === current) return
    setSaving(true)
    setError(null)
    try {
      await patchSettings({ word_difficulty: value })
    } catch {
      setError('保存できませんでした')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">単語の難しさ</p>
      <p className="text-xs text-muted-foreground">
        アクロポリスやデルフォイで単語を作ってもらうときの既定です。
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {WORD_DIFFICULTIES.map((level) => {
          const active = current === level
          return (
            <button
              key={level}
              type="button"
              onClick={() => change(level)}
              disabled={saving}
              aria-pressed={active}
              className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${
                active ? 'border-[var(--palace)] bg-[var(--palace)]/10' : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <span className="text-sm font-medium">{WORD_DIFFICULTY_LABELS[level]}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {WORD_DIFFICULTY_DESCRIPTIONS[level]}
              </span>
            </button>
          )
        })}
      </div>
      {saving && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
