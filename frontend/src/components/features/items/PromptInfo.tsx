'use client'

import { useState } from 'react'
import { Check, FileText, Plus } from 'lucide-react'
import { InfoPopover } from '@/components/features/shared/InfoPopover'
import { Spinner } from '@/components/ui/spinner'
import { createMeaning, getItem } from '@/lib/api/items'
import type { Item } from '@/types/item'

/**
 * この画像がどんな指示から作られたかを ⓘ ボタンで開いて見せる。
 *
 * 画像は単語からいきなり作られるのではなく、いちど
 *   ① 単語を噛み砕いた説明文 → ② そこから起こした画像への指示
 * を経由する。学習そのものの中身ではないので、生成情報と同じく畳んでおく。
 *
 * 直すのも作り直すのも「イメージを作り直す」側に集める。以前はここにも
 * 「AIで書き直す」があったが、見るだけの場所から保存済みの指示が黙って
 * 書き換わるのは筋が悪く、入口も二重になっていた。
 *
 * ただし①を意味・説明へ**足す**のはここに置く。
 * ①は「学習者が読んで腑に落ちる密度」で書かれた日本語なので、意味・説明として
 * そのまま通ることが多い。読んでいて「これでいい」と思う場所がここだから。
 * 上書きではなく追加なので、上の「黙って書き換わる」には当たらない。
 */
/**
 * 大元の作り方。同じ「プロンプト情報」でも、どの経路で作ったかで
 * ①②があるのかどうかが変わる。何を見ているのかが分かるように先頭で示す。
 */
const SOURCE_LABEL: Record<string, { title: string; note: string }> = {
  word: {
    title: '単語をそのまま',
    note: '下ごしらえを挟まず、単語だけを画像生成に渡しています。',
  },
  brief: {
    title: '単語 → 説明文 → 画像への指示',
    note: '単語をいちど説明文にしてから、絵にできる指示へ言い換えています。',
  },
  research: {
    title: '意味・説明 → 画像への指示',
    note: '先に調べた意味・説明をもとに、画像への指示を書き直しています。',
  },
}

export function PromptInfo({ item, onUpdated }: { item: Item; onUpdated?: (item: Item) => void }) {
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const status = item.brief_status ?? 'none'
  const preparing = status === 'pending' || status === 'processing'
  const source = SOURCE_LABEL[item.prompt_source ?? 'brief'] ?? SOURCE_LABEL.brief
  const fromWord = item.prompt_source === 'word'
  const description = item.image_description?.trim()
  // 同じ文が既に入っていれば足させない。押すたびに増えると、どれが本命か分からなくなる
  const alreadyAdded = Boolean(
    description && item.meanings?.some((m) => m.definition.trim() === description)
  )

  // ①をそのまま意味・説明へ足す。AI は通さない（既にある文をそのまま使うだけ）。
  // 詳しさは detailed（200〜300字）が①の長さに一番近い。
  const addToMeanings = async () => {
    if (!description || !onUpdated) return

    setAdding(true)
    setAddError(null)
    try {
      await createMeaning(item.id, { definition: description, detail_level: 'detailed' })
      onUpdated(await getItem(item.id))
    } catch {
      setAddError('加えられませんでした。もう一度お試しください。')
    } finally {
      setAdding(false)
    }
  }
  // まだ何も無く、これから作られる気配も無いカード（機能オフ・旧データ）は出さない。
  // 「単語をそのまま」で作ったカードは①②を持たないが、そのことを見せる価値がある
  if (!fromWord && status === 'none' && !item.scene_prompt && !item.image_description) return null

  return (
    <InfoPopover
      label="プロンプト情報"
      icon={preparing ? <Spinner size={13} /> : <FileText size={14} />}
      width="w-80"
      align="left"
    >
      <div className="rounded-md bg-muted/50 px-2.5 py-2">
        <p className="text-xs font-medium">作り方: {source.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{source.note}</p>
      </div>

      {fromWord ? (
        <Field label="画像への指示">
          <Text value={item.scene_prompt || item.title} placeholder="—" mono />
        </Field>
      ) : (
        <>
          <Field label="① 説明文">
            <Text value={item.image_description} placeholder={preparing ? '作成中...' : '未作成'} />
            {description && onUpdated && (
              <button
                type="button"
                onClick={addToMeanings}
                disabled={adding || alreadyAdded}
                className="mt-1 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                title={
                  alreadyAdded
                    ? 'この文は既に意味・説明に入っています'
                    : '同じ文を意味・説明へ足します（上書きはしません）'
                }
              >
                {adding ? <Spinner size={12} /> : alreadyAdded ? <Check size={12} /> : <Plus size={12} />}
                {alreadyAdded ? '意味・説明に追加済み' : '意味・説明に加える'}
              </button>
            )}
            {addError && <p className="mt-1 text-xs text-destructive">{addError}</p>}
          </Field>
          <Field label="② 画像への指示">
            <Text
              value={item.scene_prompt}
              placeholder={preparing ? '作成中...' : '未作成（単語をそのまま使用）'}
              mono
            />
          </Field>
        </>
      )}

      <div className="flex items-center justify-between border-t border-border/60 pt-2">
        <span className="text-xs text-muted-foreground">直すときは「イメージを作り直す」から。</span>
        {item.brief_edited && <span className="text-xs text-muted-foreground">編集済み</span>}
      </div>
    </InfoPopover>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function Text({ value, placeholder, mono }: { value?: string | null; placeholder: string; mono?: boolean }) {
  if (!value) return <p className="text-xs text-muted-foreground">{placeholder}</p>

  return (
    <p
      className={`max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed ${
        mono ? 'font-mono text-[11px]' : 'text-xs'
      }`}
    >
      {value}
    </p>
  )
}
