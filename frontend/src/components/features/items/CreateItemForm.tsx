'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { createItem } from '@/lib/api/items'
import { useItemsStore } from '@/stores/items'
import { STYLE_OPTIONS, CUSTOM_PROMPT_MAX_LENGTH } from '@/lib/item-styles'

const MAX_TITLE_LENGTH = 100

function parseTitles(raw: string): string[] {
  return raw
    .split(/[\n,、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function CreateItemForm() {
  const router = useRouter()
  const upsertItem = useItemsStore((state) => state.upsertItem)
  const [input, setInput] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [style, setStyle] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [forceGenerate, setForceGenerate] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const titles = parseTitles(input)
  const wordCount = titles.length
  const hasTooLongTitle = titles.some((t) => t.length > MAX_TITLE_LENGTH)
  const tagNames = tagsInput.split(/[\s,、]+/).map((s) => s.trim()).filter(Boolean)

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (titles.length === 0) return
    if (hasTooLongTitle) {
      setApiError(`1単語あたり${MAX_TITLE_LENGTH}文字以内で入力してください。`)
      return
    }
    setApiError(null)
    setSubmitting(true)
    setProgress({ done: 0, total: titles.length })

    try {
      for (let i = 0; i < titles.length; i++) {
        const item = await createItem(titles[i], forceGenerate, tagNames.length ? tagNames : undefined, {
          style: style || undefined,
          customPrompt: customPrompt.trim() || undefined,
        })
        upsertItem(item)
        setProgress({ done: i + 1, total: titles.length })
      }
      router.push('/items')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; errors?: string[] } } }
      const msg =
        axiosErr?.response?.data?.error ??
        axiosErr?.response?.data?.errors?.[0] ??
        'カードの作成に失敗しました。もう一度試してください。'
      setApiError(msg)
    } finally {
      setSubmitting(false)
      setProgress(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="titles" required>単語・概念を入力</Label>
        <div className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
          <p>具体的な名詞や場面が思い浮かぶ言葉ほど、画像化に成功しやすいです。</p>
          <p>例: <span className="font-medium text-foreground">富士山 / API / 光合成 / 細胞分裂</span></p>
        </div>
        <textarea
          id="titles"
          className="w-full min-h-[180px] rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          placeholder={"photosynthesis\nAPI\nmitosis\n\n改行・カンマ区切りで複数入力できます"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitting}
        />
        {wordCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {wordCount}件の単語を認識しました
          </p>
        )}
        {wordCount === 0 && (
          <p className="text-xs text-muted-foreground">
            抽象的すぎる語や意味のない文字列は失敗しやすいため、まずは具体的な単語から試してください。
          </p>
        )}
        {hasTooLongTitle && (
          <p className="text-xs text-destructive">
            1単語あたり{MAX_TITLE_LENGTH}文字を超えています。区切り直すか短くしてください。
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">タグ（任意）</Label>
        <input
          id="tags"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          disabled={submitting}
          placeholder="スペース区切りで入力（例: 英語 IT）"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {tagNames.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {tagNames.length}個のタグを、作成するすべてのカードに付与します
          </p>
        )}
      </div>

      {/* スタイル（プリセット） */}
      <div className="space-y-2">
        <Label>スタイル（任意）</Label>
        <div className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map((opt) => {
            const active = style === opt.value
            return (
              <button
                key={opt.value || 'default'}
                type="button"
                onClick={() => setStyle(opt.value)}
                disabled={submitting}
                className={`rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
                  active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
                }`}
                style={active ? { backgroundColor: 'var(--palace)' } : undefined}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">作成するすべてのカードに同じスタイルが適用されます。</p>
      </div>

      {/* カスタム指示（自由入力） */}
      <div className="space-y-2">
        <Label htmlFor="custom-prompt">追加の指示（任意）</Label>
        <input
          id="custom-prompt"
          type="text"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          disabled={submitting}
          maxLength={CUSTOM_PROMPT_MAX_LENGTH}
          placeholder="例: 背景は白、やさしい色合いで"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">プロンプトに追記され、画像の雰囲気を調整できます。</p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-input"
          checked={forceGenerate}
          onChange={(e) => setForceGenerate(e.target.checked)}
          disabled={submitting}
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium">既存キャッシュを使わずに生成する</span>
          <span className="block text-xs text-muted-foreground">
            同じ単語の保存済み画像があっても再生成します。通常はオフのままで問題ありません。
          </span>
        </span>
      </label>

      {apiError && <p className="text-sm text-destructive">{apiError}</p>}

      {progress && (
        <p className="text-sm text-muted-foreground">
          作成中... {progress.done} / {progress.total}
        </p>
      )}

      <Button
        type="submit"
        disabled={submitting || wordCount === 0 || hasTooLongTitle}
        className="w-full flex items-center justify-center gap-2"
      >
        {submitting && <Spinner size={15} />}
        {submitting
          ? `作成中... (${progress?.done ?? 0}/${progress?.total ?? wordCount})`
          : wordCount > 1
            ? `${wordCount}件のカードを作成`
            : 'カードを作成'}
      </Button>
    </form>
  )
}
