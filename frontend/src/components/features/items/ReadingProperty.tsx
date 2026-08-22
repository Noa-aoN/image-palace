'use client'

import { useState } from 'react'
import { Check, Pencil, Plus, X } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { BlockAction, BlockEmpty, BlockError } from '@/components/features/items/PropertyBlock'
import { useSettingsStore } from '@/stores/settings'
import { languageLabel, otherReadings, primaryReading } from '@/lib/items/reading'
import type { ReadingValue } from '@/lib/api/properties'

/**
 * 言語ごとの読み方。**1つの項目の中に並びで持つ。**
 *
 * 言語ごとに別の項目を作る形にすると、1種別に置ける数の枠を言語の数だけ食うし、
 * 基本の言語を変えても何も起きない。
 *
 * ここでは**どれを主として出すかだけ**が基本の言語で決まる。値は動かさないので、
 * 言語を戻せば見え方もそのまま戻る。
 */
export function ReadingProperty({
  value,
  onSave,
}: {
  value: ReadingValue
  onSave: (next: ReadingValue) => Promise<void>
}) {
  const locale = useSettingsStore((s) => s.settings?.locale)
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<ReadingValue>(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const primary = primaryReading(value, locale)
  const others = otherReadings(value, locale)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave(rows.filter((r) => r.language.trim() && r.text.trim()))
      setEditing(false)
    } catch {
      setError('保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="space-y-1.5">
        {primary ? (
          <>
            {/* **主のものを大きく。** 残りは添える。
                どれが「いまの言語での読み」かが、並びを読まなくても分かる */}
            <p className="text-sm">
              {primary.text}
              <span className="ml-2 text-xs text-muted-foreground">
                {languageLabel(primary.language)}
              </span>
            </p>
            {others.length > 0 && (
              <ul className="space-y-0.5">
                {others.map((row) => (
                  <li key={row.language} className="text-xs text-muted-foreground">
                    {row.text}
                    <span className="ml-2">{languageLabel(row.language)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <BlockEmpty>未設定</BlockEmpty>
        )}
        <BlockAction
          icon={<Pencil size={14} />}
          label={primary ? '書き直す' : '書く'}
          onClick={() => {
            setRows(value.length > 0 ? value : [{ language: locale ?? 'ja', text: '' }])
            setEditing(true)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              value={row.language}
              onChange={(e) =>
                setRows(rows.map((r, j) => (i === j ? { ...r, language: e.target.value } : r)))
              }
              placeholder="ja"
              aria-label="言語"
              className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm"
            />
            <input
              value={row.text}
              onChange={(e) =>
                setRows(rows.map((r, j) => (i === j ? { ...r, text: e.target.value } : r)))
              }
              placeholder="読み方"
              aria-label="読み方"
              className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
              aria-label="この行を消す"
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <BlockAction
          icon={<Plus size={14} />}
          label="言語を足す"
          onClick={() => setRows([...rows, { language: '', text: '' }])}
        />
        <BlockAction icon={<Check size={14} />} label="保存" onClick={save} busy={saving} />
        <BlockAction
          icon={<X size={14} />}
          label="やめる"
          onClick={() => {
            setRows(value)
            setEditing(false)
          }}
        />
        {saving && <Spinner size={14} className="text-muted-foreground" />}
      </div>

      {/* **こちらが並べた一覧に無い言語も書ける。** 学ぶ言語は人によって違う */}
      <p className="text-xs text-muted-foreground">
        言語は <code>ja</code> <code>en</code> のような綴りで書きます。
        いま主に出るのは、環境設定で選んでいる言語のものです。
      </p>

      <BlockError message={error} />
    </div>
  )
}
