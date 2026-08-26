'use client'

import { useState } from 'react'
import { Check, ImageIcon, Plus } from 'lucide-react'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { Spinner } from '@/components/ui/spinner'
import { createMeaning, getItem } from '@/lib/api/items'
import type { Item } from '@/types/item'

/**
 * この絵がどう作られたか。**1か所にまとめる。**
 *
 * 以前は「生成情報」と「プロンプト情報」の2つに分かれていた。どちらも
 * *この絵がどう作られたか* の話なのに、出す条件がそれぞれ違ったため、
 * カードの状態によって片方だけ消えた。使う側からは「出たり出なかったり」に見える。
 *
 *   生成情報   … media.generation_info が無い（作成中・失敗・古いカード）と消える
 *   プロンプト … 下ごしらえも指示も無いと消える
 *
 * まとめたうえで、**無い項目は消さずに「まだありません」と書く。**
 * 消えると、そもそもそういう項目があることを知る機会が無くなる。
 *
 * 生成履歴はここに含めない。あれは読むものではなく**選び直す操作**で、
 * 絵が並ぶぶん面積も要る。読み物と操作を同じ面に入れると、主従が決まらない。
 * 代わりに、ここから開く道を置く。
 */
const PANEL_KEY = 'item-image-info'

const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
}

/**
 * 大元の作り方。同じ絵でも、どの経路で作ったかで①②があるのかどうかが変わる。
 * 何を見ているのかが分かるように先頭で示す。
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

export function ImageInfoPanel({
  item,
  onUpdated,
  onOpenHistory,
}: {
  item: Item
  onUpdated?: (item: Item) => void
  /** 生成履歴を開く。読み物と操作は分けるので、ここからは道だけ出す */
  onOpenHistory?: () => void
}) {
  const panel = usePanelForm(PANEL_KEY, 'イメージ情報')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const status = item.brief_status ?? 'none'
  const preparing = status === 'pending' || status === 'processing'
  const source = SOURCE_LABEL[item.prompt_source ?? 'brief'] ?? SOURCE_LABEL.brief
  const fromWord = item.prompt_source === 'word'
  const description = item.image_description?.trim()
  const info = item.media?.generation_info
  const provider = info?.provider ? (PROVIDER_LABEL[info.provider] ?? info.provider) : null
  const sizeQuality = [info?.size, info?.quality].filter(Boolean).join(' / ')
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

  return (
    <>
      <button
        type="button"
        onClick={panel.open}
        aria-expanded={panel.isOpen}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {preparing ? <Spinner size={13} /> : <ImageIcon size={14} />}
        イメージ情報
      </button>

      <PanelSlotContent sectionKey={PANEL_KEY}>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium">作り方: {source.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{source.note}</p>
          </div>

          {/* **絵がまだ無くても項目ごと消さない。** 消えると、そういう情報が
              あること自体を知る機会が無くなる（分かれていた頃の不具合の芯） */}
          <Section title="生成の記録">
            {info ? (
              <dl className="space-y-1 text-xs">
                {info.model && <Row label="モデル">{info.model}</Row>}
                {provider && <Row label="プロバイダ">{provider}</Row>}
                {sizeQuality && <Row label="サイズ / 品質">{sizeQuality}</Row>}
                <Row label="生成日時">{new Date(item.created_at).toLocaleString('ja-JP')}</Row>
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">
                まだありません。絵ができると、使ったモデルや日時がここに残ります。
              </p>
            )}

            {info?.revised_prompt && (
              <Field label="revised_prompt（生成時にAIが補正した指示）">
                <Text value={info.revised_prompt} placeholder="—" />
              </Field>
            )}
          </Section>

          <Section title="画像への指示">
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
            <p className="text-xs text-muted-foreground">
              直すときは「イメージ再生成」から。
              {item.brief_edited && <span className="ml-1">（編集済み）</span>}
            </p>
          </Section>

          {onOpenHistory && (
            <div className="border-t border-border pt-3">
              <button
                type="button"
                onClick={onOpenHistory}
                className="text-xs underline underline-offset-2 hover:text-foreground"
                style={{ color: 'var(--palace)' }}
              >
                これまでに作った絵を見る
              </button>
            </div>
          )}
        </div>
      </PanelSlotContent>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-border pt-3">
      <p className="text-xs font-medium">{title}</p>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="break-all text-right">{children}</dd>
    </div>
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
      className={`max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed ${
        mono ? 'font-mono text-2xs' : 'text-xs'
      }`}
    >
      {value}
    </p>
  )
}
