'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBillingStore } from '@/stores/billing'
import { CREDIT_UNIT_SHORT } from '@/lib/billing'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { retryItem } from '@/lib/api/items'
import { getSettings } from '@/lib/api/settings'
import { STYLE_OPTIONS, CUSTOM_PROMPT_MAX_LENGTH } from '@/lib/item-styles'
import type { Item } from '@/types/item'

interface Props {
  item: Item
  onUpdated: (item: Item) => void
}

/**
 * カードの画像を再生成するパネル。failed・completed どちらの状態からも使える。
 * 任意で「入力補足・指示」（custom_prompt）とスタイルを指定でき、
 * 曖昧な入力の補足や、生成済み画像のニュアンス調整・置き換えに使う。
 *
 * 出来上がったものの作り直しは、新しい画像を1枚作るので1クレジット使う。
 * 失敗からの作り直しは無料（渡せていないものに課金しない）。
 * 押す前に、どちらなのかと残高が分かるようにしておく。
 */
export function RegeneratePanel({ item, onUpdated }: Props) {
  const isFailed = item.generation_status === 'failed'
  const [open, setOpen] = useState(isFailed)
  const [customPrompt, setCustomPrompt] = useState(item.custom_prompt ?? '')
  const [style, setStyle] = useState(item.style ?? '')
  const [useMeaning, setUseMeaning] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const available = useBillingStore((s) => s.summary?.available_credits) ?? null
  // 失敗からの作り直しは無料。出来上がったものの作り直しだけ1クレジット
  const costsCredit = !isFailed
  const insufficient = costsCredit && available !== null && available < 1
  // 「意味・説明を参考にする」の初期値はユーザー設定（既定 ON）に従う。ユーザーが触ったら以後は上書きしない。
  const meaningTouched = useRef(false)

  const hasMeaning = Boolean(item.meaning && item.meaning.trim())

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (!meaningTouched.current) setUseMeaning(s.regenerate_with_meaning)
      })
      .catch(() => {})
  }, [])

  const handleRegenerate = async () => {
    setRetrying(true)
    setError(null)
    try {
      const updated = await retryItem(item.id, {
        customPrompt: customPrompt.trim(),
        style,
        useMeaning: hasMeaning ? useMeaning : false,
      })
      onUpdated(updated)
      // 消費したぶんを残高表示へ反映する（ヘッダーと共有）
      if (costsCredit) useBillingStore.getState().fetchSummary()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; errors?: string[] } } }
      setError(
        axiosErr?.response?.data?.error ??
          axiosErr?.response?.data?.errors?.[0] ??
          '作り直せませんでした。もう一度試してください。'
      )
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background px-4 py-3">
      {isFailed && item.generation_error && (
        <p className="text-sm leading-6 text-destructive">{item.generation_error}</p>
      )}

      {!open ? (
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2"
        >
          <RefreshCw size={15} />
          画像を作り直す{costsCredit && `（1 ${CREDIT_UNIT_SHORT}）`}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <RefreshCw size={15} />
            画像を作り直す
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            {costsCredit ? (
              <>
                作り直しには 1 {CREDIT_UNIT_SHORT} を使用します（新しい画像を1枚作るため）。
                {available !== null && <>　残り {available} {CREDIT_UNIT_SHORT}</>}
              </>
            ) : (
              <>生成に失敗した場合の作り直しは無料です。</>
            )}
          </p>

          <div className="space-y-2">
            <Label htmlFor="regen-instruction">入力補足・指示（任意）</Label>
            <textarea
              id="regen-instruction"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={retrying}
              maxLength={CUSTOM_PROMPT_MAX_LENGTH}
              rows={2}
              placeholder="例: もっと写実的に / 背景を青空に / りんごは断面を見せて"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
            <p className="text-xs text-muted-foreground">
              曖昧な単語を補ったり、生成済み画像のニュアンスを調整して置き換えられます。
            </p>
          </div>

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
                    disabled={retrying}
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
          </div>

          {hasMeaning && (
            <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background px-4 py-3">
              <input
                type="checkbox"
                checked={useMeaning}
                onChange={(e) => {
                  meaningTouched.current = true
                  setUseMeaning(e.target.checked)
                }}
                disabled={retrying}
                className="mt-1 h-4 w-4 rounded border-input"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium">意味・説明を参考にする</span>
                <span className="block text-xs text-muted-foreground">
                  このカードの意味・説明文を画像生成のヒントに加えます（既定は環境設定で変更できます）。
                </span>
              </span>
            </label>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={handleRegenerate}
              disabled={retrying || insufficient}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {retrying ? <Spinner size={15} /> : <RefreshCw size={15} />}
              {retrying ? '作り直しています...' : `この内容で作り直す${costsCredit ? `（1 ${CREDIT_UNIT_SHORT}）` : ''}`}
            </Button>
            {!isFailed && (
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={retrying} aria-label="閉じる">
                <ChevronDown size={16} />
              </Button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
