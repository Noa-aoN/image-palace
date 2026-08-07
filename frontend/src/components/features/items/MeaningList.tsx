'use client'

import { useState, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BlockEmpty, BlockError } from '@/components/features/items/PropertyBlock'
import { Tooltip } from '@/components/ui/tooltip'
import {
  MEANING_LEVELS,
  meaningLevelLabel,
  DEFAULT_MEANING_LEVEL,
  MEANING_LANGUAGES,
  DEFAULT_MEANING_LANGUAGE,
  meaningLanguageLabel,
} from '@/lib/meaning-levels'
import { createMeaning, updateMeaning, deleteMeaning, reorderMeanings, getItem } from '@/lib/api/items'
import type { Item, ItemMeaning } from '@/types/item'

/**
 * 1枚のカードが持つ意味・説明の一覧。
 *
 * 多義語（アポロ＝神／宇宙計画）、分野で意味が変わる語、言語ごとの訳は、
 * 1件では書き切れない。器（has_many）は前からあったので、出すだけ。
 *
 * **先頭が代表**。画像生成・ファクトチェック・一覧の表示はどれも代表を見るので、
 * 「どれが効くのか」が並び順で分かるようにしてある。並べ替えで入れ替えられる。
 */
export function MeaningList({
  item,
  onUpdated,
  primaryExtra,
}: {
  item: Item
  onUpdated: (item: Item) => void
  /** 代表の1件の下に差し込むもの（ファクトチェックの結果） */
  primaryExtra?: ReactNode
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [exampleDraft, setExampleDraft] = useState('')
  const [levelDraft, setLevelDraft] = useState<string>(DEFAULT_MEANING_LEVEL)
  const [languageDraft, setLanguageDraft] = useState<string>(DEFAULT_MEANING_LANGUAGE)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entries = item.meanings

  // カードを取り直して親へ渡す。1件ぶんの差分を自前で当てると、
  // 代表が入れ替わったときに meaning / meaning_level とずれる
  const refresh = async () => onUpdated(await getItem(item.id))

  const startAdd = () => {
    setEditingId(null)
    setAdding(true)
    setDraft('')
    setExampleDraft('')
    setLevelDraft(DEFAULT_MEANING_LEVEL)
    setLanguageDraft(DEFAULT_MEANING_LANGUAGE)
    setError(null)
  }

  const startEdit = (entry: ItemMeaning) => {
    setAdding(false)
    setEditingId(entry.id)
    setDraft(entry.definition)
    setExampleDraft(entry.example_sentence ?? '')
    setLevelDraft(entry.detail_level)
    setLanguageDraft(entry.language_code)
    setError(null)
  }

  const cancel = () => {
    setAdding(false)
    setEditingId(null)
    setError(null)
  }

  const save = async () => {
    if (!draft.trim()) return setError('説明を入力してください')

    setSaving(true)
    setError(null)
    try {
      const payload = {
        definition: draft.trim(),
        example_sentence: exampleDraft.trim() || null,
        detail_level: levelDraft,
        language_code: languageDraft,
      }
      if (editingId) await updateMeaning(item.id, editingId, payload)
      else await createMeaning(item.id, payload)
      await refresh()
      cancel()
    } catch {
      setError('保存できませんでした。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (entry: ItemMeaning) => {
    setBusyId(entry.id)
    setError(null)
    try {
      await deleteMeaning(item.id, entry.id)
      await refresh()
    } catch {
      setError('削除できませんでした。もう一度お試しください。')
    } finally {
      setBusyId(null)
    }
  }

  // 隣と入れ替える。まとめて position を振り直すので、途中で失敗しても順序が壊れない
  const move = async (index: number, direction: -1 | 1) => {
    if (!entries) return
    const next = index + direction
    if (next < 0 || next >= entries.length) return

    const ids = entries.map((e) => e.id)
    ;[ids[index], ids[next]] = [ids[next], ids[index]]

    setBusyId(entries[index].id)
    setError(null)
    try {
      await reorderMeanings(item.id, ids)
      await refresh()
    } catch {
      setError('並び替えられませんでした。もう一度お試しください。')
    } finally {
      setBusyId(null)
    }
  }

  // 一覧を持たない応答（古いキャッシュ）でも、代表だけは読めるようにしておく
  if (!entries) {
    return item.meaning ? (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{item.meaning}</p>
    ) : (
      <BlockEmpty>未設定（「AIで生成」から追加できます）</BlockEmpty>
    )
  }

  return (
    <div className="space-y-2">
      {entries.length === 0 && !adding && (
        <BlockEmpty>未設定（「AIで生成」または「追加」から書けます）</BlockEmpty>
      )}

      {entries.map((entry, index) => (
        <div key={entry.id} className="rounded-lg border border-border/70 bg-background px-3 py-2">
          {editingId === entry.id ? (
            <Editor
              draft={draft}
              onDraft={setDraft}
              example={exampleDraft}
              onExample={setExampleDraft}
              level={levelDraft}
              onLevel={setLevelDraft}
              language={languageDraft}
              onLanguage={setLanguageDraft}
              saving={saving}
              onSave={save}
              onCancel={cancel}
            />
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {index === 0 && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{ backgroundColor: 'rgba(198,167,94,0.15)', color: '#7a6432' }}
                      title="画像生成・ファクトチェック・一覧の表示はこの1件を使います"
                    >
                      代表
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {meaningLevelLabel(entry.detail_level)}
                    {entry.language_code !== DEFAULT_MEANING_LANGUAGE &&
                      ` / ${meaningLanguageLabel(entry.language_code)}`}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                  {busyId === entry.id ? (
                    <Spinner size={14} />
                  ) : (
                    <>
                      <IconButton label="上へ" disabled={index === 0} onClick={() => move(index, -1)}>
                        <ChevronUp size={15} />
                      </IconButton>
                      <IconButton
                        label="下へ"
                        disabled={index === entries.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ChevronDown size={15} />
                      </IconButton>
                      <IconButton label="編集" onClick={() => startEdit(entry)}>
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton label="削除" onClick={() => remove(entry)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </>
                  )}
                </div>
              </div>

              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{entry.definition}</p>
              {entry.example_sentence && (
                <p className="border-l-2 border-border pl-2 text-xs leading-relaxed text-muted-foreground">
                  例: {entry.example_sentence}
                </p>
              )}
              {index === 0 && primaryExtra}
            </div>
          )}
        </div>
      ))}

      {adding && (
        <div className="rounded-lg border border-border/70 bg-background px-3 py-2">
          <Editor
            draft={draft}
            onDraft={setDraft}
            example={exampleDraft}
            onExample={setExampleDraft}
            level={levelDraft}
            onLevel={setLevelDraft}
            language={languageDraft}
            onLanguage={setLanguageDraft}
            saving={saving}
            onSave={save}
            onCancel={cancel}
          />
        </div>
      )}

      {!adding && editingId === null && (
        <button
          type="button"
          onClick={startAdd}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus size={14} />
          意味・説明を追加
        </button>
      )}

      <BlockError message={error} />
    </div>
  )
}

function Editor({
  draft,
  onDraft,
  example,
  onExample,
  level,
  onLevel,
  language,
  onLanguage,
  saving,
  onSave,
  onCancel,
}: {
  draft: string
  onDraft: (v: string) => void
  example: string
  onExample: (v: string) => void
  level: string
  onLevel: (v: string) => void
  language: string
  onLanguage: (v: string) => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-2">
      <textarea
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        disabled={saving}
        autoFocus
        rows={3}
        placeholder="このカードの意味や説明"
        className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <input
        value={example}
        onChange={(e) => onExample(e.target.value)}
        disabled={saving}
        placeholder="例文（任意）"
        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">詳しさ:</span>
        {MEANING_LEVELS.map((lv) => {
          const active = level === lv
          return (
            <button
              key={lv}
              type="button"
              onClick={() => onLevel(lv)}
              disabled={saving}
              aria-pressed={active}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-50 ${
                active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
              style={active ? { backgroundColor: 'var(--palace)' } : undefined}
            >
              {meaningLevelLabel(lv)}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">言語:</span>
        <select
          value={language}
          onChange={(e) => onLanguage(e.target.value)}
          disabled={saving}
          aria-label="言語"
          className="h-7 rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {MEANING_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={saving} className="flex items-center gap-1.5">
          {saving ? <Spinner size={14} /> : <Check size={14} />}
          保存
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="flex items-center gap-1.5">
          <X size={14} />
          キャンセル
        </Button>
      </div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="transition-colors hover:text-foreground disabled:opacity-30"
      >
        {children}
      </button>
    </Tooltip>
  )
}
