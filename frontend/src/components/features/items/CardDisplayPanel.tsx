'use client'

import { useEffect, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PanelSlotContent } from '@/components/features/panel/PanelSlot'
import { usePanelForm } from '@/components/features/panel/usePanelForm'
import { getPropertyDefinitions, type PropertyDefinition } from '@/lib/api/properties'
import { getSettings, updateSettings } from '@/lib/api/settings'
import {
  CARD_COLUMN_CHOICES,
  CARD_ROW_CHOICES,
  MAX_CARDS_PER_PAGE,
  availableRowChoices,
  cardsPerPage,
  type CardDisplay,
} from '@/hooks/useCardDisplay'

const PANEL_KEY = 'items-display'

/**
 * カード一覧の見え方の設定。
 *
 * 一覧に置くのはボタン1つだけで、中身は右パネルで開く。
 * 作り直しパネルと同じ作りにして、置き場所が違っても迷わないようにする。
 * 棚そのものを見る面積を、設定のために削らないためでもある。
 *
 * 値は端末ごとに覚える（useCardDisplay）。保存ボタンは置かない。
 * 見え方は押した瞬間に結果が見えるので、確定させる操作を挟む意味がない。
 *
 * 見出し語だけは例外で、アカウントの設定として保存する。どの項目を名前として出すかは
 * サーバー側で解決しないと、一覧の payload に全項目を積むことになって重いため。
 */
export function CardDisplayPanel({
  display,
  onChange,
}: {
  display: CardDisplay
  onChange: (patch: Partial<CardDisplay>) => void
}) {
  const panel = usePanelForm(PANEL_KEY, '表示')
  const rowChoices = availableRowChoices(display.columns)
  const perPage = cardsPerPage(display)
  const {
    headlineKey,
    headlineChoices,
    changeHeadline,
    savingHeadline,
    listFields,
    maxListFields,
    toggleListField,
  } = useHeadlineSetting(panel.isOpen)

  return (
    <>
      <Button variant="outline" size="sm" onClick={panel.open} aria-expanded={panel.isOpen}>
        <LayoutGrid size={14} className="mr-1" />
        表示
      </Button>

      <PanelSlotContent sectionKey={PANEL_KEY}>
        <div className="space-y-5">
          {/* 説明は「選ぶと何が変わるか」だけに絞る。仕組みの話（枚数でなく行数で持つ等）は
              下の「◯列 × ◯行 ＝ ◯枚」を見れば分かるので、文にはしない */}
          <p className="text-xs text-muted-foreground">この端末だけの設定です。</p>

          <div className="space-y-2">
            <Label>画像の収め方</Label>
            <div className="flex flex-wrap gap-2">
              <Chip active={display.fit === 'natural'} onClick={() => onChange({ fit: 'natural' })}>
                実寸
              </Chip>
              <Chip active={display.fit === 'uniform'} onClick={() => onChange({ fit: 'uniform' })}>
                そろえる
              </Chip>
            </div>
            <p className="text-xs text-muted-foreground">
              {display.fit === 'uniform'
                ? '正方形にそろえ、余白を付けて画像全体を収めます。棚が波打ちません。'
                : 'カードの縦横比のまま、画像は枠いっぱいに入ります。'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>列数</Label>
            <div className="flex flex-wrap gap-2">
              {CARD_COLUMN_CHOICES.map((count) => (
                <Chip key={count} active={display.columns === count} onClick={() => onChange({ columns: count })}>
                  {count}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              広い画面での列数です。狭い画面では自動で減り、多いほど単語名は省略されます。
            </p>
          </div>

          <div className="space-y-2">
            <Label>1ページの行数</Label>
            <div className="flex flex-wrap gap-2">
              {rowChoices.map((count) => (
                <Chip key={count} active={display.rows === count} onClick={() => onChange({ rows: count })}>
                  {count}
                </Chip>
              ))}
            </div>
            {rowChoices.length < CARD_ROW_CHOICES.length && (
              <p className="text-xs text-muted-foreground">1ページ {MAX_CARDS_PER_PAGE} 枚までです。</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>名前に出す項目</Label>
            <div className="flex flex-wrap gap-2">
              <Chip active={!headlineKey} onClick={() => changeHeadline('')}>
                見出し語
              </Chip>
              {headlineChoices.map((choice) => (
                <Chip
                  key={choice.key}
                  active={headlineKey === choice.key}
                  onClick={() => changeHeadline(choice.key)}
                >
                  {choice.label}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {headlineChoices.length === 0
                ? '読み方や別名などの項目を作ると、ここで選べるようになります。'
                : '選んだ項目が空のカードは、見出し語のまま出ます。この設定はアカウント全体に効きます。'}
              {savingHeadline && ' 保存中…'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>名前の下に出す項目</Label>
            <div className="flex flex-wrap gap-2">
              {headlineChoices.map((choice) => (
                <Chip
                  key={choice.key}
                  active={listFields.includes(choice.key)}
                  onClick={() => toggleListField(choice.key)}
                >
                  {choice.label}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {headlineChoices.length === 0
                ? '読み方や別名などの項目を作ると、ここで選べるようになります。'
                : `最大 ${maxListFields} 件まで。値の入っていないカードには出ません。増やすほど1枚が縦に伸び、一覧として見渡しにくくなります。`}
            </p>
          </div>

          <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">
              {display.columns} 列 × {display.rows} 行
            </strong>{' '}
            ＝ 1ページ <strong className="text-foreground">{perPage} 枚</strong>
          </p>
        </div>
      </PanelSlotContent>
    </>
  )
}

/**
 * 名前として出す項目の選択。
 *
 * 選択肢は利用者が作った項目から作る。同じ識別名が種別をまたいで存在しうるので
 * 識別名で畳む（「読み方」を種別ごとに作っていても、選ぶのは1つでよい）。
 * 文字として出せる型（text / list）だけを候補にする。日付や URL を名前に出しても読めない。
 *
 * パネルを開いたときに読む。一覧を出すたびに毎回引く必要はない。
 */
function useHeadlineSetting(isOpen: boolean) {
  const [headlineKey, setHeadlineKey] = useState('')
  const [definitions, setDefinitions] = useState<PropertyDefinition[]>([])
  const [savingHeadline, setSavingHeadline] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [listFields, setListFields] = useState<string[]>([])
  const [maxListFields, setMaxListFields] = useState(2)

  useEffect(() => {
    if (!isOpen || loaded) return
    let cancelled = false
    Promise.all([getSettings(), getPropertyDefinitions()])
      .then(([settings, defs]) => {
        if (cancelled) return
        setHeadlineKey(settings.card_headline_key ?? '')
        setListFields(settings.card_list_fields ?? [])
        setMaxListFields(settings.max_card_list_fields ?? 2)
        setDefinitions(defs)
        setLoaded(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isOpen, loaded])

  const headlineChoices = Array.from(
    definitions
      .filter((d) => d.value_type === 'text' || d.value_type === 'list')
      .reduce((acc, d) => {
        if (!acc.has(d.key)) acc.set(d.key, { key: d.key, label: d.label })
        return acc
      }, new Map<string, { key: string; label: string }>())
      .values()
  )

  // 上限に達したら、いちばん古い指定を落として入れ替える。
  // 「上限です」と拒むより、押した結果が出るほうが分かりやすい
  const toggleListField = async (key: string) => {
    const next = listFields.includes(key)
      ? listFields.filter((k) => k !== key)
      : [...listFields, key].slice(-maxListFields)
    const previous = listFields
    setListFields(next)
    try {
      const saved = await updateSettings({ card_list_fields: next })
      setListFields(saved.card_list_fields ?? [])
    } catch {
      setListFields(previous) // 失敗したら元に戻す
    }
  }

  const changeHeadline = async (key: string) => {
    if (savingHeadline || key === headlineKey) return
    const previous = headlineKey
    setHeadlineKey(key)
    setSavingHeadline(true)
    try {
      const saved = await updateSettings({ card_headline_key: key })
      setHeadlineKey(saved.card_headline_key ?? '')
    } catch {
      setHeadlineKey(previous) // 失敗したら元に戻す
    } finally {
      setSavingHeadline(false)
    }
  }

  return { headlineKey, headlineChoices, changeHeadline, savingHeadline, listFields, maxListFields, toggleListField }
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:bg-muted'
      }`}
      style={active ? { backgroundColor: 'var(--palace)' } : undefined}
    >
      {children}
    </button>
  )
}
